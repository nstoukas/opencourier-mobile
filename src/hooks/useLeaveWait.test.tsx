import React from 'react';
import { Alert } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { services } from '@app/services/service';
import { dropWaitingSteps } from '@app/services/jobStepOutbox';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { QueryKeys } from '@app/utilities/queryKeys';
import { useWaitClock, useLeaveWait } from './useLeaveWait';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';

jest.mock('@app/services/jobStepOutbox', () => ({
  dropWaitingSteps: jest.fn().mockResolvedValue(undefined),
}));

describe('useLeaveWait & useWaitClock (spec 0033, AC-5, AC-6)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;
  let leaveWaitSpy: jest.SpyInstance;

  const mockOrder: Order = {
    id: 'del-wait-123',
    status: OrderStatus.courier_arrived_at_pickup_location,
    pickupBusinessName: 'Test Tavern',
    arrivedAtOnPhone: 100_000,
    waitLimitMinutes: 10,
  } as Order;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert');
    leaveWaitSpy = jest
      .spyOn(services.orderService, 'leaveWait')
      .mockResolvedValue({ status: 'ASSIGNING_COURIER' });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    leaveWaitSpy.mockRestore();
  });

  describe('useWaitClock', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('counts up whole seconds each second while waiting', () => {
      const arrivedAt = 100_000;
      jest.setSystemTime(100_000 + 45_000); // 45 seconds after arrival

      const { result } = renderHook(() => useWaitClock(arrivedAt, true));

      // Initially 45 seconds
      expect(result.current).toBe(45);

      // Counts up after 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(result.current).toBe(46);

      // Counts up after another second
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(result.current).toBe(47);

      // Multiple seconds
      act(() => {
        jest.advanceTimersByTime(15_000);
      });
      expect(result.current).toBe(62);
    });

    it('returns null and does not start a timer when waiting is false', () => {
      const arrivedAt = 100_000;
      jest.setSystemTime(100_000 + 30_000);

      const { result } = renderHook(() => useWaitClock(arrivedAt, false));
      expect(result.current).toBeNull();

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(result.current).toBeNull();
    });

    it('returns null when arrivedOnPhone is null or undefined', () => {
      const { result: nullResult } = renderHook(() => useWaitClock(null, true));
      expect(nullResult.current).toBeNull();

      const { result: undefResult } = renderHook(() =>
        useWaitClock(undefined, true),
      );
      expect(undefResult.current).toBeNull();
    });

    it('stops the timer when unmounted', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const { unmount } = renderHook(() => useWaitClock(100_000, true));

      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('useLeaveWait workflow', () => {
    it('asks first and sends nothing unless confirmed', () => {
      const { result } = renderHook(() => useLeaveWait('courier-1'), {
        wrapper: createWrapper(),
      });

      // Tap Leave
      act(() => {
        result.current.leaveWait(mockOrder);
      });

      // Confirmation dialog appears with exact copy
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:leave_wait_confirm_title'),
        i18n.t('translations:leave_wait_confirm_body'),
        expect.arrayContaining([
          expect.objectContaining({
            text: i18n.t('translations:leave_wait_cancel'),
            style: 'cancel',
          }),
          expect.objectContaining({
            text: i18n.t('translations:leave_wait_confirm'),
          }),
        ]),
      );

      // Nothing sent yet
      expect(leaveWaitSpy).not.toHaveBeenCalled();

      // Cancel button pressed
      const buttons = alertSpy.mock.calls[0][2];
      const cancelButton = buttons.find(
        (b: any) => b.text === i18n.t('translations:leave_wait_cancel'),
      );
      if (cancelButton?.onPress) {
        act(() => {
          cancelButton.onPress();
        });
      }

      // Still nothing sent
      expect(leaveWaitSpy).not.toHaveBeenCalled();
    });

    it('a second tap sends once (prevents concurrent or repeated sends)', async () => {
      const wrapper = createWrapper();
      let resolveLeaveWait: (val: any) => void;
      const pendingPromise = new Promise(resolve => {
        resolveLeaveWait = resolve;
      });
      leaveWaitSpy.mockReturnValueOnce(pendingPromise);

      const { result } = renderHook(() => useLeaveWait('courier-1'), {
        wrapper,
      });

      // First tap shows alert
      act(() => {
        result.current.leaveWait(mockOrder);
      });

      const confirmButton = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === i18n.t('translations:leave_wait_confirm'),
      );

      // Confirm send - now request is in flight
      act(() => {
        confirmButton.onPress();
      });

      expect(leaveWaitSpy).toHaveBeenCalledTimes(1);
      expect(result.current.leavingId).toBe(mockOrder.id);

      // Second tap while leavingId is set is ignored by leaveWait
      act(() => {
        result.current.leaveWait(mockOrder);
      });
      expect(alertSpy).toHaveBeenCalledTimes(1); // No second alert opened

      // Also if confirm button was somehow triggered again directly
      act(() => {
        confirmButton.onPress();
      });
      expect(leaveWaitSpy).toHaveBeenCalledTimes(1); // Still exactly 1 send

      // Resolve the request
      await act(async () => {
        resolveLeaveWait!({ status: 'ASSIGNING_COURIER' });
      });

      expect(result.current.leavingId).toBeNull();
    });

    it('on success: the job leaves the list and its waiting steps are dropped', async () => {
      const wrapper = createWrapper();
      const otherJob: Order = {
        id: 'del-other',
        status: OrderStatus.dispatched,
      } as Order;
      queryClient.setQueryData<Order[]>(
        [QueryKeys.inProgressOrders],
        [mockOrder, otherJob],
      );
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useLeaveWait('courier-1'), {
        wrapper,
      });

      act(() => {
        result.current.leaveWait(mockOrder);
      });

      const confirmButton = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === i18n.t('translations:leave_wait_confirm'),
      );

      await act(async () => {
        await confirmButton.onPress();
      });

      // 1. leaveWait API called with the order ID
      expect(leaveWaitSpy).toHaveBeenCalledWith(mockOrder.id);

      // 2. Outbox waiting steps dropped for this courier and order
      expect(dropWaitingSteps).toHaveBeenCalledWith('courier-1', mockOrder.id);

      // 3. The job leaves the inProgressOrders cache immediately
      const cachedJobs = queryClient.getQueryData<Order[]>([
        QueryKeys.inProgressOrders,
      ]);
      expect(cachedJobs).toEqual([otherJob]);

      // 4. inProgressOrders, newOrders, earningsSummary, earningsDay, and earningsDelivery queries invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.newOrders],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.earningsSummary],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.earningsDay],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.earningsDelivery],
      });
    });

    it('on failed Leave: newOrders, earningsSummary, earningsDay, and earningsDelivery queries are not refreshed', async () => {
      const wrapper = createWrapper();
      queryClient.setQueryData<Order[]>(
        [QueryKeys.inProgressOrders],
        [mockOrder],
      );
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const error409 = new AxiosError('Conflict');
      error409.response = {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: {
          error: true,
          result: [{ message: 'Too early to leave' }],
        },
      };
      leaveWaitSpy.mockRejectedValueOnce(error409);

      const { result } = renderHook(() => useLeaveWait('courier-1'), {
        wrapper,
      });

      act(() => {
        result.current.leaveWait(mockOrder);
      });

      const confirmButton = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === i18n.t('translations:leave_wait_confirm'),
      );

      await act(async () => {
        await confirmButton.onPress();
      });

      // inProgressOrders is refreshed in finally
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });

      // Earnings and newOrders are NOT refreshed on failure
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: [QueryKeys.newOrders],
      });
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: [QueryKeys.earningsSummary],
      });
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: [QueryKeys.earningsDay],
      });
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: [QueryKeys.earningsDelivery],
      });
    });

    it('handles dropWaitingSteps error gracefully on success', async () => {
      const wrapper = createWrapper();
      queryClient.setQueryData<Order[]>(
        [QueryKeys.inProgressOrders],
        [mockOrder],
      );
      (dropWaitingSteps as jest.Mock).mockRejectedValueOnce(
        new Error('Storage failure'),
      );

      const { result } = renderHook(() => useLeaveWait('courier-1'), {
        wrapper,
      });

      act(() => {
        result.current.leaveWait(mockOrder);
      });

      const confirmButton = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === i18n.t('translations:leave_wait_confirm'),
      );

      await act(async () => {
        await confirmButton.onPress();
      });

      // Still removes job from cache even if dropping outbox steps logged an error
      const cachedJobs = queryClient.getQueryData<Order[]>([
        QueryKeys.inProgressOrders,
      ]);
      expect(cachedJobs).toEqual([]);
    });

    it('on 404: says "This order is no longer yours. Check your jobs." and keeps the job in cache', async () => {
      const wrapper = createWrapper();
      queryClient.setQueryData<Order[]>(
        [QueryKeys.inProgressOrders],
        [mockOrder],
      );

      const error404 = new AxiosError('Not Found');
      error404.response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
        data: { error: true, message: 'Delivery not found' },
      };
      leaveWaitSpy.mockRejectedValueOnce(error404);

      const { result } = renderHook(() => useLeaveWait('courier-1'), {
        wrapper,
      });

      act(() => {
        result.current.leaveWait(mockOrder);
      });

      const confirmButton = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === i18n.t('translations:leave_wait_confirm'),
      );

      await act(async () => {
        await confirmButton.onPress();
      });

      // Shows translated not-yours message
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:hand_back_not_yours'),
      );

      // Does not drop waiting steps
      expect(dropWaitingSteps).not.toHaveBeenCalled();

      // Keeps the job in cache (leaves it to the query invalidation / refetch)
      const cachedJobs = queryClient.getQueryData<Order[]>([
        QueryKeys.inProgressOrders,
      ]);
      expect(cachedJobs).toEqual([mockOrder]);
    });

    it('on 409: says the server sentence and keeps the job in cache', async () => {
      const wrapper = createWrapper();
      queryClient.setQueryData<Order[]>(
        [QueryKeys.inProgressOrders],
        [mockOrder],
      );

      const serverErrorMessage = 'The wait limit has not passed yet.';
      const error409 = new AxiosError('Conflict');
      error409.response = {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: {
          error: true,
          result: [{ message: serverErrorMessage }],
        },
      };
      leaveWaitSpy.mockRejectedValueOnce(error409);

      const { result } = renderHook(() => useLeaveWait('courier-1'), {
        wrapper,
      });

      act(() => {
        result.current.leaveWait(mockOrder);
      });

      const confirmButton = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === i18n.t('translations:leave_wait_confirm'),
      );

      await act(async () => {
        await confirmButton.onPress();
      });

      // Shows the server's sentence
      expect(alertSpy).toHaveBeenCalledWith(serverErrorMessage);

      // Keeps the job in cache
      const cachedJobs = queryClient.getQueryData<Order[]>([
        QueryKeys.inProgressOrders,
      ]);
      expect(cachedJobs).toEqual([mockOrder]);
    });

    it('on no signal (network error without response): says "No connection. Try again when you have signal." and keeps the job', async () => {
      const wrapper = createWrapper();
      queryClient.setQueryData<Order[]>(
        [QueryKeys.inProgressOrders],
        [mockOrder],
      );

      const networkError = new AxiosError('Network Error');
      // No response object on networkError
      leaveWaitSpy.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useLeaveWait('courier-1'), {
        wrapper,
      });

      act(() => {
        result.current.leaveWait(mockOrder);
      });

      const confirmButton = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === i18n.t('translations:leave_wait_confirm'),
      );

      await act(async () => {
        await confirmButton.onPress();
      });

      // Shows no connection message
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:hand_back_no_connection'),
      );

      // Keeps the job in cache
      const cachedJobs = queryClient.getQueryData<Order[]>([
        QueryKeys.inProgressOrders,
      ]);
      expect(cachedJobs).toEqual([mockOrder]);
    });

    it('on other server error without custom message: shows leave_wait_failed fallback', async () => {
      const wrapper = createWrapper();
      const error500 = new AxiosError('Internal Server Error');
      error500.response = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as any,
        data: {},
      };
      leaveWaitSpy.mockRejectedValueOnce(error500);

      const { result } = renderHook(() => useLeaveWait('courier-1'), {
        wrapper,
      });

      act(() => {
        result.current.leaveWait(mockOrder);
      });

      const confirmButton = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === i18n.t('translations:leave_wait_confirm'),
      );

      await act(async () => {
        await confirmButton.onPress();
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:leave_wait_failed'),
      );
    });
  });
});
