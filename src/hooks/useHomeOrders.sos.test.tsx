import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OrderSetting } from '@app/types/enums';
import { Order } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import '@app/localization/i18n';
import {
  endSos,
  resetSosStoreForTests,
  startSos,
} from '@app/services/sosStore';

// Decision 73.10 (spec 0022, AC-7): while the rider's newest SOS is shared,
// the phone sends no accept, neither a tap nor auto accept.

jest.mock('@app/services/offerPush/offerAlert', () => ({
  cancelOfferAlert: jest.fn(),
  isOfferAlertDisplayed: jest.fn().mockResolvedValue(false),
}));

jest.mock('@app/services/offerPush/answeredOffers', () => {
  const actual = jest.requireActual('@app/services/offerPush/answeredOffers');
  const answered = new Set<string>();
  return {
    ...actual,
    isOfferAnswered: jest.fn((key: string) => answered.has(key)),
    markOfferAnswered: jest.fn((key: string) => {
      answered.add(key);
      return true;
    }),
    unmarkOfferAnswered: jest.fn((key: string) => {
      answered.delete(key);
    }),
    loadAnsweredOffers: jest.fn().mockResolvedValue(undefined),
    // For the tests: forget every answer between tests.
    __clear: () => answered.clear(),
  };
});

let mockDeliverySetting = OrderSetting.manual;

jest.mock('./useUser', () => () => ({
  user: {
    id: 'rider-1',
    deliverySetting: mockDeliverySetting,
    // UserStatus.Online (a mock factory may not read imports).
    status: 'ONLINE',
  },
  isLoading: false,
  refetchUser: jest.fn(),
}));

const mockAcceptOrder = jest.fn();

jest.mock('@app/services/service', () => ({
  services: {
    orderService: {
      getNewOrders: () => new Promise(() => {}),
      getInProgressOrders: () => new Promise(() => {}),
      acceptOrder: (params: { id: string; automatic?: boolean }) =>
        mockAcceptOrder(params),
      declineOrder: jest.fn().mockResolvedValue({}),
    },
    sosService: {
      start: jest.fn(),
      getActive: jest.fn(),
      sendPoints: jest.fn(),
      end: jest.fn(),
    },
  },
}));

jest.mock('@app/services/offerPush/autoAccepted', () => ({
  announceAutoAccept: jest.fn(),
}));

jest.mock('@app/services/offerReminder', () => ({
  remindRiderOfOffer: jest.fn(),
  cancelOfferReminder: jest.fn(),
}));

import { useHomeOrders } from './useHomeOrders';
import * as answeredOffers from '@app/services/offerPush/answeredOffers';

function HookHost({
  onRender,
}: {
  onRender: (hook: ReturnType<typeof useHomeOrders>) => void;
}) {
  const hook = useHomeOrders();
  onRender(hook);
  return null;
}

const offer: Order = {
  id: 'order-1',
  offeredAt: '2026-11-03T12:00:00.000Z',
  phoneClock: { offeredAt: 100000, expiresAt: 160000 },
} as Order;

const SOS_NO_ACCEPT = "You can't take a job during an SOS. Tap I'm safe first.";

describe('useHomeOrders during an SOS (decision 73.10)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;
  let hook: ReturnType<typeof useHomeOrders> | undefined;
  let tree: renderer.ReactTestRenderer | undefined;

  const mount = async () => {
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={queryClient}>
          <HookHost
            onRender={h => {
              hook = h;
            }}
          />
        </QueryClientProvider>,
      );
    });
  };

  // The accept mutation runs its request a tick after the tap.
  const tapAccept = async () => {
    await act(async () => {
      hook?.acceptOrderFn('order-1');
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
    });
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (answeredOffers as unknown as { __clear: () => void }).__clear();
    resetSosStoreForTests();
    await AsyncStorage.clear();
    mockAcceptOrder.mockReturnValue(new Promise(() => {}));
    mockDeliverySetting = OrderSetting.manual;
    hook = undefined;
    tree = undefined;
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: Infinity },
        mutations: { retry: false, gcTime: 0 },
      },
    });
    queryClient.setQueryData([QueryKeys.newOrders], [offer]);
  });

  afterEach(() => {
    if (tree) {
      act(() => {
        tree!.unmount();
      });
    }
    alertSpy.mockRestore();
    queryClient.clear();
    jest.useRealTimers();
  });

  describe('a tapped accept', () => {
    it('sends nothing and shows sos_no_accept while the SOS is shared', async () => {
      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });
      await mount();

      await tapAccept();

      expect(mockAcceptOrder).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(SOS_NO_ACCEPT);
      // The offer stays on screen: it expires as usual (AC-7).
      expect(hook?.dataSourceNew.map(order => order.id)).toEqual(['order-1']);
    });

    it('is sent as before with no SOS', async () => {
      await mount();

      await tapAccept();

      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-1',
        automatic: false,
      });
      expect(alertSpy).not.toHaveBeenCalledWith(SOS_NO_ACCEPT);
    });

    it('is sent once the rider ended the SOS (its end may still wait for signal)', async () => {
      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });
      await endSos('rider-1', { kind: 'safe', tappedAt: 2000 });
      await mount();

      await tapAccept();

      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
      expect(alertSpy).not.toHaveBeenCalledWith(SOS_NO_ACCEPT);
    });

    it('is refused once an SOS starts while Home is already open', async () => {
      await mount();

      await act(async () => {
        await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });
      });
      await tapAccept();

      expect(mockAcceptOrder).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(SOS_NO_ACCEPT);
    });
  });

  describe('auto accept', () => {
    it('accepts no offer while the SOS is shared', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;
      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });

      await mount();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockAcceptOrder).not.toHaveBeenCalled();
    });

    it('accepts the offer on arrival as before with no SOS', async () => {
      mockDeliverySetting = OrderSetting.auto_accept;

      await mount();

      expect(mockAcceptOrder).toHaveBeenCalledWith({
        id: 'order-1',
        automatic: true,
      });
    });
  });
});
