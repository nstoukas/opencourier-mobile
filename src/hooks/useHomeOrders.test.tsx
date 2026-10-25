import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderSetting } from '@app/types/enums';
// Compile edit for row 61 (spec 0002): the app's fixed 60 s timer is gone
// (offers now take the server's deadline), so these row 60 tests keep the
// number locally. The tests of an answer fired at zero were removed with that
// behavior (decision 61.22); agy writes the row 61 tests.
const AUTO_ACCEPT_DECLINE_TIMER = 60000;
import { QueryKeys } from '@app/utilities/queryKeys';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockDeliverySetting = OrderSetting.manual;

jest.mock('./useUser', () => () => ({
  user: { deliverySetting: mockDeliverySetting },
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

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetNewOrders.mockResolvedValue([]);
    mockAcceptOrder.mockResolvedValue({});
    mockDeclineOrder.mockResolvedValue({});
    mockDeliverySetting = OrderSetting.manual;
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: Infinity },
        mutations: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
    jest.useRealTimers();
  });

  it('accepts on expiry when in auto_accept mode', async () => {
    mockDeliverySetting = OrderSetting.auto_accept;
    queryClient.setQueryData([QueryKeys.newOrders], [{ id: 'order-123' }]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={queryClient}>
          <HookHost onRender={() => {}} />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(AUTO_ACCEPT_DECLINE_TIMER);
      await Promise.resolve();
    });

    expect(mockAcceptOrder).toHaveBeenCalledTimes(1);
    expect(mockAcceptOrder).toHaveBeenCalledWith('order-123');
    expect(mockDeclineOrder).not.toHaveBeenCalled();

    act(() => {
      tree.unmount();
    });
  });

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

    // Unmount hook component (triggers useEffect cleanup which calls stopAll)
    act(() => {
      tree.unmount();
    });

    // Advancing timers should not call accept or decline
    act(() => {
      jest.advanceTimersByTime(AUTO_ACCEPT_DECLINE_TIMER * 2);
    });

    expect(mockDeclineOrder).not.toHaveBeenCalled();
    expect(mockAcceptOrder).not.toHaveBeenCalled();
  });

  describe('Clause 2 & Review Minor 1: Stale list after forgotten offer', () => {
    it('does not re-show forgotten offer A when offer B send fails before a new fetch lands', async () => {
      // Keep refetch pending so the new fetch has not landed yet, preserving stale newOrdersRef
      mockGetNewOrders.mockReturnValue(new Promise(() => {}));

      // Initial fetch lists both offer A and offer B
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

      // Offer A is accepted successfully and forgotten
      mockAcceptOrder.mockResolvedValueOnce({});
      await act(async () => {
        hookResult?.acceptOrderFn('order-A');
        await Promise.resolve();
      });

      // Offer A is gone, only offer B remains on screen
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual(['order-B']);

      // Offer B send fails before any new fetch lands (newOrdersRef still contains [A, B])
      mockAcceptOrder.mockRejectedValueOnce(new Error('Network error for B'));
      await act(async () => {
        hookResult?.acceptOrderFn('order-B');
        await Promise.resolve();
      });

      // B is released and shows again, but forgotten offer A must NOT reappear
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual(['order-B']);

      act(() => {
        tree.unmount();
      });
    });

    it('does not re-show forgotten declined offer A when offer B send fails before a new fetch lands', async () => {
      // Keep refetch pending so the new fetch has not landed yet
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

      // Decline offer A successfully -> forgotten
      mockDeclineOrder.mockResolvedValueOnce({});
      await act(async () => {
        hookResult?.declineOrderFn('order-A');
        await Promise.resolve();
      });

      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual(['order-B']);

      // Offer B decline fails -> releaseOffer called
      mockDeclineOrder.mockRejectedValueOnce(new Error('Network error for B'));
      await act(async () => {
        hookResult?.declineOrderFn('order-B');
        await Promise.resolve();
      });

      // New list shows B again, but must NOT show A
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual(['order-B']);

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('Clause 3 & Review Minor 3: Failed send recovery and re-offer countdown', () => {
    it('puts offer back on New list after failed accept, and subsequent manual tap sends once', async () => {
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

      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual(['order-123']);

      // First accept attempt fails
      mockAcceptOrder.mockRejectedValueOnce(new Error('Network failure'));
      await act(async () => {
        hookResult?.acceptOrderFn('order-123');
        await Promise.resolve();
      });

      // Failed accept puts the offer back on the New list
      expect(hookResult?.dataSourceNew.map(o => o.id)).toEqual(['order-123']);
      expect(mockAcceptOrder).toHaveBeenCalledTimes(1);

      // Rider taps accept manually (tapped twice in rapid succession)
      mockAcceptOrder.mockResolvedValueOnce({});
      await act(async () => {
        hookResult?.acceptOrderFn('order-123');
        hookResult?.acceptOrderFn('order-123');
        await Promise.resolve();
      });

      // Sent once on retry (total 2 calls: 1 initial failed + 1 manual retry; 2nd tap ignored)
      expect(mockAcceptOrder).toHaveBeenCalledTimes(2);
      expect(hookResult?.dataSourceNew).toEqual([]);

      act(() => {
        tree.unmount();
      });
    });
  });
});
