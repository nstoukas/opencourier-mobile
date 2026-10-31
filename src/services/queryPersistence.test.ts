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
      data?: unknown,
      status: 'success' | 'error' | 'pending' = 'success',
    ): Query =>
      ({
        queryKey: [key],
        state: { status, data },
      } as unknown as Query);

    it('keeps a user, inProgressOrders or earnings query when data is defined, whatever its status (AC-1)', () => {
      const allowedKeys = [
        QueryKeys.user,
        QueryKeys.inProgressOrders,
        QueryKeys.earningsSummary,
        QueryKeys.earningsDay,
        QueryKeys.earningsDelivery,
      ];

      for (const key of allowedKeys) {
        // Keeps with status 'success' and data
        expect(
          shouldKeepQuery(makeQuery(key, { sample: 'data' }, 'success')),
        ).toBe(true);
        // Keeps with status 'error' and data (AC-1 offline refetch failure)
        expect(
          shouldKeepQuery(makeQuery(key, { sample: 'data' }, 'error')),
        ).toBe(true);
        // Keeps with status 'pending' and data
        expect(
          shouldKeepQuery(makeQuery(key, { sample: 'data' }, 'pending')),
        ).toBe(true);
      }
    });

    it('drops queries with no data (data === undefined) even with success status (AC-1)', () => {
      const allowedKeys = [
        QueryKeys.user,
        QueryKeys.inProgressOrders,
        QueryKeys.earningsSummary,
        QueryKeys.earningsDay,
        QueryKeys.earningsDelivery,
      ];

      for (const key of allowedKeys) {
        expect(shouldKeepQuery(makeQuery(key, undefined, 'success'))).toBe(
          false,
        );
        expect(shouldKeepQuery(makeQuery(key, undefined, 'error'))).toBe(false);
        expect(shouldKeepQuery(makeQuery(key, undefined, 'pending'))).toBe(
          false,
        );
      }
    });

    it('never keeps newOrders or orderHistory even with data (AC-1)', () => {
      expect(
        shouldKeepQuery(
          makeQuery(QueryKeys.newOrders, { id: 'order-1' }, 'success'),
        ),
      ).toBe(false);
      expect(
        shouldKeepQuery(
          makeQuery(QueryKeys.newOrders, { id: 'order-1' }, 'error'),
        ),
      ).toBe(false);
      expect(
        shouldKeepQuery(
          makeQuery(QueryKeys.orderHistory, [{ id: 'hist-1' }], 'success'),
        ),
      ).toBe(false);
      expect(
        shouldKeepQuery(
          makeQuery(QueryKeys.orderHistory, [{ id: 'hist-1' }], 'error'),
        ),
      ).toBe(false);
      expect(
        shouldKeepQuery(
          makeQuery('randomQuery', { some: 'payload' }, 'success'),
        ),
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

    it('endExpiredSession calls clearSavedQueries and keeps the outbox (AC-8, AC-11)', async () => {
      const initialOutbox = JSON.stringify([
        { id: 'step-1', courierId: 'rider-1', state: 'waiting' },
      ]);
      await AsyncStorage.setItem(
        'queryCache',
        JSON.stringify({ test: 'cached' }),
      );
      await AsyncStorage.setItem('jobStepOutbox', initialOutbox);

      const mockHttp = {
        defaults: { headers: { common: {} } },
      } as any;

      await endExpiredSession(mockHttp);

      // Cache is cleared after session expires
      expect(await AsyncStorage.getItem('queryCache')).toBeNull();
      // Outbox is kept intact (no change to AsyncStorage key jobStepOutbox)
      expect(await AsyncStorage.getItem('jobStepOutbox')).toBe(initialOutbox);
    });
  });
});
