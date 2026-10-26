import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderSetting } from '@app/types/enums';
import { Order, UserStatus } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  OFFER_END_CHECK_DELAY_MS,
  OFFER_REMINDER_EVERY_MS,
} from '@app/utilities/constants';
import { OFFER_HAS_ENDED_CODE } from '@app/services/orderService';
import { AxiosError } from 'axios';
import '@app/localization/i18n';
import {
  markOfferAnswered,
  offerKeyOf,
} from '@app/services/offerPush/answeredOffers';

jest.mock('@app/services/offerPush/offerAlert', () => ({
  cancelOfferAlert: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockDeliverySetting = OrderSetting.manual;
let mockUserStatus = UserStatus.Online;

jest.mock('./useUser', () => () => ({
  user: { deliverySetting: mockDeliverySetting, status: mockUserStatus },
  isLoading: false,
  refetchUser: jest.fn(),
}));

const mockAcceptOrder = jest.fn();
const mockDeclineOrder = jest.fn();
const mockGetNewOrders = jest.fn();

jest.mock('@app/services/service', () => ({
  services: {
    orderService: {
      getNewOrders: () => mockGetNewOrders(),
      getInProgressOrders: () =>
        Promise.resolve({ data: { result: { data: [] } } }),
      getOrdersHistory: () =>
        Promise.resolve({ data: { result: { data: [] } } }),
      acceptOrder: (id: string) => mockAcceptOrder(id),
      declineOrder: (id: string) => mockDeclineOrder(id),
    },
  },
}));

const mockRemindRiderOfOffer = jest.fn();
const mockCancelOfferReminder = jest.fn();
jest.mock('@app/services/offerReminder', () => ({
  remindRiderOfOffer: (...args: any[]) => mockRemindRiderOfOffer(...args),
  cancelOfferReminder: (...args: any[]) => mockCancelOfferReminder(...args),
}));

import { useHomeOrders } from './useHomeOrders';

function HookHost({
  onRender,
}: {
  onRender: (hook: ReturnType<typeof useHomeOrders>) => void;
}) {
  const hook = useHomeOrders();
  onRender(hook);
  return null;
}

describe('useHomeOrders', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;

  const makeOfferEndedError = () => {
    const err = new AxiosError('Offer ended');
    err.response = {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: {} as any,
      data: {
        error: true,
        result: [
          { code: OFFER_HAS_ENDED_CODE, message: 'This offer has ended' },
        ],
      },
    };
    return err;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetNewOrders.mockReturnValue(new Promise(() => {}));
    mockAcceptOrder.mockResolvedValue({});
    mockDeclineOrder.mockResolvedValue({});
    mockDeliverySetting = OrderSetting.manual;
    mockUserStatus = UserStatus.Online;

    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: Infinity,
          structuralSharing: false,
        },
        mutations: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    queryClient.clear();
    jest.useRealTimers();
  });

  describe('AC-8: Auto accept rider', () => {
    it('accepts offer on arrival immediately and exactly once even across refetches', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      // In-flight accept request so the offer remains in the list while further passes occur
      mockAcceptOrder.mockReturnValue(new Promise(() => {}));

      const testOffer: Order = {
        id: 'order-123',
        offeredAt: '2026-10-26T12:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      const testOffer2: Order = {
        id: 'order-456',
        offeredAt: '2026-10-26T12:00:05.000Z',
        phoneClock: { offeredAt: 105000, expiresAt: 165000 },
      } as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      // Accepted immediately on arrival (before advancing timers)
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith('order-123');
      expect(mockDeclineOrder).not.toHaveBeenCalled();

      // Trigger further passes with the SAME offer still in the list:
      // 1. Refetch occurs returning the same offer id
      mockGetNewOrders.mockResolvedValueOnce([{ ...testOffer }]);
      await act(async () => {
        await hookResult?.refetchNew();
        jest.runOnlyPendingTimers();
        await Promise.resolve();
      });

      // 2. A rerender of the component tree with the same offer still listed
      await act(async () => {
        tree.update(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
        await Promise.resolve();
      });

      // 3. A fake timer tick
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      // Still called exactly once for order-123 (claimForAutoAccept prevented duplicate send)
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith('order-123');

      // A second offer id arrives and is accepted once too
      mockGetNewOrders.mockResolvedValueOnce([{ ...testOffer }, testOffer2]);
      await act(async () => {
        await hookResult?.refetchNew();
        jest.runOnlyPendingTimers();
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(2);
      expect(mockAcceptOrder).toHaveBeenLastCalledWith('order-456');

      act(() => {
        tree.unmount();
      });
    });

    it('accepts offer immediately when rider switches setting to auto_accept while offer is on screen (decision 61.26)', async () => {
      mockDeliverySetting = OrderSetting.manual;
      const testOffer: Order = {
        id: 'order-123',
        offeredAt: '2026-10-26T12:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => {}} />
          </QueryClientProvider>,
        );
      });

      // In manual mode: not accepted on arrival
      expect(mockAcceptOrder).not.toHaveBeenCalled();

      // Rider switches setting to auto_accept
      mockDeliverySetting = OrderSetting.auto_accept;
      await act(async () => {
        tree.update(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => {}} />
          </QueryClientProvider>,
        );
        await Promise.resolve();
      });

      // Offer is claimed and accepted immediately upon switching
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith('order-123');

      act(() => {
        tree.unmount();
      });
    });

    it('puts offer back on New list after failed auto accept without retrying automatically', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const testOffer: Order = {
        id: 'order-123',
        offeredAt: '2026-10-26T12:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      mockAcceptOrder.mockRejectedValueOnce(new Error('Network error'));
      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      // Failed accept released offer back to New list for manual retry
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual(['order-123']);

      // Refetch occurs: auto-accept must NOT try again automatically
      mockGetNewOrders.mockResolvedValueOnce([testOffer]);
      await act(async () => {
        await hookResult?.refetchNew();
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);

      // Rider can manually accept
      mockAcceptOrder.mockResolvedValueOnce({});
      await act(async () => {
        hookResult?.acceptOrderFn('order-123');
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(2);

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('AC-9: Manual rider deadline behavior', () => {
    it('sends nothing at zero and fetches the list once 4s after deadline', async () => {
      mockDeliverySetting = OrderSetting.manual;
      const now = Date.now();
      const testOffer: Order = {
        id: 'order-123',
        offeredAt: new Date(now).toISOString(),
        phoneClock: { offeredAt: now, expiresAt: now + 60000 },
      } as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => {}} />
          </QueryClientProvider>,
        );
      });

      // Clear the initial mount fetch call so we specifically test deadline behavior
      mockGetNewOrders.mockClear();

      // Advance clock by 60 seconds (reaching deadline at zero)
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
      });

      // At zero, phone sends NO decline and NO accept
      expect(mockDeclineOrder).not.toHaveBeenCalled();
      expect(mockAcceptOrder).not.toHaveBeenCalled();
      expect(mockGetNewOrders).not.toHaveBeenCalled();

      // Advance by 4 seconds (the OFFER_END_CHECK_DELAY_MS)
      await act(async () => {
        jest.advanceTimersByTime(OFFER_END_CHECK_DELAY_MS);
        await Promise.resolve();
      });

      // Phone fetches the list once to verify if offer ended on server
      expect(mockGetNewOrders).toHaveBeenCalledTimes(1);
      expect(mockDeclineOrder).not.toHaveBeenCalled();
      expect(mockAcceptOrder).not.toHaveBeenCalled();

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('AC-4: Expiry off (no deadline)', () => {
    it('returns timeLeft null and triggers remindRiderOfOffer every 30s', async () => {
      mockDeliverySetting = OrderSetting.manual;
      const now = Date.now();
      const testOffer: Order = {
        id: 'order-123',
        offeredAt: new Date(now).toISOString(),
        phoneClock: { offeredAt: now, expiresAt: null },
      } as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let renderCount = 0;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
                renderCount++;
              }}
            />
          </QueryClientProvider>,
        );
      });

      // With no deadline, timeLeft is null so UI draws no bar
      expect(hookResult?.timeLeftForOffer('order-123')).toBeNull();
      expect(hookResult?.totalTimeForOffer('order-123')).toBeNull();

      const initialRenderCount = renderCount;

      // Advance time by 30 seconds (1st reminder)
      await act(async () => {
        jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
        await Promise.resolve();
      });

      expect(mockRemindRiderOfOffer).toHaveBeenCalledTimes(1);
      expect(mockRemindRiderOfOffer).toHaveBeenCalledWith('order-123', 30000);
      // setReminderTick triggered a re-render so "Waiting X min" is updated
      expect(renderCount).toBeGreaterThan(initialRenderCount);

      // Advance time by another 30 seconds (60s total, 2nd reminder)
      await act(async () => {
        jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
        await Promise.resolve();
      });

      expect(mockRemindRiderOfOffer).toHaveBeenCalledTimes(2);
      expect(mockRemindRiderOfOffer).toHaveBeenLastCalledWith(
        'order-123',
        60000,
      );

      act(() => {
        tree.unmount();
      });

      // M7: unmount triggers stopAll, which cancels notification for the reminded offer
      expect(mockCancelOfferReminder).toHaveBeenCalledWith('order-123');
    });
  });

  describe('AC-5: 409 OFFER_HAS_ENDED error handling', () => {
    it('drops offer immediately, alerts "This offer has ended", refetches and does not retry on 409 accept error', async () => {
      const testOffer: Order = {
        id: 'order-ended-1',
        offeredAt: '2026-10-26T12:00:00.000Z',
      } as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      mockGetNewOrders.mockClear();

      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual([
        'order-ended-1',
      ]);

      // Accept fails with 409 OFFER_HAS_ENDED
      mockAcceptOrder.mockRejectedValueOnce(makeOfferEndedError());
      await act(async () => {
        hookResult?.acceptOrderFn('order-ended-1');
        await Promise.resolve();
      });

      // Offer dropped from list immediately
      expect(hookResult?.dataSourceNew).toEqual([]);

      // Alert shown: "This offer has ended"
      expect(alertSpy).toHaveBeenCalledWith('This offer has ended');

      // Refetches list once
      expect(mockGetNewOrders).toHaveBeenCalledTimes(1);

      // Advance timers: no retry occurs
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
      });
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);

      act(() => {
        tree.unmount();
      });
    });

    it('drops offer immediately, alerts "This offer has ended", refetches and does not retry on 409 decline error', async () => {
      const testOffer: Order = {
        id: 'order-ended-2',
        offeredAt: '2026-10-26T12:00:00.000Z',
      } as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      mockGetNewOrders.mockClear();

      // Decline fails with 409 OFFER_HAS_ENDED
      mockDeclineOrder.mockRejectedValueOnce(makeOfferEndedError());
      await act(async () => {
        hookResult?.declineOrderFn('order-ended-2');
        await Promise.resolve();
      });

      expect(hookResult?.dataSourceNew).toEqual([]);
      expect(alertSpy).toHaveBeenCalledWith('This offer has ended');
      expect(mockGetNewOrders).toHaveBeenCalledTimes(1);

      act(() => {
        tree.unmount();
      });
    });

    it('dropEndedOffer removes the ended offer from [QueryKeys.newOrders] query cache (M6)', async () => {
      const offerEnded: Order = {
        id: 'order-ended-m6',
        offeredAt: '2026-10-26T12:00:00.000Z',
      } as Order;
      const offerKeep: Order = {
        id: 'order-keep-m6',
        offeredAt: '2026-10-26T12:00:05.000Z',
      } as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [offerEnded, offerKeep]);

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      // Decline offerEnded -> triggers 409 -> dropEndedOffer
      mockDeclineOrder.mockRejectedValueOnce(makeOfferEndedError());
      await act(async () => {
        hookResult?.declineOrderFn('order-ended-m6');
        await Promise.resolve();
      });

      // M6: query cache MUST be updated so offerEnded is removed while offerKeep remains
      const cachedOffers = queryClient.getQueryData<Order[]>([
        QueryKeys.newOrders,
      ]);
      expect(cachedOffers?.map(o => o.id)).toEqual(['order-keep-m6']);
      expect(
        cachedOffers?.find(o => o.id === 'order-ended-m6'),
      ).toBeUndefined();

      act(() => {
        tree.unmount();
      });
    });

    it('puts offer back on screen and shows generic error when error is NOT offer-ended', async () => {
      const testOffer: Order = {
        id: 'order-fail',
        offeredAt: '2026-10-26T12:00:00.000Z',
      } as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      // Fails with a generic 500 error
      mockAcceptOrder.mockRejectedValueOnce(new Error('Internal Server Error'));
      await act(async () => {
        hookResult?.acceptOrderFn('order-fail');
        await Promise.resolve();
      });

      // Offer is released back onto New list for manual retry
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual(['order-fail']);
      expect(alertSpy).toHaveBeenCalledWith(
        'Error accepting order',
        'Internal Server Error',
      );

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('AC-6: Offline rider holds no offers', () => {
    it('holds an empty offers list when rider is Offline', async () => {
      mockUserStatus = UserStatus.Offline;
      const testOffer: Order = { id: 'order-123' } as Order;
      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      // Offline rider's screen holds no offers
      expect(hookResult?.dataSourceNew).toEqual([]);

      act(() => {
        tree.unmount();
      });
    });

    it('clears offers when rider transitions from Online to Offline', async () => {
      mockUserStatus = UserStatus.Online;
      const testOffer: Order = { id: 'order-123' } as Order;
      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual(['order-123']);

      // Rider goes Offline
      mockUserStatus = UserStatus.Offline;
      await act(async () => {
        tree.update(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
        await Promise.resolve();
      });

      expect(hookResult?.dataSourceNew).toEqual([]);

      act(() => {
        tree.unmount();
      });
    });

    it('cancels in-flight fetch and empties query cache on Offline, so Online round trip never re-tracks or auto-accepts stale cached offers (M1)', async () => {
      mockUserStatus = UserStatus.Online;
      mockDeliverySetting = OrderSetting.auto_accept;

      const preOfflineOffer: Order = {
        id: 'pre-offline-offer',
        offeredAt: '2026-10-26T12:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      // Online initially with offer in query cache
      queryClient.setQueryData([QueryKeys.newOrders], [preOfflineOffer]);

      const cancelQueriesSpy = jest.spyOn(queryClient, 'cancelQueries');

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      // Auto-accepted initially
      expect(mockAcceptOrder).toHaveBeenCalledWith('pre-offline-offer');
      mockAcceptOrder.mockClear();

      // Rider goes Offline
      mockUserStatus = UserStatus.Offline;
      await act(async () => {
        tree.update(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
        // Wait for cancelQueries and .then() to finish emptying the cache
        await Promise.resolve();
      });

      // M1: In-flight queries cancelled, and cache emptied
      expect(cancelQueriesSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.newOrders],
      });
      expect(hookResult?.dataSourceNew).toEqual([]);
      expect(queryClient.getQueryData([QueryKeys.newOrders])).toEqual([]);

      // Rider goes back Online
      mockUserStatus = UserStatus.Online;
      await act(async () => {
        tree.update(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
        await Promise.resolve();
      });

      // M1: Cached preOfflineOffer must NOT be re-tracked or auto-accepted!
      expect(mockAcceptOrder).not.toHaveBeenCalledWith('pre-offline-offer');
      expect(hookResult?.dataSourceNew).toEqual([]);

      const freshOnlineOffer: Order = {
        id: 'fresh-online-offer',
        offeredAt: '2026-10-26T12:05:00.000Z',
        phoneClock: { offeredAt: 150000, expiresAt: 210000 },
      } as Order;

      // Now the fresh fetch lands from backend
      mockGetNewOrders.mockResolvedValueOnce([freshOnlineOffer]);
      await act(async () => {
        await hookResult?.refetchNew();
        jest.runOnlyPendingTimers();
        await Promise.resolve();
      });

      // Only the fresh offer is accepted and tracked
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith('fresh-online-offer');
      expect(mockAcceptOrder).not.toHaveBeenCalledWith('pre-offline-offer');

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('Row 60 clauses: claim deduplication, failed send recovery, and unmount', () => {
    it('sends acceptOrder at most once when acceptOrderFn is called multiple times', async () => {
      queryClient.setQueryData([QueryKeys.newOrders], [{ id: 'order-123' }]);
      let hookResult: ReturnType<typeof useHomeOrders> | undefined;

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      // Tap accept twice in rapid succession
      await act(async () => {
        hookResult?.acceptOrderFn('order-123');
        hookResult?.acceptOrderFn('order-123');
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith('order-123');

      act(() => {
        tree.unmount();
      });
    });

    it('sends declineOrder at most once when declineOrderFn is called multiple times', async () => {
      queryClient.setQueryData([QueryKeys.newOrders], [{ id: 'order-123' }]);
      let hookResult: ReturnType<typeof useHomeOrders> | undefined;

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      // Tap decline twice
      await act(async () => {
        hookResult?.declineOrderFn('order-123');
        hookResult?.declineOrderFn('order-123');
        await Promise.resolve();
      });

      expect(mockDeclineOrder).toHaveBeenCalledTimes(1);
      expect(mockDeclineOrder).toHaveBeenCalledWith('order-123');

      act(() => {
        tree.unmount();
      });
    });

    it('stops all timers on unmount', async () => {
      queryClient.setQueryData([QueryKeys.newOrders], [{ id: 'order-123' }]);

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => {}} />
          </QueryClientProvider>,
        );
      });

      expect(jest.getTimerCount()).toBeGreaterThan(0);

      act(() => {
        tree.unmount();
      });

      act(() => {
        jest.advanceTimersByTime(120000);
      });

      expect(mockDeclineOrder).not.toHaveBeenCalled();
      expect(mockAcceptOrder).not.toHaveBeenCalled();
    });

    it('does not re-show forgotten offer A when offer B send fails before a new fetch lands', async () => {
      mockGetNewOrders.mockReturnValue(new Promise(() => {}));

      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [{ id: 'order-A' }, { id: 'order-B' }],
      );

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual([
        'order-A',
        'order-B',
      ]);

      mockAcceptOrder.mockResolvedValueOnce({});
      await act(async () => {
        hookResult?.acceptOrderFn('order-A');
        await Promise.resolve();
      });

      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual(['order-B']);

      mockAcceptOrder.mockRejectedValueOnce(new Error('Network error for B'));
      await act(async () => {
        hookResult?.acceptOrderFn('order-B');
        await Promise.resolve();
      });

      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual(['order-B']);

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('AC-5 at most once across paths (spec 0003, AC-5, Decision 58.16)', () => {
    it('skips accepting an offer already answered from the alert so a tap in the app sends no second request', async () => {
      const orderId = 'order-answered-alert-acc';
      const offeredAt = '2026-10-26T10:00:00.000Z';
      markOfferAnswered(offerKeyOf(orderId, offeredAt));

      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [{ id: orderId, offeredAt }],
      );

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      // Tap accept in the app
      await act(async () => {
        hookResult?.acceptOrderFn(orderId);
      });

      // No second request is sent
      expect(mockAcceptOrder).not.toHaveBeenCalled();

      act(() => {
        tree.unmount();
      });
    });

    it('skips declining an offer already answered from the alert so a tap in the app sends no second request', async () => {
      const orderId = 'order-answered-alert-dec';
      const offeredAt = '2026-10-26T10:05:00.000Z';
      markOfferAnswered(offerKeyOf(orderId, offeredAt));

      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [{ id: orderId, offeredAt }],
      );

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      // Tap decline in the app
      await act(async () => {
        hookResult?.declineOrderFn(orderId);
      });

      // No request is sent
      expect(mockDeclineOrder).not.toHaveBeenCalled();

      act(() => {
        tree.unmount();
      });
    });

    it('skips auto-accepting an offer already answered from the alert', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const orderId = 'order-answered-alert-auto';
      const offeredAt = '2026-10-26T10:10:00.000Z';
      markOfferAnswered(offerKeyOf(orderId, offeredAt));

      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [{ id: orderId, offeredAt }],
      );

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => {}} />
          </QueryClientProvider>,
        );
      });

      expect(mockAcceptOrder).not.toHaveBeenCalled();

      act(() => {
        tree.unmount();
      });
    });

    it('decision 58.16: a later re-offer of the same delivery with a new offeredAt is still answerable', async () => {
      const orderId = 'order-reoffer-1';
      const firstOfferedAt = '2026-10-26T10:00:00.000Z';
      const secondOfferedAt = '2026-10-26T10:30:00.000Z';

      // First offer was answered from alert
      markOfferAnswered(offerKeyOf(orderId, firstOfferedAt));

      // Same delivery arrives later with a new offer time
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [{ id: orderId, offeredAt: secondOfferedAt }],
      );

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost
              onRender={h => {
                hookResult = h;
              }}
            />
          </QueryClientProvider>,
        );
      });

      // Answering the re-offered delivery works and sends the request
      await act(async () => {
        hookResult?.acceptOrderFn(orderId);
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith(orderId);

      act(() => {
        tree.unmount();
      });
    });
  });
});
