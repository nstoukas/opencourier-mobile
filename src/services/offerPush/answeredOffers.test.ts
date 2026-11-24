import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearDeclineFailed,
  isDeclineFailed,
  isOfferAnswered,
  loadAnsweredOffers,
  markDeclineFailed,
  markOfferAnswered,
  markOfferEnded,
  offerKeyOf,
  unmarkOfferAnswered,
} from './answeredOffers';

describe('answeredOffers (spec 0003, AC-5, Decision 58.16)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await clearDeclineFailed();
  });

  it('keys answered offers by delivery id plus offeredAt', () => {
    expect(offerKeyOf('del-1', '2026-10-26T10:00:00Z')).toBe(
      'del-1@2026-10-26T10:00:00Z',
    );
    expect(offerKeyOf('del-2', null)).toBe('del-2@');
    expect(offerKeyOf('del-3', undefined)).toBe('del-3@');
  });

  it('marks offer as answered once, returns false for duplicates, and persists to storage', async () => {
    const key = offerKeyOf('del-unique', '2026-10-26T10:00:00Z');

    const first = markOfferAnswered(key);
    expect(first).toBe(true);
    expect(isOfferAnswered(key)).toBe(true);

    const second = markOfferAnswered(key);
    expect(second).toBe(false);

    // Persisted to storage
    const stored = await AsyncStorage.getItem('answered_offer_ids');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toContain(key);
  });

  it('unmarkOfferAnswered removes the offer from memory and storage', async () => {
    const key = offerKeyOf('del-retry', '2026-10-26T10:00:00Z');
    markOfferAnswered(key);
    expect(isOfferAnswered(key)).toBe(true);

    unmarkOfferAnswered(key);
    expect(isOfferAnswered(key)).toBe(false);

    const stored = await AsyncStorage.getItem('answered_offer_ids');
    const parsed = stored ? JSON.parse(stored) : [];
    expect(parsed).not.toContain(key);
  });

  it('loads previously persisted answered offers on loadAnsweredOffers', async () => {
    const keyA = 'del-prev-A@2026-10-26T09:00:00Z';
    const keyB = 'del-prev-B@2026-10-26T09:05:00Z';
    await AsyncStorage.setItem(
      'answered_offer_ids',
      JSON.stringify([keyA, keyB]),
    );

    await loadAnsweredOffers();
    expect(isOfferAnswered(keyA)).toBe(true);
    expect(isOfferAnswered(keyB)).toBe(true);
    expect(isOfferAnswered('del-unknown@')).toBe(false);
  });

  describe('markOfferEnded (Row 155)', () => {
    it('marks the offer as answered when offeredAt is provided and persists to storage', async () => {
      const deliveryId = 'del-ended-1';
      const offeredAt = '2026-11-24T18:00:00.000Z';
      const key = offerKeyOf(deliveryId, offeredAt);

      expect(isOfferAnswered(key)).toBe(false);

      await markOfferEnded(deliveryId, offeredAt);

      expect(isOfferAnswered(key)).toBe(true);

      // Check persisted to storage
      const stored = await AsyncStorage.getItem('answered_offer_ids');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toContain(key);

      // A different offeredAt for the same delivery is NOT marked
      const differentKey = offerKeyOf(deliveryId, '2026-11-24T18:05:00.000Z');
      expect(isOfferAnswered(differentKey)).toBe(false);
    });

    it('does nothing when offeredAt is null (older server)', async () => {
      const deliveryId = 'del-ended-no-time';
      await markOfferEnded(deliveryId, null);

      expect(isOfferAnswered(offerKeyOf(deliveryId, null))).toBe(false);
      expect(await AsyncStorage.getItem('answered_offer_ids')).toBeNull();
    });
  });

  describe('decline_failed_offer_ids (Row 131)', () => {
    it('marks decline failed, avoids duplicates, and persists to storage', async () => {
      const key = offerKeyOf('del-dec-1', '2026-11-23T10:00:00Z');

      markDeclineFailed(key);
      expect(isDeclineFailed(key)).toBe(true);

      // Duplicate addition has no effect
      markDeclineFailed(key);
      expect(isDeclineFailed(key)).toBe(true);

      const stored = await AsyncStorage.getItem('decline_failed_offer_ids');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual([key]);
    });

    it('caps decline failed list at KEEP_AT_MOST (50)', async () => {
      for (let i = 0; i < 55; i++) {
        markDeclineFailed(`del-batch-${i}@2026-11-23T10:00:00Z`);
      }

      const stored = await AsyncStorage.getItem('decline_failed_offer_ids');
      const parsed: string[] = JSON.parse(stored!);
      expect(parsed).toHaveLength(50);
      // Older items dropped off
      expect(parsed).not.toContain('del-batch-0@2026-11-23T10:00:00Z');
      expect(parsed).toContain('del-batch-54@2026-11-23T10:00:00Z');
      expect(isDeclineFailed('del-batch-0@2026-11-23T10:00:00Z')).toBe(false);
      expect(isDeclineFailed('del-batch-54@2026-11-23T10:00:00Z')).toBe(true);
    });

    it('clearDeclineFailed empties in-memory list and removes storage item', async () => {
      const key = offerKeyOf('del-dec-clear', '2026-11-23T10:00:00Z');
      markDeclineFailed(key);
      expect(isDeclineFailed(key)).toBe(true);

      await clearDeclineFailed();
      expect(isDeclineFailed(key)).toBe(false);
      expect(await AsyncStorage.getItem('decline_failed_offer_ids')).toBeNull();
    });

    it('loadAnsweredOffers reads both lists and merges with memory (Point 10)', async () => {
      const storedAns = 'del-stored-ans@2026-11-23T09:00:00Z';
      const storedDec = 'del-stored-dec@2026-11-23T09:00:00Z';

      let mod: typeof import('./answeredOffers');
      let isolatedStorage: typeof AsyncStorage;
      jest.isolateModules(() => {
        isolatedStorage = require('@react-native-async-storage/async-storage');
        mod = require('./answeredOffers');
      });

      // Add in-memory items first
      mod!.markOfferAnswered('del-mem-ans@2026-11-23T09:30:00Z');
      mod!.markDeclineFailed('del-mem-dec@2026-11-23T09:30:00Z');

      // Storage contains items from prior run/background
      await isolatedStorage!.setItem(
        'answered_offer_ids',
        JSON.stringify([storedAns]),
      );
      await isolatedStorage!.setItem(
        'decline_failed_offer_ids',
        JSON.stringify([storedDec]),
      );

      await mod!.loadAnsweredOffers();

      // Both storage and memory items are preserved
      expect(mod!.isOfferAnswered(storedAns)).toBe(true);
      expect(mod!.isOfferAnswered('del-mem-ans@2026-11-23T09:30:00Z')).toBe(
        true,
      );
      expect(mod!.isDeclineFailed(storedDec)).toBe(true);
      expect(mod!.isDeclineFailed('del-mem-dec@2026-11-23T09:30:00Z')).toBe(
        true,
      );
    });

    it('one list failing to read (e.g. malformed JSON) does not stop the other (Point 10 resilience)', async () => {
      const goodAnsKey = 'del-good-ans@2026-11-23T09:00:00Z';
      const goodDecKey = 'del-good-dec@2026-11-23T09:00:00Z';

      // 1. Corrupt decline_failed_offer_ids: answered_offer_ids still loads
      let mod1: typeof import('./answeredOffers');
      let storage1: typeof AsyncStorage;
      jest.isolateModules(() => {
        storage1 = require('@react-native-async-storage/async-storage');
        mod1 = require('./answeredOffers');
      });
      await storage1!.setItem(
        'answered_offer_ids',
        JSON.stringify([goodAnsKey]),
      );
      await storage1!.setItem(
        'decline_failed_offer_ids',
        'INVALID_JSON_NOT_AN_ARRAY',
      );

      await expect(mod1!.loadAnsweredOffers()).resolves.toBeUndefined();
      expect(mod1!.isOfferAnswered(goodAnsKey)).toBe(true);
      expect(mod1!.isDeclineFailed('any@')).toBe(false);

      // 2. Corrupt answered_offer_ids: decline_failed_offer_ids still loads
      let mod2: typeof import('./answeredOffers');
      let storage2: typeof AsyncStorage;
      jest.isolateModules(() => {
        storage2 = require('@react-native-async-storage/async-storage');
        mod2 = require('./answeredOffers');
      });
      await storage2!.setItem('answered_offer_ids', '{corrupted');
      await storage2!.setItem(
        'decline_failed_offer_ids',
        JSON.stringify([goodDecKey]),
      );

      await expect(mod2!.loadAnsweredOffers()).resolves.toBeUndefined();
      expect(mod2!.isDeclineFailed(goodDecKey)).toBe(true);
      expect(mod2!.isOfferAnswered('any@')).toBe(false);
    });
  });
});
