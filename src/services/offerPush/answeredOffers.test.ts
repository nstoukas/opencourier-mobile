import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isOfferAnswered,
  loadAnsweredOffers,
  markOfferAnswered,
  offerKeyOf,
  unmarkOfferAnswered,
} from './answeredOffers';

describe('answeredOffers (spec 0003, AC-5, Decision 58.16)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
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
});
