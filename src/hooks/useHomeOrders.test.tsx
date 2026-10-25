import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderSetting } from '@app/types/enums';
import { AUTO_ACCEPT_DECLINE_TIMER } from '@app/utilities/constants';
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

jest.mock('@app/services/service', () => ({
  services: {
    orderService: {
      getNewOrders: () => Promise.resolve([]),
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

  it('declines on expiry when in manual mode', async () => {
    mockDeliverySetting = OrderSetting.manual;
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

    expect(mockDeclineOrder).toHaveBeenCalledTimes(1);
    expect(mockDeclineOrder).toHaveBeenCalledWith('order-123');
    expect(mockAcceptOrder).not.toHaveBeenCalled();

    act(() => {
      tree.unmount();
    });
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
});
