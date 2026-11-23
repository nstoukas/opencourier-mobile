import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderSetting, OrderStatus } from '@app/types/enums';
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
  clearDeclineFailed,
  isDeclineFailed,
  isOfferAnswered,
  loadAnsweredOffers,
  markDeclineFailed,
  markOfferAnswered,
  offerKeyOf,
} from '@app/services/offerPush/answeredOffers';
import { isOfferAlertDisplayed } from '@app/services/offerPush/offerAlert';
import { answerOffer } from '@app/services/offerPush/answerOffer';

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
const mockGetInProgressOrders = jest.fn();
const mockGetOrdersHistory = jest.fn();

jest.mock('@app/services/service', () => ({
  services: {
    orderService: {
      getNewOrders: () => mockGetNewOrders(),
      getInProgressOrders: () => mockGetInProgressOrders(),
      getOrdersHistory: () => mockGetOrdersHistory(),
      acceptOrder: (params: { id: string; automatic?: boolean }) =>
        mockAcceptOrder(params),
      declineOrder: (id: string) => mockDeclineOrder(id),
    },
  },
}));

const mockAnnounceAutoAccept = jest.fn();
jest.mock('@app/services/offerPush/autoAccepted', () => ({
  announceAutoAccept: (...args: any[]) => mockAnnounceAutoAccept(...args),
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

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAnsweredSet.clear();
    await clearDeclineFailed();
    (loadAnsweredOffers as jest.Mock).mockResolvedValue(undefined);
    mockGetNewOrders.mockReturnValue(new Promise(() => {}));
    mockGetInProgressOrders.mockResolvedValue([]);
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
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-123',
        automatic: true,
      });
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
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-123',
        automatic: true,
      });

      // A second offer id arrives and is accepted once too
      mockGetNewOrders.mockResolvedValueOnce([{ ...testOffer }, testOffer2]);
      await act(async () => {
        await hookResult?.refetchNew();
        jest.runOnlyPendingTimers();
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(2);
      expect(mockAcceptOrder).toHaveBeenLastCalledWith({
        id: 'order-456',
        automatic: true,
      });

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
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-123',
        automatic: true,
      });

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
      // Row 130: order is in handAnswerIds so Home shows it as a card
      expect(hookResult?.handAnswerIds).toEqual(['order-123']);

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

    it('auto-accept sends automatic: true and calls announceAutoAccept once per offer with restaurant name (spec 0020, AC-11, AC-12)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      mockAcceptOrder.mockResolvedValueOnce({});

      const testOffer: Order = {
        id: 'order-auto-1',
        offeredAt: '2026-10-26T12:00:00.000Z',
        pickupBusinessName: 'Souvlaki Palace',
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
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-auto-1',
        automatic: true,
      });

      expect(mockAnnounceAutoAccept).toHaveBeenCalledTimes(1);
      expect(mockAnnounceAutoAccept).toHaveBeenCalledWith(
        'order-auto-1',
        'Souvlaki Palace',
        // Not a pair (decision 128.0)
        false,
      );

      act(() => {
        tree.unmount();
      });
    });

    it('auto-accept falls back to generic text when restaurant name is missing, and tap accept sends automatic: false without announceAutoAccept', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      mockAcceptOrder.mockResolvedValueOnce({});

      const offerNoName: Order = {
        id: 'order-auto-no-name',
        offeredAt: '2026-10-26T12:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [offerNoName]);

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => {}} />
          </QueryClientProvider>,
        );
        await Promise.resolve();
      });

      expect(mockAnnounceAutoAccept).toHaveBeenCalledWith(
        'order-auto-no-name',
        'a new order',
        // Not a pair (decision 128.0)
        false,
      );

      act(() => {
        tree.unmount();
      });

      // Now manual mode: tap accept sends automatic: false and never calls announceAutoAccept
      mockDeliverySetting = OrderSetting.manual;
      mockAcceptOrder.mockClear();
      mockAnnounceAutoAccept.mockClear();
      mockAcceptOrder.mockResolvedValueOnce({});

      const manualOffer: Order = {
        id: 'order-manual-tap',
        offeredAt: '2026-10-26T12:01:00.000Z',
        pickupBusinessName: 'Pizza Roma',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [manualOffer]);

      let hookResult: ReturnType<typeof useHomeOrders> | undefined;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={h => (hookResult = h)} />
          </QueryClientProvider>,
        );
        await Promise.resolve();
      });

      expect(mockAcceptOrder).not.toHaveBeenCalled();

      await act(async () => {
        hookResult?.acceptOrderFn('order-manual-tap');
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-manual-tap',
        automatic: false,
      });
      expect(mockAnnounceAutoAccept).not.toHaveBeenCalled();

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

    it("row 61's 30s reminder (remindRiderOfOffer) is NOT called while isOfferAlertDisplayed(orderId) is true, and IS called when false", async () => {
      mockDeliverySetting = OrderSetting.manual;
      const now = Date.now();
      const testOffer: Order = {
        id: 'order-reminder-check',
        offeredAt: new Date(now).toISOString(),
        phoneClock: { offeredAt: now, expiresAt: null },
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

      // 1. When isOfferAlertDisplayed is true (alert is ringing): reminder is skipped
      (isOfferAlertDisplayed as jest.Mock).mockResolvedValue(true);

      await act(async () => {
        jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
        await Promise.resolve();
      });

      expect(mockRemindRiderOfOffer).not.toHaveBeenCalled();

      // 2. When isOfferAlertDisplayed is false (alert is not displayed): reminder runs
      (isOfferAlertDisplayed as jest.Mock).mockResolvedValue(false);

      await act(async () => {
        jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
        await Promise.resolve();
      });

      expect(mockRemindRiderOfOffer).toHaveBeenCalledTimes(1);
      expect(mockRemindRiderOfOffer).toHaveBeenCalledWith(
        'order-reminder-check',
        60000,
      );

      act(() => {
        tree.unmount();
      });
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
        'Something went wrong. Try again in a minute.',
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
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'pre-offline-offer',
        automatic: true,
      });
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
      expect(mockAcceptOrder).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pre-offline-offer' }),
      );
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
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'fresh-online-offer',
        automatic: true,
      });
      expect(mockAcceptOrder).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pre-offline-offer' }),
      );

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
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-123',
        automatic: false,
      });

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
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: orderId,
        automatic: false,
      });

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('Home writes the answered list on answer and recovers on error (Job B4)', () => {
    it('acceptOrder in app marks the offer answered with key deliveryId@offeredAt, so a following answerOffer sends nothing', async () => {
      const orderId = 'order-home-acc';
      const offeredAt = '2026-10-26T10:00:00.000Z';
      const key = offerKeyOf(orderId, offeredAt);

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

      // Answer in the app via accept
      await act(async () => {
        hookResult?.acceptOrderFn(orderId);
      });

      // Must be marked answered in shared list
      expect(isOfferAnswered(key)).toBe(true);

      // A following answerOffer from the alert for the same offer sends nothing
      const outcome = await answerOffer(
        { deliveryId: orderId, offeredAt },
        'accept',
      );
      expect(outcome).toBe('already-answered');

      act(() => {
        tree.unmount();
      });
    });

    it('declineOrder in app marks the offer answered with key deliveryId@offeredAt, so a following answerOffer sends nothing', async () => {
      const orderId = 'order-home-dec';
      const offeredAt = '2026-10-26T10:05:00.000Z';
      const key = offerKeyOf(orderId, offeredAt);

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

      // Answer in the app via decline
      await act(async () => {
        hookResult?.declineOrderFn(orderId);
      });

      expect(isOfferAnswered(key)).toBe(true);

      const outcome = await answerOffer(
        { deliveryId: orderId, offeredAt },
        'decline',
      );
      expect(outcome).toBe('already-answered');

      act(() => {
        tree.unmount();
      });
    });

    it('auto-accept marks the offer answered with key deliveryId@offeredAt, so a following answerOffer sends nothing', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const orderId = 'order-home-auto';
      const offeredAt = '2026-10-26T10:10:00.000Z';
      const key = offerKeyOf(orderId, offeredAt);

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

      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: orderId,
        automatic: true,
      });
      expect(isOfferAnswered(key)).toBe(true);

      const outcome = await answerOffer(
        { deliveryId: orderId, offeredAt },
        'accept',
      );
      expect(outcome).toBe('already-answered');

      act(() => {
        tree.unmount();
      });
    });

    it('a failed non-409 send unmarks the offer so the rider can try again', async () => {
      const orderIdFail = 'order-home-fail';
      const offeredAtFail = '2026-10-26T10:20:00.000Z';
      const keyFail = offerKeyOf(orderIdFail, offeredAtFail);

      mockAcceptOrder.mockRejectedValueOnce(
        new AxiosError('Internal Server Error'),
      );

      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [{ id: orderIdFail, offeredAt: offeredAtFail }],
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
        hookResult?.acceptOrderFn(orderIdFail);
      });

      // Failed non-409 send unmarks it so the rider can try again
      expect(isOfferAnswered(keyFail)).toBe(false);

      act(() => {
        tree.unmount();
      });
    });

    it('a 409 OFFER_HAS_ENDED failure keeps the offer marked answered', async () => {
      const orderId409 = 'order-home-409';
      const offeredAt409 = '2026-10-26T10:25:00.000Z';
      const key409 = offerKeyOf(orderId409, offeredAt409);

      mockAcceptOrder.mockRejectedValueOnce(makeOfferEndedError());

      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [{ id: orderId409, offeredAt: offeredAt409 }],
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
        hookResult?.acceptOrderFn(orderId409);
      });

      // 409 keeps it marked
      expect(isOfferAnswered(key409)).toBe(true);

      const outcome = await answerOffer(
        { deliveryId: orderId409, offeredAt: offeredAt409 },
        'accept',
      );
      expect(outcome).toBe('already-answered');

      act(() => {
        tree.unmount();
      });
    });

    it('invalidates inProgressOrders before user on successful accept (spec 0018, AC-10)', async () => {
      const orderId = 'order-invalidate-order';
      queryClient.setQueryData([QueryKeys.newOrders], [{ id: orderId }]);

      const invalidateCalls: string[] = [];
      const invalidateSpy = jest
        .spyOn(queryClient, 'invalidateQueries')
        .mockImplementation(async (options: any) => {
          if (options?.queryKey?.[0]) {
            invalidateCalls.push(options.queryKey[0]);
          }
          return undefined;
        });

      mockAcceptOrder.mockResolvedValueOnce({});

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
        hookResult?.acceptOrderFn(orderId);
        await Promise.resolve();
      });

      // Assert that inProgressOrders was invalidated before user
      const inProgressIndex = invalidateCalls.indexOf(
        QueryKeys.inProgressOrders,
      );
      const userIndex = invalidateCalls.indexOf(QueryKeys.user);

      expect(inProgressIndex).toBeGreaterThanOrEqual(0);
      expect(userIndex).toBeGreaterThanOrEqual(0);
      expect(inProgressIndex).toBeLessThan(userIndex);

      // Also assert serverInProgress is exposed
      expect(hookResult?.serverInProgress).toBeDefined();

      invalidateSpy.mockRestore();
      act(() => {
        tree.unmount();
      });
    });

    it('no longer queries the order history (no getOrdersHistory call) (spec 0018 AC-13)', async () => {
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

      expect(mockGetOrdersHistory).not.toHaveBeenCalled();
      expect((hookResult as any)?.dataSourceHistory).toBeUndefined();
      expect((hookResult as any)?.refechHistory).toBeUndefined();

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('Row 130: A single order that auto accept could not take (hand answer)', () => {
    const makeDispatchStoppedError = () => {
      const err = new AxiosError('Dispatch stopped');
      err.response = {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: {
          error: true,
          result: [
            {
              code: 'DISPATCH_STOPPED',
              message: 'Dispatch is currently stopped',
            },
          ],
        },
      };
      return err;
    };

    it('puts single order in handAnswerIds and keeps it in dataSourceNew when automatic accept fails with a network error', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const testOffer: Order = {
        id: 'order-fail-net',
        offeredAt: '2026-11-23T10:00:00.000Z',
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
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-fail-net',
        automatic: true,
        partnerId: undefined,
      });
      // Concretely: order id is in handAnswerIds so Home renders the card
      expect(hookResult?.handAnswerIds).toEqual(['order-fail-net']);
      // Released back onto dataSourceNew for manual answering
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual([
        'order-fail-net',
      ]);

      act(() => {
        tree.unmount();
      });
    });

    it('puts single order in handAnswerIds when automatic accept fails with server refusal (409 not offer ended)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const testOffer: Order = {
        id: 'order-fail-dispatch',
        offeredAt: '2026-11-23T10:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      mockAcceptOrder.mockRejectedValueOnce(makeDispatchStoppedError());
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
      expect(hookResult?.handAnswerIds).toEqual(['order-fail-dispatch']);
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual([
        'order-fail-dispatch',
      ]);

      act(() => {
        tree.unmount();
      });
    });

    it('tries automatic accept only once: after failure, no second automatic accept is sent on later refetches', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const testOffer: Order = {
        id: 'order-fail-once',
        offeredAt: '2026-11-23T10:00:00.000Z',
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
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-fail-once',
        automatic: true,
        partnerId: undefined,
      });
      expect(hookResult?.handAnswerIds).toEqual(['order-fail-once']);

      // Refetch occurs with the same offer: phone must NOT send a second automatic accept
      mockGetNewOrders.mockResolvedValueOnce([testOffer]);
      await act(async () => {
        await hookResult?.refetchNew();
        jest.runOnlyPendingTimers();
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);

      // Advancing timer does not trigger second automatic accept
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);

      // Rider can manually accept by hand (automatic: false)
      mockAcceptOrder.mockResolvedValueOnce({});
      await act(async () => {
        hookResult?.acceptOrderFn('order-fail-once');
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(2);
      expect(mockAcceptOrder).toHaveBeenLastCalledWith({
        id: 'order-fail-once',
        automatic: false,
        partnerId: undefined,
      });

      act(() => {
        tree.unmount();
      });
    });

    it('drops single order and does not put in handAnswerIds when automatic accept encounters OFFER_HAS_ENDED', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const testOffer: Order = {
        id: 'order-ended-single',
        offeredAt: '2026-11-23T10:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      mockAcceptOrder.mockRejectedValueOnce(makeOfferEndedError());
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
      expect(alertSpy).toHaveBeenCalledWith('This offer has ended');
      // Must NOT be in handAnswerIds and NOT in dataSourceNew
      expect(hookResult?.handAnswerIds).toEqual([]);
      expect(hookResult?.dataSourceNew).toEqual([]);

      act(() => {
        tree.unmount();
      });
    });

    it('failed manual tap accept does not add order to handAnswerIds and leaves offer on screen for retry', async () => {
      mockDeliverySetting = OrderSetting.manual;
      const testOffer: Order = {
        id: 'order-manual-fail',
        offeredAt: '2026-11-23T10:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
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

      // Not accepted automatically on arrival in manual mode
      expect(mockAcceptOrder).not.toHaveBeenCalled();

      // Rider taps accept by hand, which fails with network error
      mockAcceptOrder.mockRejectedValueOnce(new Error('Network error'));
      await act(async () => {
        hookResult?.acceptOrderFn('order-manual-fail');
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-manual-fail',
        automatic: false,
        partnerId: undefined,
      });

      // Must NOT be added to handAnswerIds (only automatic failures are added)
      expect(hookResult?.handAnswerIds).toEqual([]);
      // Remains in dataSourceNew so rider can retry
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual([
        'order-manual-fail',
      ]);

      act(() => {
        tree.unmount();
      });
    });

    it('refetches new offers and invalidates inProgressOrders when automatic accept of a single order fails (decision 130.3)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const testOffer: Order = {
        id: 'order-fail-refetch',
        offeredAt: '2026-11-23T10:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      mockAcceptOrder.mockRejectedValueOnce(new Error('Network error'));
      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);
      mockGetNewOrders.mockClear();

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => undefined} />
          </QueryClientProvider>,
        );
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-fail-refetch',
        automatic: true,
        partnerId: undefined,
      });

      // Decision 130.3: when failed accept was automatic, both lists are fetched again
      // 1. inProgressOrders query is invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
      // 2. getNewOrders is called again to refetch new offers
      expect(mockGetNewOrders).toHaveBeenCalled();

      // Not retried: still no second automatic accept
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);

      invalidateSpy.mockRestore();
      act(() => {
        tree.unmount();
      });
    });

    it('when automatic accept times out but server accepted, refetch clears offer card and shows in-progress job (decision 130.3)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const testOffer: Order = {
        id: 'order-timeout-accepted',
        offeredAt: '2026-11-23T10:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      const acceptedJob: Order = {
        id: 'order-timeout-accepted',
        status: OrderStatus.dispatched,
      } as Order;

      // Initial state: offer is in newOrders, no jobs in progress
      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);
      queryClient.setQueryData([QueryKeys.inProgressOrders], []);

      // Accept times out on phone
      mockAcceptOrder.mockRejectedValueOnce(new Error('timeout'));

      // Next refetches: server has no offer, but has the job in progress
      mockGetNewOrders.mockResolvedValueOnce([]);
      mockGetInProgressOrders.mockResolvedValueOnce([acceptedJob]);

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
        jest.runOnlyPendingTimers();
        await Promise.resolve();
      });

      // Automatic accept was attempted once
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);

      // Offer card disappears (no offers in dataSourceNew)
      expect(hookResult?.dataSourceNew).toEqual([]);

      // Job shows in progress
      expect(hookResult?.serverInProgress.map(o => o.id)).toEqual([
        'order-timeout-accepted',
      ]);
      expect(hookResult?.dataSourceInProgress.map(o => o.id)).toEqual([
        'order-timeout-accepted',
      ]);

      act(() => {
        tree.unmount();
      });
    });

    it('failed manual tap accept does NOT invalidate inProgressOrders and does NOT refetch new offers (decision 130.3)', async () => {
      mockDeliverySetting = OrderSetting.manual;
      const testOffer: Order = {
        id: 'order-manual-no-refetch',
        offeredAt: '2026-11-23T10:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
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

      // Clear any mount fetches and setup spy
      mockGetNewOrders.mockClear();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      // Rider taps accept by hand, which fails with network error
      mockAcceptOrder.mockRejectedValueOnce(new Error('Network error'));
      await act(async () => {
        hookResult?.acceptOrderFn('order-manual-no-refetch');
        await Promise.resolve();
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-manual-no-refetch',
        automatic: false,
        partnerId: undefined,
      });

      // Decision 130.3: tapped accept failure does NOT trigger extra fetch of jobs or offers
      expect(invalidateSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: [QueryKeys.inProgressOrders],
        }),
      );
      expect(mockGetNewOrders).not.toHaveBeenCalled();

      // Old behaviour kept: offer stays on screen in dataSourceNew for retry
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual([
        'order-manual-no-refetch',
      ]);
      expect(hookResult?.handAnswerIds).toEqual([]);

      invalidateSpy.mockRestore();
      act(() => {
        tree.unmount();
      });
    });

    it('automatic accept failure with OFFER_HAS_ENDED does not invalidate inProgressOrders (decision 130.3)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const testOffer: Order = {
        id: 'order-ended-no-job-invalidation',
        offeredAt: '2026-11-23T10:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      mockAcceptOrder.mockRejectedValueOnce(makeOfferEndedError());
      queryClient.setQueryData([QueryKeys.newOrders], [testOffer]);

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => undefined} />
          </QueryClientProvider>,
        );
      });

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      // OFFER_HAS_ENDED drops the offer, but does not invalidate inProgressOrders
      expect(invalidateSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: [QueryKeys.inProgressOrders],
        }),
      );

      invalidateSpy.mockRestore();
      act(() => {
        tree.unmount();
      });
    });
  });

  describe('Row 131: A Decline from the alert that fails is not accepted by the phone', () => {
    // Clause 1, Clause 2, Clause 4, Point 1:
    // With auto accept on, an offer the rider declined from alert where decline failed to send
    // is NEVER accepted by the phone by itself, and shows as a card for rider to answer by hand
    // (id in handAnswerIds).
    it('with auto accept on, an offer in decline failed list is never accepted by the phone, and shows in handAnswerIds (Clause 1, Clause 2, Point 1)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const orderId = 'order-dec-failed';
      const offeredAt = '2026-11-23T10:00:00.000Z';
      const testOffer: Order = {
        id: orderId,
        offeredAt,
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      // Rider tapped Decline from alert, which failed to send (network down)
      markDeclineFailed(offerKeyOf(orderId, offeredAt));

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

      // Clause 1 & Clause 4: Phone NEVER accepts the offer itself
      expect(mockAcceptOrder).not.toHaveBeenCalled();
      // Clause 2: Handed to rider for manual answer (in handAnswerIds)
      expect(hookResult?.handAnswerIds).toEqual([orderId]);
      // Shown on screen as card in dataSourceNew
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual([orderId]);

      // Later refetches / re-evaluations must still never accept it automatically
      mockGetNewOrders.mockResolvedValueOnce([testOffer]);
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: [QueryKeys.newOrders] });
      });
      expect(mockAcceptOrder).not.toHaveBeenCalled();
      expect(hookResult?.handAnswerIds).toEqual([orderId]);

      act(() => {
        tree.unmount();
      });
    });

    // Clause 3, Point 3:
    // A failed Accept from the alert still ends with the order taken (the app then accepts it by itself).
    it('with auto accept on, a failed Accept from alert still ends with the order taken by the app (Clause 3, Point 3)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const orderId = 'order-acc-failed';
      const offeredAt = '2026-11-23T10:05:00.000Z';
      const testOffer: Order = {
        id: orderId,
        offeredAt,
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      // Accept from alert failed: it is NOT in decline failed list, and unmarkOfferAnswered cleared it.
      expect(isDeclineFailed(offerKeyOf(orderId, offeredAt))).toBe(false);

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

      // Clause 3: The app accepts the offer by itself as before
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: orderId,
          automatic: true,
        }),
      );
      expect(hookResult?.handAnswerIds).not.toContain(orderId);

      act(() => {
        tree.unmount();
      });
    });

    // Point 6:
    // A new offer of the same delivery (different offeredAt) is accepted as usual.
    it('a new offer of the same delivery with a different offeredAt is accepted as usual (Point 6)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const deliveryId = 'del-reoffered';
      const oldOfferedAt = '2026-11-23T10:00:00.000Z';
      const newOfferedAt = '2026-11-23T10:20:00.000Z';

      // Old offer was declined from alert and failed
      markDeclineFailed(offerKeyOf(deliveryId, oldOfferedAt));

      // New offer arrives for same delivery with updated offeredAt
      const reoffer: Order = {
        id: deliveryId,
        offeredAt: newOfferedAt,
        phoneClock: { offeredAt: 200000, expiresAt: 260000 },
      } as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [reoffer]);

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

      // The new offer has a different key and is auto-accepted as usual
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: deliveryId,
          automatic: true,
        }),
      );
      expect(hookResult?.handAnswerIds).not.toContain(deliveryId);

      act(() => {
        tree.unmount();
      });
    });

    // Point 7:
    // The card can be answered by hand: Decline and Accept from Home both send for a decline failed offer.
    it('decline-failed offer shown in Home can be declined by hand from the card (Point 7)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const orderId = 'order-hand-decline';
      const offeredAt = '2026-11-23T10:00:00.000Z';
      const testOffer: Order = {
        id: orderId,
        offeredAt,
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      markDeclineFailed(offerKeyOf(orderId, offeredAt));
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

      expect(hookResult?.handAnswerIds).toEqual([orderId]);

      // Rider taps Decline from Home card: declineOrder sends
      await act(async () => {
        hookResult?.declineOrderFn(orderId);
      });
      expect(mockDeclineOrder).toHaveBeenCalledTimes(1);
      expect(mockDeclineOrder).toHaveBeenCalledWith(orderId);

      act(() => {
        tree.unmount();
      });
    });

    it('decline-failed offer shown in Home can be accepted by hand from the card (Point 7)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const orderId = 'order-hand-accept';
      const offeredAt = '2026-11-23T10:00:00.000Z';
      const testOffer: Order = {
        id: orderId,
        offeredAt,
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      markDeclineFailed(offerKeyOf(orderId, offeredAt));
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

      expect(hookResult?.handAnswerIds).toEqual([orderId]);

      // Rider taps Accept from Home card: acceptOrder sends (automatic: false)
      await act(async () => {
        hookResult?.acceptOrderFn(orderId);
      });
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: orderId,
          automatic: false,
        }),
      );

      act(() => {
        tree.unmount();
      });
    });

    // Point 5:
    // The gate: with storage read still pending, an auto accept rider's offer is not accepted;
    // once it resolves, an ordinary offer is accepted and a decline failed one is not.
    it('the gate: auto accept waits until loadAnsweredOffers resolves before accepting; then ordinary offer is accepted and decline-failed is not (Point 5)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;

      let resolveStorageLoad!: () => void;
      const pendingStorageLoad = new Promise<void>(res => {
        resolveStorageLoad = res;
      });
      // Storage read is in flight
      (loadAnsweredOffers as jest.Mock).mockReturnValueOnce(pendingStorageLoad);

      const ordId = 'order-gate-ord';
      const decId = 'order-gate-dec';
      const decOfferedAt = '2026-11-23T10:00:00.000Z';

      const ordinaryOffer: Order = {
        id: ordId,
        offeredAt: '2026-11-23T10:00:00.000Z',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;
      const declineFailedOffer: Order = {
        id: decId,
        offeredAt: decOfferedAt,
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as Order;

      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [ordinaryOffer, declineFailedOffer],
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

      // While storage load is pending (answeredLoaded false): NO offer may be auto-accepted!
      expect(mockAcceptOrder).not.toHaveBeenCalled();
      expect(hookResult?.handAnswerIds).toEqual([]);

      // Storage finishes reading: loads decline-failed key into memory, then promise resolves
      markDeclineFailed(offerKeyOf(decId, decOfferedAt));
      await act(async () => {
        resolveStorageLoad();
      });

      // Now answeredLoaded is true:
      // Ordinary offer is auto-accepted
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(mockAcceptOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: ordId,
          automatic: true,
        }),
      );
      // Decline-failed offer is NOT accepted by the phone and handed to rider
      expect(mockAcceptOrder).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: decId }),
      );
      expect(hookResult?.handAnswerIds).toEqual([decId]);

      act(() => {
        tree.unmount();
      });
    });

    // Point 8:
    // Pairs and add-ons behave as before.
    it('pairs and add-ons behave as before (Point 8)', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      const pair1 = {
        id: 'order-pair-1',
        offeredAt: '2026-11-23T10:00:00.000Z',
        pairWith: 'order-pair-2',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as unknown as Order;
      const pair2 = {
        id: 'order-pair-2',
        offeredAt: '2026-11-23T10:00:00.000Z',
        pairWith: 'order-pair-1',
        phoneClock: { offeredAt: 100000, expiresAt: 160000 },
      } as unknown as Order;

      queryClient.setQueryData([QueryKeys.newOrders], [pair1, pair2]);

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <HookHost onRender={() => undefined} />
          </QueryClientProvider>,
        );
      });

      // Pair is auto-accepted as before
      expect(mockAcceptOrder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'order-pair-1', automatic: true }),
      );

      act(() => {
        tree.unmount();
      });
    });
  });
});
