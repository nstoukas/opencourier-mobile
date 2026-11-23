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

      // Verify staleTime is 0. Row 137: the key holds the language on show (English under Jest).
      const query = queryClient
        .getQueryCache()
        .find({ queryKey: [QueryKeys.howItWorks, 'en'], exact: true });
      expect(query).toBeDefined();
      expect((query?.options as any)?.staleTime).toBe(0);
    });

    // Row 137: the page is worded by the server, so the hook asks for it in the app's language.
    describe('the app language (row 137)', () => {
      afterEach(async () => {
        // jest.setup.js pins English; hand it back.
        await act(async () => {
          await i18n.changeLanguage('en');
        });
      });

      it('asks the service for the page in the language on show', async () => {
        const spy = jest
          .spyOn(services.reviewService, 'getHowItWorks')
          .mockResolvedValue({ offers: ['in English'] } as any);

        const { result } = renderHook(() => useHowItWorks(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith('en');
      });

      it('asks in Greek when the app is in Greek, under a key that holds "el"', async () => {
        await act(async () => {
          await i18n.changeLanguage('el');
        });
        const spy = jest
          .spyOn(services.reviewService, 'getHowItWorks')
          .mockResolvedValue({ offers: ['στα ελληνικά'] } as any);

        const { result } = renderHook(() => useHowItWorks(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith('el');
        const keys = queryClient
          .getQueryCache()
          .getAll()
          .map(query => query.queryKey);
        expect(keys).toEqual([[QueryKeys.howItWorks, 'el']]);
      });

      it('switching the language fetches the page again, and shows the new language page', async () => {
        const english = { offers: ['in English'] };
        const greek = { offers: ['στα ελληνικά'] };
        const spy = jest
          .spyOn(services.reviewService, 'getHowItWorks')
          .mockImplementation(async language =>
            language === 'el' ? (greek as any) : (english as any),
          );

        const { result, rerender } = renderHook(() => useHowItWorks(), {
          wrapper: createWrapper(),
        });
        await waitFor(() => expect(result.current.data).toEqual(english));
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenLastCalledWith('en');

        // The rider picks Greek in Settings; the screen draws again.
        await act(async () => {
          await i18n.changeLanguage('el');
        });
        rerender({});

        await waitFor(() => expect(result.current.data).toEqual(greek));
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy).toHaveBeenLastCalledWith('el');
        // One saved answer per language: the English page is never shown as the Greek one.
        const keys = queryClient
          .getQueryCache()
          .getAll()
          .map(query => query.queryKey);
        expect(keys).toEqual(
          expect.arrayContaining([
            [QueryKeys.howItWorks, 'en'],
            [QueryKeys.howItWorks, 'el'],
          ]),
        );
      });
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
      // Row 137: the page number and the language on show (English under Jest).
      expect(getChangesSpy).toHaveBeenCalledWith(1, 'en');
      expect(result.current.hasNextPage).toBe(true);

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(getChangesSpy).toHaveBeenCalledWith(2, 'en');
        expect(result.current.data?.pages).toHaveLength(2);
      });
    });

    // Row 137: "What changed" in the app's language, like the page above it.
    describe('the app language (row 137)', () => {
      afterEach(async () => {
        await act(async () => {
          await i18n.changeLanguage('en');
        });
      });

      const onePage = (label: string) => ({
        data: [{ at: '2026-11-19T00:00:00Z', label }],
        pagination: { currentPage: 1, nextPage: null, totalItems: 1 },
      });

      it('switching the language fetches the changes again in that language, under its own key', async () => {
        const spy = jest
          .spyOn(services.reviewService, 'getSettingChanges')
          .mockImplementation(async (_page, language) =>
            language === 'el'
              ? (onePage('Βασική αμοιβή') as any)
              : (onePage('Base fee') as any),
          );

        const { result, rerender } = renderHook(() => useSettingChanges(), {
          wrapper: createWrapper(),
        });
        await waitFor(() =>
          expect(result.current.data?.pages[0]).toEqual(onePage('Base fee')),
        );
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenLastCalledWith(1, 'en');

        await act(async () => {
          await i18n.changeLanguage('el');
        });
        rerender({});

        await waitFor(() =>
          expect(result.current.data?.pages[0]).toEqual(
            onePage('Βασική αμοιβή'),
          ),
        );
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy).toHaveBeenLastCalledWith(1, 'el');
        const keys = queryClient
          .getQueryCache()
          .getAll()
          .map(query => query.queryKey);
        expect(keys).toEqual(
          expect.arrayContaining([
            [QueryKeys.settingChanges, 'en'],
            [QueryKeys.settingChanges, 'el'],
          ]),
        );
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

    it('shows Alert with app sentence (review_send_already_open) on 409 instead of server id', async () => {
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
          i18n.t('translations:review_send_already_open'),
        );
      });
    });

    it('shows Alert with server sentence on any other refusal (e.g. 404)', async () => {
      const axios404Error = new axios.AxiosError(
        'Request failed with status code 404',
        '404',
        undefined,
        undefined,
        {
          status: 404,
          data: {
            result: [
              {
                message: 'Delivery del-999 not found or never offered to you',
              },
            ],
          },
        } as any,
      );

      jest
        .spyOn(services.reviewService, 'sendReviewRequest')
        .mockRejectedValueOnce(axios404Error);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSendReviewRequest(), { wrapper });

      await act(async () => {
        result.current.mutate({
          topic: 'PAY',
          note: 'Note for unknown delivery',
          deliveryId: 'del-999',
        });
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:review_send_failed_title'),
          'Delivery del-999 not found or never offered to you',
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
