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
import { useHandBack, useHandBackCountdown } from './useHandBack';
import '@app/localization/i18n';

jest.mock('@app/services/jobStepOutbox', () => ({
  dropWaitingSteps: jest.fn().mockResolvedValue(undefined),
}));

describe('useHandBack & useHandBackCountdown (spec 0020, AC-9)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;
  let handBackSpy: jest.SpyInstance;

  const mockOrder: Order = {
    id: 'del-handback-123',
    status: OrderStatus.accepted,
    dropoffName: 'Customer Test',
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
    handBackSpy = jest
      .spyOn(services.orderService, 'handBack')
      .mockResolvedValue({ status: 'ASSIGNING_COURIER' });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    handBackSpy.mockRestore();
  });

  describe('useHandBackCountdown', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('counts down whole seconds each second and stops at 0', () => {
      const now = 100_000;
      jest.setSystemTime(now);

      const untilOnPhone = now + 3000; // 3 seconds
      const { result } = renderHook(() => useHandBackCountdown(untilOnPhone));

      expect(result.current).toBe(3);

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(result.current).toBe(2);

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(result.current).toBe(1);

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(result.current).toBe(0);

      // Past 0 stays 0
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(result.current).toBe(0);
    });

    it('returns 0 immediately when untilOnPhone is null or in the past', () => {
      const { result: nullResult } = renderHook(() =>
        useHandBackCountdown(null),
      );
      expect(nullResult.current).toBe(0);

      const { result: pastResult } = renderHook(() =>
        useHandBackCountdown(Date.now() - 5000),
      );
      expect(pastResult.current).toBe(0);
    });
  });

  describe('useHandBack workflow', () => {
    it('nothing is sent until the confirm "Give it back" is pressed; cancel does nothing', () => {
      const { result } = renderHook(() => useHandBack('courier-1'), {
        wrapper: createWrapper(),
      });

      // Tap Hand back button
      act(() => {
        result.current.handBack(mockOrder);
      });

      // Asks confirmation
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(
        'Give this order back?',
        'It goes to another rider. No cost to you.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Keep it', style: 'cancel' }),
          expect.objectContaining({ text: 'Give it back' }),
        ]),
      );

      // Nothing sent yet
      expect(handBackSpy).not.toHaveBeenCalled();

      // Tap Keep it (cancel)
      const buttons = alertSpy.mock.calls[0][2];
      const cancelButton = buttons.find((b: any) => b.text === 'Keep it');
      if (cancelButton?.onPress) {
        act(() => {
          cancelButton.onPress();
        });
      }

      expect(handBackSpy).not.toHaveBeenCalled();
    });

    it('on success: calls handBack, dropWaitingSteps, removes job from cache, invalidates queries', async () => {
      const wrapper = createWrapper();
      queryClient.setQueryData<Order[]>([QueryKeys.inProgressOrders], [
        mockOrder,
        { id: 'del-other' } as Order,
      ]);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useHandBack('courier-1'), { wrapper });

      act(() => {
        result.current.handBack(mockOrder);
      });

      const buttons = alertSpy.mock.calls[0][2];
      const confirmButton = buttons.find((b: any) => b.text === 'Give it back');

      await act(async () => {
        await confirmButton.onPress();
      });

      // 1. handBack called
      expect(handBackSpy).toHaveBeenCalledWith('del-handback-123');

      // 2. dropWaitingSteps called for this courier and delivery
      expect(dropWaitingSteps).toHaveBeenCalledWith('courier-1', 'del-handback-123');

      // 3. Removed from inProgressOrders cache immediately
      const cachedJobs = queryClient.getQueryData<Order[]>([
        QueryKeys.inProgressOrders,
      ]);
      expect(cachedJobs).toEqual([{ id: 'del-other' }]);

      // 4. Invalidates newOrders and inProgressOrders
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.newOrders],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
    });

    it('on 409 refusal: shows server sentence and invalidates jobs', async () => {
      const wrapper = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const error409 = new AxiosError('Conflict');
      error409.response = {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: {
          error: true,
          result: [
            {
              message:
                'You are at the restaurant. Report an issue or call dispatch to give this order back.',
            },
          ],
        },
      };

      handBackSpy.mockRejectedValueOnce(error409);

      const { result } = renderHook(() => useHandBack('courier-1'), { wrapper });

      act(() => {
        result.current.handBack(mockOrder);
      });

      const confirmButton = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === 'Give it back',
      );

      await act(async () => {
        await confirmButton.onPress();
      });

      // Shows server's sentence
      expect(alertSpy).toHaveBeenCalledWith(
        'You are at the restaurant. Report an issue or call dispatch to give this order back.',
      );

      // Still invalidates inProgressOrders so server has the last word
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
    });

    it('on 404: shows "This order is no longer yours. Check your jobs."', async () => {
      const wrapper = createWrapper();

      const error404 = new AxiosError('Not Found');
      error404.response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
        data: { error: true, message: 'Delivery not found' },
      };

      handBackSpy.mockRejectedValueOnce(error404);

      const { result } = renderHook(() => useHandBack('courier-1'), { wrapper });

      act(() => {
        result.current.handBack(mockOrder);
      });

      const confirmButton = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === 'Give it back',
      );

      await act(async () => {
        await confirmButton.onPress();
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'This order is no longer yours. Check your jobs.',
      );
    });

    it('on network failure (no response): shows no connection sentence', async () => {
      const wrapper = createWrapper();

      const networkError = new AxiosError('Network Error');
      // No response object
      handBackSpy.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useHandBack('courier-1'), { wrapper });

      act(() => {
        result.current.handBack(mockOrder);
      });

      const confirmButton = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === 'Give it back',
      );

      await act(async () => {
        await confirmButton.onPress();
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'No connection. Try again when you have signal.',
      );
    });

    it('ignores second send while one is already in flight', async () => {
      const wrapper = createWrapper();
      let resolveHandBack: (val: any) => void;
      const deferredHandBack = new Promise(resolve => {
        resolveHandBack = resolve;
      });
      handBackSpy.mockReturnValueOnce(deferredHandBack);

      const { result } = renderHook(() => useHandBack('courier-1'), { wrapper });

      // First hand back confirm
      act(() => {
        result.current.handBack(mockOrder);
      });
      const confirmButton1 = alertSpy.mock.calls[0][2].find(
        (b: any) => b.text === 'Give it back',
      );

      act(() => {
        confirmButton1.onPress();
      });

      expect(handBackSpy).toHaveBeenCalledTimes(1);
      expect(result.current.handingBackId).toBe('del-handback-123');

      // Second tap while first is in flight
      act(() => {
        result.current.handBack(mockOrder);
      });

      // No second confirm dialog while handingBackId is set
      expect(alertSpy).toHaveBeenCalledTimes(1);

      // Now resolve the in-flight request
      await act(async () => {
        resolveHandBack!({ status: 'ASSIGNING_COURIER' });
        await Promise.resolve();
      });

      expect(handBackSpy).toHaveBeenCalledTimes(1);
      expect(result.current.handingBackId).toBeNull();
    });
  });
});
