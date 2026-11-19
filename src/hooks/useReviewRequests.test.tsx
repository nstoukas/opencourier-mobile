import React from 'react';
import { Alert } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  useHowItWorks,
  useReviewRequests,
  useSettingChanges,
  useSendReviewRequest,
  useWithdrawReviewRequest,
} from './useReviewRequests';

describe('useReviewRequests hooks (spec 0038, AC-1, AC-2, AC-8, AC-11, AC-13)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
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
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    queryClient?.clear();
  });

  describe('useHowItWorks (AC-11)', () => {
    it('fetches explanation from reviewService and has staleTime 0', async () => {
      const mockData = {
        offers: ['Offer rule 1'],
        pay: ['Pay rule 1'],
        personDecides: ['Person rule 1'],
        appRecords: ['Record rule 1'],
        reviewAnswerDays: 14,
      };
      jest
        .spyOn(services.reviewService, 'getHowItWorks')
        .mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useHowItWorks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
      expect(services.reviewService.getHowItWorks).toHaveBeenCalledTimes(1);

      // Verify staleTime is 0
      const query = queryClient
        .getQueryCache()
        .find({ queryKey: [QueryKeys.howItWorks] });
      expect((query?.options as any)?.staleTime).toBe(0);
    });
  });

  describe('useReviewRequests (AC-8)', () => {
    it('loads pages of rider requests and fetchNextPage advances page', async () => {
      const page1 = {
        data: [{ id: 'rev-1', status: 'OPEN' as const }],
        pagination: { currentPage: 1, nextPage: 2, totalItems: 2 },
      };
      const page2 = {
        data: [{ id: 'rev-2', status: 'ANSWERED' as const }],
        pagination: { currentPage: 2, nextPage: null, totalItems: 2 },
      };

      const getRequestsSpy = jest
        .spyOn(services.reviewService, 'getReviewRequests')
        .mockResolvedValueOnce(page1 as any)
        .mockResolvedValueOnce(page2 as any);

      const { result } = renderHook(() => useReviewRequests(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getRequestsSpy).toHaveBeenCalledWith(1);
      expect(result.current.data?.pages[0]).toEqual(page1);

      // Fetch next page
      await act(async () => {
        result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(getRequestsSpy).toHaveBeenCalledWith(2);
        expect(result.current.data?.pages).toHaveLength(2);
      });
    });
  });

  describe('useSettingChanges (AC-13)', () => {
    it('loads paged changes from reviewService and fetchNextPage works', async () => {
      const page1 = {
        data: [{ at: '2026-11-19T00:00:00Z', label: 'Wait pay' }],
        pagination: { currentPage: 1, nextPage: 2, totalItems: 2 },
      };
      const page2 = {
        data: [{ at: '2026-11-18T00:00:00Z', label: 'Base fee' }],
        pagination: { currentPage: 2, nextPage: null, totalItems: 2 },
      };

      const getChangesSpy = jest
        .spyOn(services.reviewService, 'getSettingChanges')
        .mockResolvedValueOnce(page1 as any)
        .mockResolvedValueOnce(page2 as any);

      const { result } = renderHook(() => useSettingChanges(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getChangesSpy).toHaveBeenCalledWith(1);
      expect(result.current.hasNextPage).toBe(true);

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(getChangesSpy).toHaveBeenCalledWith(2);
        expect(result.current.data?.pages).toHaveLength(2);
      });
    });
  });

  describe('useSendReviewRequest (AC-1, AC-2)', () => {
    it('calls sendReviewRequest and invalidates reviewRequests on success', async () => {
      const created = { id: 'rev-new', topic: 'PAY', note: 'Test' } as any;
      const sendSpy = jest
        .spyOn(services.reviewService, 'sendReviewRequest')
        .mockResolvedValueOnce(created);

      const wrapper = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSendReviewRequest(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          topic: 'PAY',
          note: 'Please review pay',
          deliveryId: 'del-1',
        });
      });

      expect(sendSpy).toHaveBeenCalledWith({
        topic: 'PAY',
        note: 'Please review pay',
        deliveryId: 'del-1',
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.reviewRequests],
      });
    });

    it('shows Alert with server refusal message on 409 (e.g. naming open request)', async () => {
      const axios409Error = new axios.AxiosError(
        'Request failed with status code 409',
        '409',
        undefined,
        undefined,
        {
          status: 409,
          data: {
            result: [
              {
                message:
                  'A review request is already open for this delivery (rev-open-1)',
              },
            ],
          },
        } as any,
      );

      jest
        .spyOn(services.reviewService, 'sendReviewRequest')
        .mockRejectedValueOnce(axios409Error);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSendReviewRequest(), { wrapper });

      await act(async () => {
        result.current.mutate({
          topic: 'PAY',
          note: 'Duplicate note',
          deliveryId: 'del-1',
        });
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:review_send_failed_title'),
          'A review request is already open for this delivery (rev-open-1)',
        );
      });
    });

    it('shows no connection Alert when offline (network error without response)', async () => {
      const networkError = new axios.AxiosError(
        'Network Error',
        'ERR_NETWORK',
        undefined,
        undefined,
        undefined, // response is undefined
      );

      jest
        .spyOn(services.reviewService, 'sendReviewRequest')
        .mockRejectedValueOnce(networkError);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSendReviewRequest(), { wrapper });

      await act(async () => {
        result.current.mutate({
          topic: 'PAY',
          note: 'Offline note',
        });
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:review_send_failed_title'),
          i18n.t('translations:review_send_no_connection'),
        );
      });
    });
  });

  describe('useWithdrawReviewRequest (AC-8)', () => {
    it('confirmWithdraw prompts user with Keep and Confirm; Confirm triggers withdrawal mutation', async () => {
      const withdrawSpy = jest
        .spyOn(services.reviewService, 'withdrawReviewRequest')
        .mockResolvedValueOnce({ id: 'rev-1', status: 'WITHDRAWN' } as any);

      const wrapper = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useWithdrawReviewRequest(), {
        wrapper,
      });

      // User initiates withdraw
      act(() => {
        result.current.confirmWithdraw('rev-1');
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:review_withdraw_title'),
        i18n.t('translations:review_withdraw_body'),
        expect.any(Array),
      );

      // Buttons passed to Alert.alert: [Keep, Confirm]
      const alertButtons = alertSpy.mock.calls[0][2];
      expect(alertButtons[0].text).toBe(
        i18n.t('translations:review_withdraw_keep'),
      );
      expect(alertButtons[1].text).toBe(
        i18n.t('translations:review_withdraw_confirm'),
      );

      // Press confirm button
      await act(async () => {
        await alertButtons[1].onPress();
      });

      expect(withdrawSpy).toHaveBeenCalledWith('rev-1');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.reviewRequests],
      });
    });

    it('shows Alert with server error if withdrawal fails (e.g. 409 already closed)', async () => {
      const axios409Error = new axios.AxiosError(
        'Request failed with status code 409',
        '409',
        undefined,
        undefined,
        {
          status: 409,
          data: {
            result: [{ message: 'This request is no longer open.' }],
          },
        } as any,
      );

      jest
        .spyOn(services.reviewService, 'withdrawReviewRequest')
        .mockRejectedValueOnce(axios409Error);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useWithdrawReviewRequest(), {
        wrapper,
      });

      act(() => {
        result.current.confirmWithdraw('rev-1');
      });

      const alertButtons = alertSpy.mock.calls[0][2];
      await act(async () => {
        await alertButtons[1].onPress();
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:review_withdraw_failed_title'),
          'This request is no longer open.',
        );
      });
    });
  });
});
