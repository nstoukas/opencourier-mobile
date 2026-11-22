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
  useComplaints,
  useFileComplaint,
  useReplyToComplaint,
} from './useComplaints';

// Spec 0052 (row 83): useComplaints, useFileComplaint, useReplyToComplaint.
describe('useComplaints hooks (spec 0052, AC-2, AC-4, AC-5, AC-7)', () => {
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

  describe('useComplaints (AC-4, AC-7)', () => {
    it('loads paged complaints and advances with fetchNextPage', async () => {
      const page1 = {
        data: [{ id: 'comp-1', status: 'OPEN' as const }],
        pagination: { currentPage: 1, nextPage: 2, totalItems: 2 },
      };
      const page2 = {
        data: [{ id: 'comp-2', status: 'DECIDED' as const }],
        pagination: { currentPage: 2, nextPage: null, totalItems: 2 },
      };

      const getSpy = jest
        .spyOn(services.complaintService, 'getComplaints')
        .mockResolvedValueOnce(page1 as any)
        .mockResolvedValueOnce(page2 as any);

      const { result } = renderHook(() => useComplaints(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getSpy).toHaveBeenCalledWith(1);
      expect(result.current.data?.pages[0]).toEqual(page1);
      expect(result.current.hasNextPage).toBe(true);

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(getSpy).toHaveBeenCalledWith(2);
        expect(result.current.data?.pages).toHaveLength(2);
      });
    });
  });

  describe('useFileComplaint (AC-2)', () => {
    it('calls fileComplaint and invalidates complaints cache on success', async () => {
      const created = { id: 'comp-new', status: 'OPEN' } as any;
      const fileSpy = jest
        .spyOn(services.complaintService, 'fileComplaint')
        .mockResolvedValueOnce(created);

      const wrapper = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useFileComplaint(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          deliveryId: 'del-10',
          about: 'RESTAURANT',
          category: 'FOOD_NOT_READY',
          text: 'Food was not ready on time',
        });
      });

      expect(fileSpy).toHaveBeenCalledWith({
        deliveryId: 'del-10',
        about: 'RESTAURANT',
        category: 'FOOD_NOT_READY',
        text: 'Food was not ready on time',
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.complaints],
      });
    });

    it('shows Alert with complaint_already_open sentence on 409 conflict', async () => {
      const error409 = new axios.AxiosError(
        'Conflict',
        '409',
        undefined,
        undefined,
        { status: 409, data: { result: [{ message: 'Already open' }] } } as any,
      );

      jest
        .spyOn(services.complaintService, 'fileComplaint')
        .mockRejectedValueOnce(error409);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useFileComplaint(), { wrapper });

      await act(async () => {
        result.current.mutate({
          deliveryId: 'del-10',
          about: 'RESTAURANT',
          category: 'FOOD_NOT_READY',
          text: 'Food was not ready',
        });
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:complaint_send_failed_title'),
          i18n.t('translations:complaint_already_open'),
        );
      });
    });

    it('shows Alert with complaint_not_found sentence on 404', async () => {
      const error404 = new axios.AxiosError(
        'Not Found',
        '404',
        undefined,
        undefined,
        { status: 404, data: {} } as any,
      );

      jest
        .spyOn(services.complaintService, 'fileComplaint')
        .mockRejectedValueOnce(error404);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useFileComplaint(), { wrapper });

      await act(async () => {
        result.current.mutate({
          deliveryId: 'del-unknown',
          about: 'CUSTOMER',
          category: 'NOT_ANSWERING',
          text: 'Customer did not answer',
        });
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:complaint_send_failed_title'),
          i18n.t('translations:complaint_not_found'),
        );
      });
    });

    it('shows Alert with complaint_no_connection when network error has no response', async () => {
      const networkError = new axios.AxiosError(
        'Network Error',
        'ERR_NETWORK',
        undefined,
        undefined,
        undefined,
      );

      jest
        .spyOn(services.complaintService, 'fileComplaint')
        .mockRejectedValueOnce(networkError);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useFileComplaint(), { wrapper });

      await act(async () => {
        result.current.mutate({
          deliveryId: 'del-10',
          about: 'RESTAURANT',
          category: 'RUDE_STAFF',
          text: 'Rude staff note',
        });
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:complaint_send_failed_title'),
          i18n.t('translations:complaint_no_connection'),
        );
      });
    });

    it('shows Alert with serverMessage on 400 error', async () => {
      const error400 = new axios.AxiosError(
        'Bad Request',
        '400',
        undefined,
        undefined,
        {
          status: 400,
          data: {
            result: [
              { message: 'Text must not exceed 1000 characters' },
            ],
          },
        } as any,
      );

      jest
        .spyOn(services.complaintService, 'fileComplaint')
        .mockRejectedValueOnce(error400);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useFileComplaint(), { wrapper });

      await act(async () => {
        result.current.mutate({
          deliveryId: 'del-10',
          about: 'RESTAURANT',
          category: 'RUDE_STAFF',
          text: 'Too long text...',
        });
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:complaint_send_failed_title'),
          'Text must not exceed 1000 characters',
        );
      });
    });
  });

  describe('useReplyToComplaint (AC-5)', () => {
    it('calls replyToComplaint and invalidates complaints cache on success', async () => {
      const replied = { id: 'comp-1', status: 'OPEN', riderReply: 'My reply' } as any;
      const replySpy = jest
        .spyOn(services.complaintService, 'replyToComplaint')
        .mockResolvedValueOnce(replied);

      const wrapper = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useReplyToComplaint(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'comp-1',
          text: 'My explanation',
        });
      });

      expect(replySpy).toHaveBeenCalledWith('comp-1', 'My explanation');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.complaints],
      });
    });

    it('shows Alert with complaint_reply_conflict on 409 conflict', async () => {
      const error409 = new axios.AxiosError(
        'Conflict',
        '409',
        undefined,
        undefined,
        { status: 409, data: {} } as any,
      );

      jest
        .spyOn(services.complaintService, 'replyToComplaint')
        .mockRejectedValueOnce(error409);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useReplyToComplaint(), { wrapper });

      await act(async () => {
        result.current.mutate({
          id: 'comp-1',
          text: 'Late reply',
        });
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:complaint_send_failed_title'),
          i18n.t('translations:complaint_reply_conflict'),
        );
      });
    });

    it('shows Alert with complaint_no_connection when replying with no network', async () => {
      const networkError = new axios.AxiosError(
        'Network Error',
        'ERR_NETWORK',
        undefined,
        undefined,
        undefined,
      );

      jest
        .spyOn(services.complaintService, 'replyToComplaint')
        .mockRejectedValueOnce(networkError);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useReplyToComplaint(), { wrapper });

      await act(async () => {
        result.current.mutate({
          id: 'comp-1',
          text: 'Offline reply',
        });
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:complaint_send_failed_title'),
          i18n.t('translations:complaint_no_connection'),
        );
      });
    });
  });
});
