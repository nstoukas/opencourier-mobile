import React from 'react';
import { render, act } from '@testing-library/react-native';
import { AppState, AppStateStatus, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useJobStepOutbox, OUTBOX_RETRY_MS } from './useJobStepOutbox';
import * as jobStepOutbox from '@app/services/jobStepOutbox';
import { resetOutboxForTests } from '@app/services/jobStepOutbox';
import * as inProgressListFilter from '@app/utilities/inProgressListFilter';
import { QueryKeys } from '@app/utilities/queryKeys';
import { ConnectionStatus } from '@app/services/liveConnection';

describe('useJobStepOutbox hook (spec 0009, AC-3)', () => {
  let queryClient: QueryClient;
  let flushOutboxSpy: jest.SpyInstance;
  let hideOrderSpy: jest.SpyInstance;
  let invalidateQueriesSpy: jest.SpyInstance;
  let appStateListener: ((state: AppStateStatus) => void) | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    resetOutboxForTests();
    await AsyncStorage.clear();
    await act(async () => {
      jobStepOutbox.getOutboxItems();
    });

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');
    hideOrderSpy = jest.spyOn(
      inProgressListFilter,
      'hideInProgressOrderAfterDelivery',
    );

    flushOutboxSpy = jest
      .spyOn(jobStepOutbox, 'flushOutbox')
      .mockResolvedValue(undefined);

    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((type: string, handler: any) => {
        if (type === 'change') {
          appStateListener = handler;
        }
        return { remove: jest.fn() } as any;
      });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const TestHost = ({
    courierId = 'courier-1',
    connection = 'disconnected' as ConnectionStatus,
  }: {
    courierId?: string;
    connection?: ConnectionStatus;
  }) => {
    useJobStepOutbox(courierId, connection);
    return <View testID="test-host" />;
  };

  const renderHookHost = (props: {
    courierId?: string;
    connection?: ConnectionStatus;
  }) =>
    render(
      <QueryClientProvider client={queryClient}>
        <TestHost {...props} />
      </QueryClientProvider>,
    );

  it('flushes when a waiting item is added (AC-3)', async () => {
    renderHookHost({ courierId: 'courier-1', connection: 'disconnected' });
    expect(flushOutboxSpy).not.toHaveBeenCalled();

    // Rider adds a job step
    await act(async () => {
      await jobStepOutbox.addJobSteps([
        {
          courierId: 'courier-1',
          deliveryId: 'del-1',
          step: 'dispatched',
          tappedAt: Date.now(),
          restaurantName: 'R1',
        },
      ]);
    });

    expect(flushOutboxSpy).toHaveBeenCalledWith(
      'courier-1',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    );
    const getRiderNow = flushOutboxSpy.mock.calls[0][3];
    expect(getRiderNow()).toBe('courier-1');
  });

  it('flushes when live connection becomes "connected"', async () => {
    const { rerender } = renderHookHost({
      courierId: 'courier-1',
      connection: 'disconnected',
    });
    expect(flushOutboxSpy).not.toHaveBeenCalled();

    // Connection turns connected
    rerender(
      <QueryClientProvider client={queryClient}>
        <TestHost courierId="courier-1" connection="connected" />
      </QueryClientProvider>,
    );

    expect(flushOutboxSpy).toHaveBeenCalledWith(
      'courier-1',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('flushes when AppState becomes "active"', () => {
    renderHookHost({ courierId: 'courier-1', connection: 'disconnected' });
    expect(flushOutboxSpy).not.toHaveBeenCalled();

    expect(appStateListener).toBeDefined();

    act(() => {
      appStateListener!('active');
    });

    expect(flushOutboxSpy).toHaveBeenCalledWith(
      'courier-1',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('flushes every 30 seconds while items wait (OUTBOX_RETRY_MS, AC-3)', async () => {
    jest.useFakeTimers();

    await act(async () => {
      await jobStepOutbox.addJobSteps([
        {
          courierId: 'courier-1',
          deliveryId: 'del-1',
          step: 'arrived_at_pickup',
          tappedAt: Date.now(),
          restaurantName: 'R1',
        },
      ]);
    });

    renderHookHost({ courierId: 'courier-1', connection: 'disconnected' });

    // Initial flush on mount because waiting is true
    expect(flushOutboxSpy).toHaveBeenCalledTimes(1);

    // Fast forward 30 seconds
    act(() => {
      jest.advanceTimersByTime(OUTBOX_RETRY_MS);
    });

    expect(flushOutboxSpy).toHaveBeenCalledTimes(2);

    // Fast forward another 30 seconds
    act(() => {
      jest.advanceTimersByTime(OUTBOX_RETRY_MS);
    });

    expect(flushOutboxSpy).toHaveBeenCalledTimes(3);
  });

  it('onSettled: after a sent "delivered" it hides order and invalidates history, earnings, and inProgressOrders', async () => {
    let capturedOnSettled: any;
    flushOutboxSpy.mockImplementation((_courierId, _send, onSettled) => {
      capturedOnSettled = onSettled;
      return Promise.resolve();
    });

    await act(async () => {
      await jobStepOutbox.addJobSteps([
        {
          courierId: 'courier-1',
          deliveryId: 'del-deliv-1',
          step: 'delivered',
          tappedAt: Date.now(),
          restaurantName: 'R1',
        },
      ]);
    });

    renderHookHost({ courierId: 'courier-1', connection: 'connected' });
    expect(capturedOnSettled).toBeDefined();

    const deliveredItem: jobStepOutbox.OutboxItem = {
      id: 'item-1',
      courierId: 'courier-1',
      deliveryId: 'del-deliv-1',
      step: 'delivered',
      tappedAt: 1000,
      state: 'waiting',
      restaurantName: 'R1',
    };

    act(() => {
      capturedOnSettled(deliveredItem, 'sent');
    });

    // 1. Hides in progress order after delivery
    expect(hideOrderSpy).toHaveBeenCalledWith('del-deliv-1');

    // 2. Invalidates history and earnings
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.orderHistory],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.earningsSummary],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.earningsDay],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.earningsDelivery],
    });

    // 3. Invalidates inProgressOrders
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
  });

  it('onSettled: after a non-delivered step or refused step, invalidates inProgressOrders only', async () => {
    let capturedOnSettled: any;
    flushOutboxSpy.mockImplementation((_courierId, _send, onSettled) => {
      capturedOnSettled = onSettled;
      return Promise.resolve();
    });

    await act(async () => {
      await jobStepOutbox.addJobSteps([
        {
          courierId: 'courier-1',
          deliveryId: 'del-pickup-1',
          step: 'picked_up',
          tappedAt: Date.now(),
          restaurantName: 'R1',
        },
      ]);
    });

    renderHookHost({ courierId: 'courier-1', connection: 'connected' });

    const pickupItem: jobStepOutbox.OutboxItem = {
      id: 'item-2',
      courierId: 'courier-1',
      deliveryId: 'del-pickup-1',
      step: 'picked_up',
      tappedAt: 1000,
      state: 'waiting',
      restaurantName: 'R1',
    };

    act(() => {
      capturedOnSettled(pickupItem, 'sent');
    });

    // In-progress orders invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });

    // History and earnings NOT invalidated
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: [QueryKeys.orderHistory],
    });
    expect(hideOrderSpy).not.toHaveBeenCalled();
  });
});
