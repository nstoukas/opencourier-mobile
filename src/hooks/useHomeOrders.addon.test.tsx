import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderSetting, OrderStatus } from '@app/types/enums';
import { Order, StackStop, UserStatus } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import { OFFER_REMINDER_EVERY_MS } from '@app/utilities/constants';
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

const mockRemindRiderOfOffer = jest.fn();
const mockCancelOfferReminder = jest.fn();
jest.mock('@app/services/offerReminder', () => ({
  remindRiderOfOffer: (...args: any[]) => mockRemindRiderOfOffer(...args),
  cancelOfferReminder: (...args: any[]) => mockCancelOfferReminder(...args),
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

describe('useHomeOrders.addon (spec 0048, row 81, AC-7, AC-8, cross check 2)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;

  const sampleStops: StackStop[] = [
    { deliveryId: 'job-held-1', stop: 'PICKUP' },
    { deliveryId: 'addon-offer-1', stop: 'PICKUP' },
    { deliveryId: 'job-held-1', stop: 'DROPOFF' },
    { deliveryId: 'addon-offer-1', stop: 'DROPOFF' },
  ];

  const heldJob: Order = {
    id: 'job-held-1',
    status: OrderStatus.dispatched,
    totalCompensation: 450,
  } as Order;

  const addOnOffer: Order = {
    id: 'addon-offer-1',
    addOn: true,
    offeredAt: '2026-11-22T10:00:00.000Z',
    phoneClock: { offeredAt: 100000, expiresAt: 220000 },
    totalCompensation: 325,
    extraKm: 1.5,
    extraMinutes: 5,
    stackStops: sampleStops,
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

  describe('AC-8: Auto-accept skips add-on offers', () => {
    it('does NOT automatically accept offers that have addOn: true', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      queryClient.setQueryData([QueryKeys.inProgressOrders], [heldJob]);
      queryClient.setQueryData([QueryKeys.newOrders], [addOnOffer]);

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

      // The add-on was NOT auto-accepted
      expect(mockAcceptOrder).not.toHaveBeenCalled();

      // But remains visible in dataSourceNew
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual([
        'addon-offer-1',
      ]);

      act(() => {
        tree.unmount();
      });
    });

    it('plays offer sound for add-on offer even when auto_accept is enabled', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      queryClient.setQueryData([QueryKeys.inProgressOrders], [heldJob]);
      queryClient.setQueryData([QueryKeys.newOrders], [addOnOffer]);

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => {}} />
          </QueryClientProvider>,
        );
        await Promise.resolve();
      });

      // An add-on rings once even for auto-accept rider, who must answer by hand
      expect(mockPlayOfferSound).toHaveBeenCalledTimes(1);

      act(() => {
        tree.unmount();
      });
    });

    it('auto-accepts single order while skipping add-on order in the same fetch', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const singleOffer: Order = {
        id: 'single-1',
        offeredAt: '2026-11-22T10:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      queryClient.setQueryData([QueryKeys.inProgressOrders], [heldJob]);
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [singleOffer, addOnOffer],
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

  describe('cross check 2: Calm add-on reminders while carrying food', () => {
    it('skips remindRiderOfOffer when add-on is calm (held job is picked up)', async () => {
      const now = Date.now();
      const pickedUpJob: Order = {
        ...heldJob,
        status: OrderStatus.picked_up,
      };

      const calmAddOn: Order = {
        ...addOnOffer,
        offeredAt: new Date(now).toISOString(),
        phoneClock: { offeredAt: now, expiresAt: null }, // no deadline
      };

      queryClient.setQueryData([QueryKeys.inProgressOrders], [pickedUpJob]);
      queryClient.setQueryData([QueryKeys.newOrders], [calmAddOn]);

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => {}} />
          </QueryClientProvider>,
        );
      });

      // Advance by the reminder interval (30s)
      await act(async () => {
        jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
      });

      // Carrying food: never rings again, stays quiet on its card
      expect(mockRemindRiderOfOffer).not.toHaveBeenCalled();

      act(() => {
        tree.unmount();
      });
    });

    it('triggers remindRiderOfOffer when add-on is NOT calm (held job before pickup)', async () => {
      const now = Date.now();
      const dispatchedJob: Order = {
        ...heldJob,
        status: OrderStatus.dispatched,
      };

      const activeAddOn: Order = {
        ...addOnOffer,
        offeredAt: new Date(now).toISOString(),
        phoneClock: { offeredAt: now, expiresAt: null }, // no deadline
      };

      queryClient.setQueryData([QueryKeys.inProgressOrders], [dispatchedJob]);
      queryClient.setQueryData([QueryKeys.newOrders], [activeAddOn]);

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => {}} />
          </QueryClientProvider>,
        );
      });

      // Advance by the reminder interval (30s)
      await act(async () => {
        jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
      });

      // Not carrying food yet: reminder is sent as normal
      expect(mockRemindRiderOfOffer).toHaveBeenCalledTimes(1);
      expect(mockRemindRiderOfOffer).toHaveBeenCalledWith(
        'addon-offer-1',
        OFFER_REMINDER_EVERY_MS,
      );

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('AC-7: Accept and decline an add-on offer', () => {
    it('accepting an add-on calls acceptOrder for that offer alone (server joins them under new group)', async () => {
      queryClient.setQueryData([QueryKeys.inProgressOrders], [heldJob]);
      queryClient.setQueryData([QueryKeys.newOrders], [addOnOffer]);

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
        hookResult?.acceptOrderFn('addon-offer-1');
      });

      // Accepts the add-on order alone without partnerId (single offer on wire)
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'addon-offer-1',
        partnerId: undefined,
        automatic: false,
      });

      // Add-on is removed from dataSourceNew
      expect(hookResult?.dataSourceNew).toEqual([]);

      act(() => {
        tree.unmount();
      });
    });

    it('declining an add-on calls declineOrder for that offer alone, leaving held job completely untouched', async () => {
      queryClient.setQueryData([QueryKeys.inProgressOrders], [heldJob]);
      queryClient.setQueryData([QueryKeys.newOrders], [addOnOffer]);

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
        hookResult?.declineOrderFn('addon-offer-1');
      });

      // Declines the add-on order alone
      expect(mockDeclineOrder).toHaveBeenCalledTimes(1);
      expect(mockDeclineOrder).toHaveBeenCalledWith('addon-offer-1');

      // Add-on is removed from dataSourceNew
      expect(hookResult?.dataSourceNew).toEqual([]);

      // Held job in progress is still there and untouched
      expect(hookResult?.dataSourceInProgress).toEqual([heldJob]);

      act(() => {
        tree.unmount();
      });
    });
  });
});
