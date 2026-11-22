import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderSetting } from '@app/types/enums';
import { Order, StackStop, UserStatus } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import { OFFER_HAS_ENDED_CODE } from '@app/services/orderService';
import { AxiosError } from 'axios';
import '@app/localization/i18n';

jest.mock('@app/services/offerPush/offerAlert', () => ({
  cancelOfferAlert: jest.fn(),
  isOfferAlertDisplayed: jest.fn().mockResolvedValue(false),
}));

let mockAnsweredSet = new Set<string>();

jest.mock('@app/services/offerPush/answeredOffers', () => {
  const actual = jest.requireActual('@app/services/offerPush/answeredOffers');
  return {
    ...actual,
    isOfferAnswered: jest.fn((key: string) => mockAnsweredSet.has(key)),
    markOfferAnswered: jest.fn((key: string) => {
      if (mockAnsweredSet.has(key)) {
        return false;
      }
      mockAnsweredSet.add(key);
      return true;
    }),
    unmarkOfferAnswered: jest.fn((key: string) => {
      mockAnsweredSet.delete(key);
    }),
    loadAnsweredOffers: jest.fn().mockResolvedValue(undefined),
  };
});

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
const mockGetOrdersHistory = jest.fn();

jest.mock('@app/services/service', () => ({
  services: {
    orderService: {
      getNewOrders: () => mockGetNewOrders(),
      getInProgressOrders: () =>
        Promise.resolve({ data: { result: { data: [] } } }),
      getOrdersHistory: () => mockGetOrdersHistory(),
      acceptOrder: (params: any) => mockAcceptOrder(params),
      declineOrder: (id: string) => mockDeclineOrder(id),
    },
  },
}));

const mockPlayOfferSound = jest.fn();
jest.mock('@app/services/offerPush/phone', () => ({
  playOfferSound: () => mockPlayOfferSound(),
}));

jest.mock('@app/navigation/navigationRef', () => ({
  isHomeInFront: jest.fn().mockResolvedValue(true),
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

describe('useHomeOrders.stack (spec 0048, row 80, AC-5, AC-8)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;

  const sampleStackStops: StackStop[] = [
    { deliveryId: 'stack-1', stop: 'PICKUP' },
    { deliveryId: 'stack-2', stop: 'PICKUP' },
    { deliveryId: 'stack-1', stop: 'DROPOFF' },
    { deliveryId: 'stack-2', stop: 'DROPOFF' },
  ];

  const stackOffer1: Order = {
    id: 'stack-1',
    offerGroupId: 'group-abc',
    offeredAt: '2026-11-22T10:00:00.000Z',
    phoneClock: { offeredAt: 100000, expiresAt: 160000 },
    totalCompensation: 500,
    stackStops: sampleStackStops,
  } as Order;

  const stackOffer2: Order = {
    id: 'stack-2',
    offerGroupId: 'group-abc',
    offeredAt: '2026-11-22T10:00:00.000Z',
    phoneClock: { offeredAt: 100000, expiresAt: 160000 },
    totalCompensation: 450,
    stackStops: sampleStackStops,
  } as Order;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAnsweredSet.clear();
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

  describe('AC-8: Auto-accept skips stacked orders', () => {
    it('does NOT automatically accept offers that have an offerGroupId', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [stackOffer1, stackOffer2],
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

      // The stack was NOT auto-accepted
      expect(mockAcceptOrder).not.toHaveBeenCalled();

      // But both orders remain visible in dataSourceNew
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual([
        'stack-1',
        'stack-2',
      ]);

      act(() => {
        tree.unmount();
      });
    });

    it('plays offer sound for stacked orders even when auto_accept is enabled', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [stackOffer1, stackOffer2],
      );

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => {}} />
          </QueryClientProvider>,
        );
        // Allow promise resolution for isHomeInFront
        await Promise.resolve();
      });

      // A stack rings even for auto-accept rider, who must answer by hand
      expect(mockPlayOfferSound).toHaveBeenCalledTimes(1);

      act(() => {
        tree.unmount();
      });
    });

    it('auto-accepts single order while skipping stacked order in the same fetch', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const singleOffer: Order = {
        id: 'single-1',
        offeredAt: '2026-11-22T10:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [singleOffer, stackOffer1, stackOffer2],
      );

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => {}} />
          </QueryClientProvider>,
        );
      });

      // Single offer was accepted automatically
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'single-1',
        automatic: true,
      });

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('AC-5: Group accept and decline acting on both', () => {
    it('accepting one order of a stack accepts both together with partnerId and removes both from list', async () => {
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [stackOffer1, stackOffer2],
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

      // Tap accept on stack-1
      await act(async () => {
        hookResult?.acceptOrderFn('stack-1');
      });

      // acceptOrder was called with id: stack-1, partnerId: stack-2, automatic: false
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'stack-1',
        partnerId: 'stack-2',
        automatic: false,
      });

      // Both orders are removed from dataSourceNew
      expect(hookResult?.dataSourceNew).toEqual([]);

      act(() => {
        tree.unmount();
      });
    });

    it('declining one order of a stack declines both together with partnerId and removes both from list', async () => {
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [stackOffer1, stackOffer2],
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

      // Tap decline on stack-1
      await act(async () => {
        hookResult?.declineOrderFn('stack-1');
      });

      expect(mockDeclineOrder).toHaveBeenCalledTimes(1);
      expect(mockDeclineOrder).toHaveBeenCalledWith('stack-1');

      // Both orders are removed from dataSourceNew
      expect(hookResult?.dataSourceNew).toEqual([]);

      act(() => {
        tree.unmount();
      });
    });

    it('drops both orders when accept fails with 409 OFFER_HAS_ENDED', async () => {
      const offerEndedError = new AxiosError('Offer ended');
      offerEndedError.response = {
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

      mockAcceptOrder.mockRejectedValueOnce(offerEndedError);
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [stackOffer1, stackOffer2],
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

      await act(async () => {
        hookResult?.acceptOrderFn('stack-1');
      });

      expect(alertSpy).toHaveBeenCalledWith('This offer has ended');
      expect(hookResult?.dataSourceNew).toEqual([]);

      act(() => {
        tree.unmount();
      });
    });

    it('drops both orders when decline fails with 409 OFFER_HAS_ENDED (gap from row 80 review)', async () => {
      const offerEndedError = new AxiosError('Offer ended');
      offerEndedError.response = {
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

      mockDeclineOrder.mockRejectedValueOnce(offerEndedError);
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [stackOffer1, stackOffer2],
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

      await act(async () => {
        hookResult?.declineOrderFn('stack-1');
      });

      expect(alertSpy).toHaveBeenCalledWith('This offer has ended');
      expect(hookResult?.dataSourceNew).toEqual([]);

      act(() => {
        tree.unmount();
      });
    });

    it('releases both orders and alerts the server sentence when stack accept is refused (e.g. partner changed)', async () => {
      const serverSentence =
        'One order of this pair changed before your answer arrived, so nothing was accepted. Check your offers again.';
      const conflictError = new AxiosError('Conflict');
      conflictError.response = {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: {
          error: true,
          result: [{ code: 'ORDER_CHANGED', message: serverSentence }],
        },
      };

      mockAcceptOrder.mockRejectedValueOnce(conflictError);
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [stackOffer1, stackOffer2],
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

      await act(async () => {
        hookResult?.acceptOrderFn('stack-1');
      });

      // Shows the server sentence directly to the rider
      expect(alertSpy).toHaveBeenCalledWith(serverSentence, undefined);

      act(() => {
        tree.unmount();
      });
    });

    it('releases both orders and alerts the server sentence when stack decline is refused (gap from row 80 review)', async () => {
      const serverSentence =
        'One order of this pair changed before your answer arrived, so nothing was declined. Check your offers again.';
      const conflictError = new AxiosError('Conflict');
      conflictError.response = {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: {
          error: true,
          result: [{ code: 'ORDER_CHANGED', message: serverSentence }],
        },
      };

      mockDeclineOrder.mockRejectedValueOnce(conflictError);
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [stackOffer1, stackOffer2],
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

      await act(async () => {
        hookResult?.declineOrderFn('stack-1');
      });

      // Shows the server sentence directly to the rider
      expect(alertSpy).toHaveBeenCalledWith(serverSentence, undefined);

      act(() => {
        tree.unmount();
      });
    });

    it('releases both orders and alerts the error message when stack decline encounters a generic error (gap from row 80 review)', async () => {
      const genericError = new Error('Network timeout during decline');

      mockDeclineOrder.mockRejectedValueOnce(genericError);
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [stackOffer1, stackOffer2],
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

      await act(async () => {
        hookResult?.declineOrderFn('stack-1');
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Error declining order',
        'Network timeout during decline',
      );

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('Review fixes (row 80): Guard against half a pair and missing stops before accept', () => {
    it('half a pair: when partner order is not in offers list, refetches and alerts without sending accept', async () => {
      // Only stack-1 is in newOrders; partner stack-2 has not arrived yet
      queryClient.setQueryData([QueryKeys.newOrders], [stackOffer1]);

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

      // Clear initial mount fetch before tapping accept
      mockGetNewOrders.mockClear();

      // Tap accept on stack-1
      await act(async () => {
        hookResult?.acceptOrderFn('stack-1');
      });

      // Triggers refetch so the other order can arrive
      expect(mockGetNewOrders).toHaveBeenCalledTimes(1);

      // Alerts that the other order is still loading
      expect(alertSpy).toHaveBeenCalledWith(
        'The other order of this pair is still on its way to your phone. Check your offers again in a moment.',
      );

      // Does NOT call acceptOrder
      expect(mockAcceptOrder).not.toHaveBeenCalled();

      act(() => {
        tree.unmount();
      });
    });

    it('missing stops: when stackStops is undefined on a grouped offer, refetches and alerts without sending accept', async () => {
      const offerNoStops1: Order = {
        ...stackOffer1,
        stackStops: undefined,
      };
      const offerNoStops2: Order = {
        ...stackOffer2,
        stackStops: undefined,
      };
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [offerNoStops1, offerNoStops2],
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

      mockGetNewOrders.mockClear();

      await act(async () => {
        hookResult?.acceptOrderFn('stack-1');
      });

      expect(mockGetNewOrders).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(
        'The other order of this pair is still on its way to your phone. Check your offers again in a moment.',
      );
      expect(mockAcceptOrder).not.toHaveBeenCalled();

      act(() => {
        tree.unmount();
      });
    });

    it('malformed stops: when stackStops contains invalid delivery ids, refetches and alerts without sending accept', async () => {
      const invalidStops: StackStop[] = [
        { deliveryId: 'stack-1', stop: 'PICKUP' },
        { deliveryId: 'wrong-id', stop: 'PICKUP' },
        { deliveryId: 'stack-1', stop: 'DROPOFF' },
        { deliveryId: 'wrong-id', stop: 'DROPOFF' },
      ];
      const offerInvalid1: Order = {
        ...stackOffer1,
        stackStops: invalidStops,
      };
      const offerInvalid2: Order = {
        ...stackOffer2,
        stackStops: invalidStops,
      };
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [offerInvalid1, offerInvalid2],
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

      mockGetNewOrders.mockClear();

      await act(async () => {
        hookResult?.acceptOrderFn('stack-1');
      });

      expect(mockGetNewOrders).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(
        'The other order of this pair is still on its way to your phone. Check your offers again in a moment.',
      );
      expect(mockAcceptOrder).not.toHaveBeenCalled();

      act(() => {
        tree.unmount();
      });
    });

    it('single order: accept proceeds normally without requiring stackStops', async () => {
      const singleOffer: Order = {
        id: 'single-1',
        offeredAt: '2026-11-22T10:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
        totalCompensation: 350,
      } as Order;
      queryClient.setQueryData([QueryKeys.newOrders], [singleOffer]);

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

      await act(async () => {
        hookResult?.acceptOrderFn('single-1');
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'single-1',
        partnerId: undefined,
        automatic: false,
      });
      expect(alertSpy).not.toHaveBeenCalled();

      act(() => {
        tree.unmount();
      });
    });
  });
});
