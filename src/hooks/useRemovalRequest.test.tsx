import React from 'react';
import { Alert } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { services } from '@app/services/service';
import { forgetRemovalDecision } from '@app/services/removalNotice/removalNotice';
import { Order, RemovalRequest } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  useRemovalBusy,
  useRemovalReasons,
  useSendRemovalRequest,
  useWithdrawRemoval,
} from './useRemovalRequest';
import i18n from '@app/localization/i18n';

jest.mock('@app/services/removalNotice/removalNotice', () => ({
  forgetRemovalDecision: jest.fn(),
}));

describe('useRemovalRequest hooks (spec 0035, AC-3, AC-4, AC-5, decision 24.24, decision 24.25)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert');
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleLogSpy.mockRestore();
    queryClient?.clear();
  });

  describe('useRemovalBusy and busy guard (decision 24.25)', () => {
    it('real send: keeps useRemovalBusy true even after unmounting the hook until promise resolves, then false', async () => {
      const wrapper = createWrapper();

      let resolveSend!: (value: any) => void;
      const sendPromise = new Promise(res => {
        resolveSend = res;
      });

      const sendSpy = jest
        .spyOn(services.orderService, 'sendRemovalRequest')
        .mockReturnValue(sendPromise as any);

      // Render busy hooks for delivery A and delivery B
      const { result: busyA } = renderHook(() => useRemovalBusy('del-A'), {
        wrapper,
      });
      const { result: busyB } = renderHook(() => useRemovalBusy('del-B'), {
        wrapper,
      });

      expect(busyA.current).toBe(false);
      expect(busyB.current).toBe(false);

      // Render the real send hook
      const sendHook = renderHook(() => useSendRemovalRequest(), { wrapper });

      // Start the send
      act(() => {
        sendHook.result.current.send(
          { orderId: 'del-A', reasonId: 'reason-1' },
          jest.fn(),
        );
      });

      await waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(busyA.current).toBe(true));
      expect(busyB.current).toBe(false);

      // UNMOUNT the send hook (rider left the screen mid-send)
      sendHook.unmount();

      // Busy stays true for delivery A even after unmounting
      expect(busyA.current).toBe(true);
      expect(busyB.current).toBe(false);

      // Resolve the pending send promise
      await act(async () => {
        resolveSend({
          id: 'req-1',
          status: 'OPEN',
          label: 'Breakdown',
          paid: true,
          decisionNote: null,
          createdAt: '2026-11-09T10:00:00Z',
        });
      });

      // Busy turns false
      await waitFor(() => expect(busyA.current).toBe(false));
      expect(busyB.current).toBe(false);
    });

    it('real withdraw: keeps useRemovalBusy true after confirming and unmounting until promise resolves, then false', async () => {
      const wrapper = createWrapper();

      let resolveWithdraw!: (value: any) => void;
      const withdrawPromise = new Promise(res => {
        resolveWithdraw = res;
      });

      const withdrawSpy = jest
        .spyOn(services.orderService, 'withdrawRemovalRequest')
        .mockReturnValue(withdrawPromise as any);

      const heldOrder: Order = {
        id: 'del-W',
        status: OrderStatus.dispatched,
        removalRequest: {
          id: 'req-w',
          status: 'OPEN',
          label: 'Breakdown',
          paid: true,
          decisionNote: null,
          createdAt: '2026-11-09T10:00:00Z',
        },
      } as unknown as Order;

      const { result: busyW } = renderHook(() => useRemovalBusy('del-W'), {
        wrapper,
      });
      expect(busyW.current).toBe(false);

      const withdrawHook = renderHook(() => useWithdrawRemoval(), { wrapper });

      // Trigger withdraw: draws confirmation alert
      act(() => {
        withdrawHook.result.current(heldOrder);
      });

      expect(alertSpy).toHaveBeenCalledTimes(1);
      const buttons = alertSpy.mock.calls[0][2];
      const confirmButton = buttons.find((b: any) => b.style !== 'cancel');

      // Press confirm
      act(() => {
        confirmButton.onPress();
      });

      await waitFor(() => expect(withdrawSpy).toHaveBeenCalledWith('del-W'));
      await waitFor(() => expect(busyW.current).toBe(true));

      // UNMOUNT the hook
      withdrawHook.unmount();

      // Stays true until promise resolves
      expect(busyW.current).toBe(true);

      await act(async () => {
        resolveWithdraw({ status: 'WITHDRAWN' });
      });

      await waitFor(() => expect(busyW.current).toBe(false));
    });

    it('second send for the same delivery while the first is on its way reaches sendRemovalRequest exactly once', async () => {
      const wrapper = createWrapper();

      let resolveSend!: (value: any) => void;
      const sendPromise = new Promise(res => {
        resolveSend = res;
      });

      const sendSpy = jest
        .spyOn(services.orderService, 'sendRemovalRequest')
        .mockReturnValue(sendPromise as any);

      const { result } = renderHook(() => useSendRemovalRequest(), { wrapper });

      // First send
      act(() => {
        result.current.send(
          { orderId: 'del-dup-send', reasonId: 'reason-1' },
          jest.fn(),
        );
      });

      await waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1));

      // Second send while first is in flight
      act(() => {
        result.current.send(
          { orderId: 'del-dup-send', reasonId: 'reason-2' },
          jest.fn(),
        );
      });

      // Flush microtasks to allow any queued mutation to run
      await act(async () => {
        await Promise.resolve();
      });

      // Still called only once
      expect(sendSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveSend({ id: 'req-dup', status: 'OPEN' });
      });
    });

    it('withdraw while a send is on its way draws no confirmation Alert', async () => {
      const wrapper = createWrapper();

      let resolveSend!: (value: any) => void;
      const sendPromise = new Promise(res => {
        resolveSend = res;
      });

      jest
        .spyOn(services.orderService, 'sendRemovalRequest')
        .mockReturnValue(sendPromise as any);

      const { result: sendHook } = renderHook(() => useSendRemovalRequest(), {
        wrapper,
      });
      const { result: withdrawHook } = renderHook(() => useWithdrawRemoval(), {
        wrapper,
      });

      // Start send for delivery del-busy
      act(() => {
        sendHook.current.send(
          { orderId: 'del-busy', reasonId: 'r1' },
          jest.fn(),
        );
      });

      // Clear alert spy from any earlier calls
      alertSpy.mockClear();

      // Attempt withdraw on the same delivery while send is in flight
      act(() => {
        withdrawHook.current({ id: 'del-busy' } as Order);
      });

      // Withdraw draws NO confirmation alert because order is busy
      expect(alertSpy).not.toHaveBeenCalled();

      await act(async () => {
        resolveSend({ id: 'req-busy', status: 'OPEN' });
      });
    });
  });

  describe('useSendRemovalRequest (AC-3, AC-4, decision 24.25)', () => {
    it('sends removal request, forgets prior decision, updates cache and runs onSent callback', async () => {
      const wrapper = createWrapper();

      const initialOrder: Order = {
        id: 'del-send-1',
        status: OrderStatus.dispatched,
        removalRequest: null,
      } as unknown as Order;

      queryClient.setQueryData<Order[]>(
        [QueryKeys.inProgressOrders],
        [initialOrder],
      );

      const createdRequest: RemovalRequest = {
        id: 'req-123',
        status: 'OPEN',
        label: 'Moped breakdown',
        paid: true,
        decisionNote: null,
        createdAt: '2026-11-09T12:00:00Z',
      };

      const sendSpy = jest
        .spyOn(services.orderService, 'sendRemovalRequest')
        .mockResolvedValueOnce(createdRequest);

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSendRemovalRequest(), { wrapper });

      const onSent = jest.fn();

      await act(async () => {
        result.current.send(
          {
            orderId: 'del-send-1',
            reasonId: 'reason-breakdown',
            note: 'Engine died',
          },
          onSent,
        );
      });

      expect(sendSpy).toHaveBeenCalledWith({
        id: 'del-send-1',
        reasonId: 'reason-breakdown',
        note: 'Engine died',
      });

      // Forget decision so fresh refusal can show if needed (decision 24.23)
      expect(forgetRemovalDecision).toHaveBeenCalledWith('del-send-1');

      // Cache updated immediately
      const cached = queryClient.getQueryData<Order[]>([
        QueryKeys.inProgressOrders,
      ]);
      expect(cached?.[0].removalRequest).toEqual(createdRequest);

      // onSent callback called
      expect(onSent).toHaveBeenCalledTimes(1);

      // Invalidates on settled
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
    });

    it('shows alert with removal_send_no_connection when there is no response (network drop)', async () => {
      const wrapper = createWrapper();

      const error = new axios.AxiosError('Network Error');
      jest
        .spyOn(services.orderService, 'sendRemovalRequest')
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useSendRemovalRequest(), { wrapper });

      const onSent = jest.fn();

      await act(async () => {
        result.current.send(
          { orderId: 'del-err-1', reasonId: 'reason-1' },
          onSent,
        );
      });

      expect(onSent).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:removal_send_failed_title'),
        i18n.t('translations:removal_send_no_connection'),
      );
    });

    it('409 with server message: shows alert with removal_send_refused naming reason, exactly one request, onSent not called (AC-4)', async () => {
      const wrapper = createWrapper();

      const error = new axios.AxiosError('Conflict');
      error.response = {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: {
          result: [
            {
              code: 'OPEN_REQUEST_EXISTS',
              message: 'An open removal request already exists for this order',
            },
          ],
        },
      };

      const sendSpy = jest
        .spyOn(services.orderService, 'sendRemovalRequest')
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useSendRemovalRequest(), { wrapper });
      const onSent = jest.fn();

      await act(async () => {
        result.current.send(
          { orderId: 'del-409', reasonId: 'reason-1' },
          onSent,
        );
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(onSent).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:removal_send_failed_title'),
        i18n.t('translations:removal_send_refused', {
          reason: 'An open removal request already exists for this order',
        }),
      );
    });

    it('refused send with no message: shows removal_send_failed (AC-4)', async () => {
      const wrapper = createWrapper();

      const error = new axios.AxiosError('Bad Request');
      error.response = {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
        data: { result: [] },
      };

      jest
        .spyOn(services.orderService, 'sendRemovalRequest')
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useSendRemovalRequest(), { wrapper });
      const onSent = jest.fn();

      await act(async () => {
        result.current.send(
          { orderId: 'del-no-msg', reasonId: 'reason-1' },
          onSent,
        );
      });

      expect(onSent).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:removal_send_failed_title'),
        i18n.t('translations:removal_send_failed'),
      );
    });

    it('404 error: shows removal_send_refused naming hand_back_not_yours (AC-4)', async () => {
      const wrapper = createWrapper();

      const error = new axios.AxiosError('Not Found');
      error.response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
        data: {},
      };

      jest
        .spyOn(services.orderService, 'sendRemovalRequest')
        .mockRejectedValueOnce(error);

      const { result } = renderHook(() => useSendRemovalRequest(), { wrapper });
      const onSent = jest.fn();

      await act(async () => {
        result.current.send(
          { orderId: 'del-404', reasonId: 'reason-1' },
          onSent,
        );
      });

      expect(onSent).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:removal_send_failed_title'),
        i18n.t('translations:removal_send_refused', {
          reason: i18n.t('translations:hand_back_not_yours'),
        }),
      );
    });
  });

  describe('useWithdrawRemoval (AC-5, decision 24.24)', () => {
    const heldOrder: Order = {
      id: 'del-withdraw-1',
      status: OrderStatus.dispatched,
      removalRequest: {
        id: 'req-open',
        status: 'OPEN',
        label: 'Breakdown',
        paid: true,
        decisionNote: null,
        createdAt: '2026-11-09T10:00:00Z',
      },
    } as unknown as Order;

    it('asks first before withdrawing; cancels if rider taps Keep and does NOT run mutation (decision 24.24)', async () => {
      const wrapper = createWrapper();
      const withdrawSpy = jest.spyOn(
        services.orderService,
        'withdrawRemovalRequest',
      );

      const { result } = renderHook(() => useWithdrawRemoval(), { wrapper });

      act(() => {
        result.current(heldOrder);
      });

      // Flush any pending microtasks to ensure mutate was not invoked before or alongside Alert
      await act(async () => {
        await Promise.resolve();
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:removal_withdraw_confirm_title'),
        i18n.t('translations:removal_withdraw_confirm_body'),
        expect.any(Array),
      );

      const buttons = alertSpy.mock.calls[0][2];
      const keepButton = buttons.find((b: any) => b.style === 'cancel');
      expect(keepButton).toBeTruthy();
      expect(keepButton.text).toBe(
        i18n.t('translations:removal_withdraw_keep'),
      );

      // If user dismisses or keeps, withdraw is not called
      expect(withdrawSpy).not.toHaveBeenCalled();
    });

    it('calls withdrawRemovalRequest when confirmed, clears removalRequest from cache and allows asking again', async () => {
      const wrapper = createWrapper();

      queryClient.setQueryData<Order[]>(
        [QueryKeys.inProgressOrders],
        [heldOrder],
      );

      const withdrawSpy = jest
        .spyOn(services.orderService, 'withdrawRemovalRequest')
        .mockResolvedValueOnce({ status: 'WITHDRAWN' });

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useWithdrawRemoval(), { wrapper });

      act(() => {
        result.current(heldOrder);
      });

      const buttons = alertSpy.mock.calls[0][2];
      const confirmButton = buttons.find((b: any) => b.style !== 'cancel');
      expect(confirmButton.text).toBe(
        i18n.t('translations:removal_withdraw_confirm'),
      );

      await act(async () => {
        confirmButton.onPress();
      });

      expect(withdrawSpy).toHaveBeenCalledWith('del-withdraw-1');

      // Request cleared in cache
      const cached = queryClient.getQueryData<Order[]>([
        QueryKeys.inProgressOrders,
      ]);
      expect(cached?.[0].removalRequest).toBeNull();

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
    });
  });

  describe('useRemovalReasons', () => {
    it('fetches reasons via orderService.getRemovalReasons', async () => {
      const wrapper = createWrapper();
      const sampleReasons = [
        { id: 'r1', label: 'Reason 1', paid: true, needsNote: false },
      ];
      jest
        .spyOn(services.orderService, 'getRemovalReasons')
        .mockResolvedValueOnce(sampleReasons);

      const { result } = renderHook(() => useRemovalReasons(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(sampleReasons);
    });
  });
});
