import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act } from '@testing-library/react-native';
import {
  REVIEW_SEEN_KEY,
  loadReviewSeen,
  markReviewsSeen,
  clearReviewSeen,
  useReviewSeen,
} from './reviewSeen';

describe('reviewSeen (spec 0038, AC-9)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearReviewSeen();
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    await clearReviewSeen();
  });

  describe('loadReviewSeen', () => {
    it('returns empty array when AsyncStorage has no record', async () => {
      let mod: typeof import('./reviewSeen');
      jest.isolateModules(() => {
        mod = require('./reviewSeen');
      });
      const seen = await mod!.loadReviewSeen();
      expect(seen).toEqual([]);
    });

    it('loads and parses stored ids from AsyncStorage on initial load', async () => {
      await AsyncStorage.setItem(
        REVIEW_SEEN_KEY,
        JSON.stringify(['rev-1', 'rev-2']),
      );

      let mod: typeof import('./reviewSeen');
      jest.isolateModules(() => {
        mod = require('./reviewSeen');
      });

      const seen = await mod!.loadReviewSeen();
      expect(seen).toEqual(['rev-1', 'rev-2']);
    });

    it('returns empty array when stored JSON is invalid or corrupted', async () => {
      await AsyncStorage.setItem(REVIEW_SEEN_KEY, 'invalid-json{{');

      let mod: typeof import('./reviewSeen');
      jest.isolateModules(() => {
        mod = require('./reviewSeen');
      });

      const seen = await mod!.loadReviewSeen();
      expect(seen).toEqual([]);
    });

    it('filters out non-string entries from parsed array', async () => {
      await AsyncStorage.setItem(
        REVIEW_SEEN_KEY,
        JSON.stringify(['rev-1', 123, null, 'rev-2', { id: 'x' }]),
      );

      let mod: typeof import('./reviewSeen');
      jest.isolateModules(() => {
        mod = require('./reviewSeen');
      });

      const seen = await mod!.loadReviewSeen();
      expect(seen).toEqual(['rev-1', 'rev-2']);
    });
  });

  describe('markReviewsSeen', () => {
    it('saves newly seen ids to AsyncStorage under REVIEW_SEEN_KEY without duplicating existing ones', async () => {
      await markReviewsSeen(['rev-1', 'rev-2']);

      const raw = await AsyncStorage.getItem(REVIEW_SEEN_KEY);
      expect(raw).toBeDefined();
      expect(JSON.parse(raw!)).toEqual(['rev-1', 'rev-2']);

      // Marking rev-2 again does not duplicate it, adds rev-3
      await markReviewsSeen(['rev-2', 'rev-3']);
      const updatedRaw = await AsyncStorage.getItem(REVIEW_SEEN_KEY);
      expect(JSON.parse(updatedRaw!)).toEqual(['rev-1', 'rev-2', 'rev-3']);
    });

    it('does nothing when all provided ids are already marked', async () => {
      await markReviewsSeen(['rev-1']);
      (AsyncStorage.setItem as jest.Mock).mockClear();

      await markReviewsSeen(['rev-1']);
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('caps stored marks at 200 (MAX_MARKS), dropping the oldest entries', async () => {
      const initialIds = Array.from({ length: 195 }, (_, i) => `old-${i}`);
      await markReviewsSeen(initialIds);

      const newIds = Array.from({ length: 10 }, (_, i) => `new-${i}`);
      await markReviewsSeen(newIds);

      const raw = await AsyncStorage.getItem(REVIEW_SEEN_KEY);
      const stored = JSON.parse(raw!) as string[];
      expect(stored.length).toBe(200);
      // First 5 old entries should have been dropped: old-0 to old-4
      expect(stored[0]).toBe('old-5');
      // All 10 new entries are at the end
      expect(stored.slice(-10)).toEqual(newIds);
    });
  });

  describe('clearReviewSeen', () => {
    it('removes REVIEW_SEEN_KEY from AsyncStorage and resets cached state', async () => {
      await markReviewsSeen(['rev-1', 'rev-2']);
      expect(await AsyncStorage.getItem(REVIEW_SEEN_KEY)).not.toBeNull();

      await clearReviewSeen();

      expect(await AsyncStorage.getItem(REVIEW_SEEN_KEY)).toBeNull();
      const seen = await loadReviewSeen();
      expect(seen).toEqual([]);
    });
  });

  describe('useReviewSeen hook', () => {
    it('returns current seen list and updates when markReviewsSeen is called', async () => {
      const { result, unmount } = renderHook(() => useReviewSeen());

      expect(result.current).toEqual([]);

      await act(async () => {
        await markReviewsSeen(['rev-new-1']);
      });

      expect(result.current).toEqual(['rev-new-1']);

      await act(async () => {
        await markReviewsSeen(['rev-new-2']);
      });

      expect(result.current).toEqual(['rev-new-1', 'rev-new-2']);
      unmount();
    });
  });
});
