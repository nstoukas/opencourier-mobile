import AsyncStorage from '@react-native-async-storage/async-storage';
import { Query } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  shouldKeepQuery,
  QUERY_CACHE_MAX_AGE_MS,
  persistOptions,
  clearSavedQueries,
} from './queryPersistence';
import { queryClient } from './queryClient';
import { endExpiredSession } from './session';

describe('queryPersistence (spec 0009, AC-1, AC-11)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  describe('shouldKeepQuery', () => {
    const makeQuery = (
      key: string,
      status: 'success' | 'error' | 'pending',
    ): Query =>
      ({
        queryKey: [key],
        state: { status },
      } as unknown as Query);

    it('keeps only successful user, inProgressOrders, and the three earnings queries', () => {
      const allowedKeys = [
        QueryKeys.user,
        QueryKeys.inProgressOrders,
        QueryKeys.earningsSummary,
        QueryKeys.earningsDay,
        QueryKeys.earningsDelivery,
      ];

      for (const key of allowedKeys) {
        expect(shouldKeepQuery(makeQuery(key, 'success'))).toBe(true);
      }
    });

    it('never keeps newOrders or orderHistory even if successful', () => {
      expect(shouldKeepQuery(makeQuery(QueryKeys.newOrders, 'success'))).toBe(
        false,
      );
      expect(
        shouldKeepQuery(makeQuery(QueryKeys.orderHistory, 'success')),
      ).toBe(false);
      expect(shouldKeepQuery(makeQuery('randomQuery', 'success'))).toBe(false);
    });

    it('returns false for allowed queries when status is not success (e.g. error or pending)', () => {
      expect(shouldKeepQuery(makeQuery(QueryKeys.user, 'error'))).toBe(false);
      expect(
        shouldKeepQuery(makeQuery(QueryKeys.inProgressOrders, 'pending')),
      ).toBe(false);
      expect(
        shouldKeepQuery(makeQuery(QueryKeys.earningsSummary, 'error')),
      ).toBe(false);
    });
  });

  describe('persistOptions and queryClient default gcTime', () => {
    it('persistOptions.maxAge is 24 hours (QUERY_CACHE_MAX_AGE_MS)', () => {
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
      expect(QUERY_CACHE_MAX_AGE_MS).toBe(TWENTY_FOUR_HOURS_MS);
      expect(persistOptions.maxAge).toBe(TWENTY_FOUR_HOURS_MS);
    });

    it('QueryClient default gcTime is 24 hours to match cache persistence', () => {
      const defaultGcTime = queryClient.getDefaultOptions().queries?.gcTime;
      expect(defaultGcTime).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('clearSavedQueries and endExpiredSession', () => {
    it('clearSavedQueries removes the saved queryCache from AsyncStorage', async () => {
      await AsyncStorage.setItem(
        'queryCache',
        JSON.stringify({ test: 'cached' }),
      );
      expect(await AsyncStorage.getItem('queryCache')).toBeTruthy();

      await clearSavedQueries();

      expect(await AsyncStorage.getItem('queryCache')).toBeNull();
    });

    it('endExpiredSession calls clearSavedQueries (AC-11)', async () => {
      await AsyncStorage.setItem(
        'queryCache',
        JSON.stringify({ test: 'cached' }),
      );
      const mockHttp = {
        defaults: { headers: { common: {} } },
      } as any;

      await endExpiredSession(mockHttp);

      // Cache is cleared after session expires
      expect(await AsyncStorage.getItem('queryCache')).toBeNull();
    });
  });
});
