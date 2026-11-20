import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { services } from '@app/services/service';
import {
  detailFailureOf,
  useEarningsDelivery,
  useEarningsMonth,
  useEarningsMonths,
} from './useEarnings';
import { EarningsDeliveryDetail, EarningsMonth } from '@app/types/earnings';

let capturedQueryOptions: any = null;
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn((options: any) => {
      capturedQueryOptions = options;
      return actual.useQuery(options);
    }),
  };
});

jest.mock('@app/services/service', () => ({
  services: {
    earningsService: {
      getMonth: jest.fn(),
      getDelivery: jest.fn(),
    },
  },
}));

describe('useEarnings hooks (spec 0042, AC-6, AC-7, AC-10, AC-13)', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  describe('useEarningsMonths (AC-6, decision 75.37)', () => {
    it('runs queries for one or two months in parallel', async () => {
      const mockMonthNov = { month: '2026-11' } as EarningsMonth;
      const mockMonthDec = { month: '2026-12' } as EarningsMonth;

      (services.earningsService.getMonth as jest.Mock).mockImplementation(
        (m: string) =>
          Promise.resolve(m === '2026-11' ? mockMonthNov : mockMonthDec),
      );

      const { result } = renderHook(
        () => useEarningsMonths(['2026-11', '2026-12']),
        { wrapper },
      );

      await waitFor(() =>
        expect(result.current.every(q => q.isSuccess)).toBe(true),
      );

      expect(services.earningsService.getMonth).toHaveBeenCalledWith('2026-11');
      expect(services.earningsService.getMonth).toHaveBeenCalledWith('2026-12');
      expect(result.current[0].data).toEqual(mockMonthNov);
      expect(result.current[1].data).toEqual(mockMonthDec);
    });
  });

  describe('useEarningsMonth (AC-7)', () => {
    it('queries single month when enabled is true and skips when false', async () => {
      const mockMonth = { month: '2026-10' } as EarningsMonth;
      (services.earningsService.getMonth as jest.Mock).mockResolvedValue(
        mockMonth,
      );

      // When enabled is false (calendar is closed)
      const { result: disabledResult } = renderHook(
        () => useEarningsMonth('2026-10', false),
        { wrapper },
      );

      expect(disabledResult.current.fetchStatus).toBe('idle');
      expect(services.earningsService.getMonth).not.toHaveBeenCalled();

      // When enabled is true (calendar opened)
      const { result: enabledResult } = renderHook(
        () => useEarningsMonth('2026-10', true),
        { wrapper },
      );

      await waitFor(() => expect(enabledResult.current.isSuccess).toBe(true));
      expect(services.earningsService.getMonth).toHaveBeenCalledWith('2026-10');
      expect(enabledResult.current.data).toEqual(mockMonth);
    });
  });

  describe('useEarningsDelivery (AC-10, AC-11)', () => {
    it('fetches single delivery detail', async () => {
      const mockDelivery = {
        deliveryId: 'del-42',
        pickupName: 'Souvlaki',
      } as EarningsDeliveryDetail;
      (services.earningsService.getDelivery as jest.Mock).mockResolvedValue(
        mockDelivery,
      );

      const { result } = renderHook(() => useEarningsDelivery('del-42'), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(services.earningsService.getDelivery).toHaveBeenCalledWith(
        'del-42',
      );
      expect(result.current.data).toEqual(mockDelivery);
    });
  });

  describe('detailFailureOf (AC-13)', () => {
    it('returns "noConnection" for axios error with no response', () => {
      const error = new AxiosError('Network Error', 'ERR_NETWORK');
      expect(detailFailureOf(error)).toBe('noConnection');
    });

    it('returns "notFound" for axios error with status 404', () => {
      const error = new AxiosError(
        'Not Found',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        { status: 404 } as any,
      );
      expect(detailFailureOf(error)).toBe('notFound');
    });

    it('returns "other" for axios error with status 500', () => {
      const error = new AxiosError(
        'Server Error',
        'ERR_BAD_RESPONSE',
        undefined,
        undefined,
        { status: 500 } as any,
      );
      expect(detailFailureOf(error)).toBe('other');
    });

    it('returns "other" for plain Error', () => {
      expect(detailFailureOf(new Error('Boom'))).toBe('other');
    });
  });

  describe('useEarningsDelivery retry rule (AC-13)', () => {
    it('never retries a 404 and retries other failures up to 3 times', () => {
      capturedQueryOptions = null;
      renderHook(() => useEarningsDelivery('del-test'), { wrapper });

      expect(capturedQueryOptions).toBeTruthy();
      expect(typeof capturedQueryOptions.retry).toBe('function');
      const retry = capturedQueryOptions.retry as (
        failureCount: number,
        error: unknown,
      ) => boolean;

      const error404 = new AxiosError(
        'Not Found',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        { status: 404 } as any,
      );
      const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
      const error500 = new AxiosError(
        'Server Error',
        'ERR_BAD_RESPONSE',
        undefined,
        undefined,
        { status: 500 } as any,
      );

      // Never retries a 404
      expect(retry(0, error404)).toBe(false);

      // Retries other failures up to 3 times (failureCount 0, 1, 2 => true; 3 => false)
      expect(retry(0, networkError)).toBe(true);
      expect(retry(1, networkError)).toBe(true);
      expect(retry(2, networkError)).toBe(true);
      expect(retry(3, networkError)).toBe(false);

      expect(retry(0, error500)).toBe(true);
      expect(retry(2, error500)).toBe(true);
      expect(retry(3, error500)).toBe(false);
    });
  });
});
