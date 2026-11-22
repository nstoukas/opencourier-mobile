import React from 'react';
import { Alert } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import useAddressNotes, {
  PERSONAL_DATA_WARNING_CODE,
  isPersonalDataWarning,
} from './useAddressNotes';

// Spec 0053 (AC-4, AC-5, AC-7):
// useAddressNotes provides toggleUpvote, flagNote, and deleteNote mutations
// for address notes on held deliveries, and helper isPersonalDataWarning.
describe('useAddressNotes (spec 0053)', () => {
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  describe('isPersonalDataWarning (AC-4)', () => {
    it('returns true when error is an Axios 422 with PERSONAL_DATA_WARNING code', () => {
      const error = new AxiosError('Unprocessable Entity');
      error.response = {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: {},
        config: {} as any,
        data: {
          error: true,
          result: [
            {
              code: PERSONAL_DATA_WARNING_CODE,
              message: 'Looks like personal data',
              statusCode: 422,
            },
          ],
        },
      };

      expect(isPersonalDataWarning(error)).toBe(true);
    });

    it('returns false for non-Axios error', () => {
      expect(isPersonalDataWarning(new Error('Network error'))).toBe(false);
      expect(isPersonalDataWarning('String error')).toBe(false);
      expect(isPersonalDataWarning(null)).toBe(false);
    });

    it('returns false for AxiosError with different HTTP status', () => {
      const error = new AxiosError('Internal Server Error');
      error.response = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as any,
        data: {},
      };

      expect(isPersonalDataWarning(error)).toBe(false);
    });

    it('returns false for AxiosError 422 with a different code or no result', () => {
      const error = new AxiosError('Unprocessable Entity');
      error.response = {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: {},
        config: {} as any,
        data: {
          error: true,
          result: [{ code: 'OTHER_VALIDATION_ERROR' }],
        },
      };

      expect(isPersonalDataWarning(error)).toBe(false);

      error.response.data = {};
      expect(isPersonalDataWarning(error)).toBe(false);
    });
  });

  describe('toggleUpvote (AC-5)', () => {
    it('calls toggleUpvote and invalidates inProgressOrders on success', async () => {
      const toggleSpy = jest
        .spyOn(services.commentService, 'toggleUpvote')
        .mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.toggleUpvote('note-123');
      });

      expect(toggleSpy).toHaveBeenCalledWith('note-123');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
      expect(alertSpy).not.toHaveBeenCalled();

      toggleSpy.mockRestore();
    });

    it('shows alert when toggleUpvote fails', async () => {
      const toggleSpy = jest
        .spyOn(services.commentService, 'toggleUpvote')
        .mockRejectedValueOnce(new Error('Failed'));

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.toggleUpvote('note-123');
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_failed_title'),
        i18n.t('translations:address_note_failed'),
      );

      toggleSpy.mockRestore();
    });
  });

  describe('flagNote (AC-7)', () => {
    it('calls flagComment, invalidates inProgressOrders, and shows thank-you alert on success', async () => {
      const flagSpy = jest
        .spyOn(services.commentService, 'flagComment')
        .mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.flagNote({
          id: 'note-456',
          reason: 'Customer name mentioned',
        });
      });

      expect(flagSpy).toHaveBeenCalledWith({
        id: 'note-456',
        reason: 'Customer name mentioned',
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_flagged_title'),
        i18n.t('translations:address_note_flagged'),
      );

      flagSpy.mockRestore();
    });

    it('shows error alert when flagComment fails', async () => {
      const flagSpy = jest
        .spyOn(services.commentService, 'flagComment')
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.flagNote({ id: 'note-456' });
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_failed_title'),
        i18n.t('translations:address_note_failed'),
      );

      flagSpy.mockRestore();
    });
  });

  describe('deleteNote (AC-2)', () => {
    it('calls deleteComment and invalidates inProgressOrders on success', async () => {
      const deleteSpy = jest
        .spyOn(services.commentService, 'deleteComment')
        .mockResolvedValueOnce({ error: false, data: {} });

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.deleteNote('note-789');
      });

      expect(deleteSpy).toHaveBeenCalledWith('note-789');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
      expect(alertSpy).not.toHaveBeenCalled();

      deleteSpy.mockRestore();
    });

    it('shows error alert when deleteComment fails', async () => {
      const deleteSpy = jest
        .spyOn(services.commentService, 'deleteComment')
        .mockRejectedValueOnce(new Error('Delete error'));

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.deleteNote('note-789');
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_failed_title'),
        i18n.t('translations:address_note_failed'),
      );

      deleteSpy.mockRestore();
    });
  });
});
