import React from 'react';
import { Alert } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import useAddressNotes, {
  PERSONAL_DATA_WARNING_CODE,
  isPersonalDataWarning,
  noteFailureKey,
} from './useAddressNotes';

// Spec 0053 (AC-4, AC-5, AC-7):
// useAddressNotes provides toggleUpvote, flagNote, and deleteNote mutations
// for address notes on held deliveries, helper isPersonalDataWarning, and noteFailureKey.
describe('useAddressNotes (spec 0053)', () => {
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
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
    queryClient?.clear();
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

  describe('noteFailureKey (Row 82 review)', () => {
    it('returns whenGone key when Axios error status is 404', () => {
      const error = new AxiosError('Not Found');
      error.response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
        data: {},
      };

      expect(noteFailureKey(error, 'translations:address_note_gone')).toBe(
        'translations:address_note_gone',
      );
      expect(noteFailureKey(error, 'translations:address_note_job_gone')).toBe(
        'translations:address_note_job_gone',
      );
    });

    it('returns connection failed key when Axios error has no response (network error)', () => {
      const error = new AxiosError('Network Error');
      expect(noteFailureKey(error, 'translations:address_note_gone')).toBe(
        'translations:address_note_failed',
      );
    });

    it('returns server failed key for non-404 Axios error with response', () => {
      const error = new AxiosError('Internal Server Error');
      error.response = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as any,
        data: {},
      };

      expect(noteFailureKey(error, 'translations:address_note_gone')).toBe(
        'translations:address_note_failed_server',
      );
    });

    it('returns server failed key for non-Axios generic error', () => {
      expect(
        noteFailureKey(new Error('Unknown'), 'translations:address_note_gone'),
      ).toBe('translations:address_note_failed_server');
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

    it('shows server failure alert when toggleUpvote fails with generic error', async () => {
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
        i18n.t('translations:address_note_failed_server'),
      );

      toggleSpy.mockRestore();
    });

    it('shows note gone alert when toggleUpvote fails with 404 (note deleted meanwhile)', async () => {
      const error404 = new AxiosError('Not Found');
      error404.response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
        data: {},
      };
      const toggleSpy = jest
        .spyOn(services.commentService, 'toggleUpvote')
        .mockRejectedValueOnce(error404);

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.toggleUpvote('note-123');
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_failed_title'),
        i18n.t('translations:address_note_gone'),
      );

      toggleSpy.mockRestore();
    });

    it('shows connection alert when toggleUpvote fails with network error (no response)', async () => {
      const netError = new AxiosError('Network Error');
      const toggleSpy = jest
        .spyOn(services.commentService, 'toggleUpvote')
        .mockRejectedValueOnce(netError);

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

    it('invalidates inProgressOrders on failure to clear stale notes (Row 82 review)', async () => {
      const toggleSpy = jest
        .spyOn(services.commentService, 'toggleUpvote')
        .mockRejectedValueOnce(new Error('Failed'));

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.toggleUpvote('note-123');
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });

      toggleSpy.mockRestore();
    });

    it('guards against rapid duplicate toggleUpvote while mutation is in-flight (Row 82 review)', async () => {
      let resolvePromise: (value: any) => void;
      const deferred = new Promise(resolve => {
        resolvePromise = resolve;
      });
      const toggleSpy = jest
        .spyOn(services.commentService, 'toggleUpvote')
        .mockReturnValueOnce(deferred as any);

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isBusy('note-123')).toBe(false);

      act(() => {
        result.current.toggleUpvote('note-123');
      });

      // Note is busy while in flight
      expect(result.current.isBusy('note-123')).toBe(true);
      expect(result.current.isBusy('note-other')).toBe(false);

      // Rapid second press while in flight is ignored
      act(() => {
        result.current.toggleUpvote('note-123');
      });

      // Allow microtask to run so toggleSpy is invoked
      await act(async () => {
        await Promise.resolve();
      });

      expect(toggleSpy).toHaveBeenCalledTimes(1);
      expect(result.current.isBusy('note-123')).toBe(true);

      // Settle mutation
      await act(async () => {
        resolvePromise!({ ok: true });
        await deferred;
      });

      // Free after settling
      expect(result.current.isBusy('note-123')).toBe(false);
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

    it('shows server failure alert when flagComment fails with generic error', async () => {
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
        i18n.t('translations:address_note_failed_server'),
      );

      flagSpy.mockRestore();
    });

    it('shows note gone alert when flagComment fails with 404', async () => {
      const error404 = new AxiosError('Not Found');
      error404.response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
        data: {},
      };
      const flagSpy = jest
        .spyOn(services.commentService, 'flagComment')
        .mockRejectedValueOnce(error404);

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.flagNote({ id: 'note-456' });
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_failed_title'),
        i18n.t('translations:address_note_gone'),
      );

      flagSpy.mockRestore();
    });

    it('shows connection alert when flagComment fails with network error (no response)', async () => {
      const netError = new AxiosError('Network Error');
      const flagSpy = jest
        .spyOn(services.commentService, 'flagComment')
        .mockRejectedValueOnce(netError);

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

    it('invalidates inProgressOrders on flag failure to clear stale notes (Row 82 review)', async () => {
      const flagSpy = jest
        .spyOn(services.commentService, 'flagComment')
        .mockRejectedValueOnce(new Error('Failed'));

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.flagNote({ id: 'note-456' });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });

      flagSpy.mockRestore();
    });

    it('guards against rapid duplicate flagNote while mutation is in-flight (Row 82 review)', async () => {
      let resolvePromise: (value: any) => void;
      const deferred = new Promise(resolve => {
        resolvePromise = resolve;
      });
      const flagSpy = jest
        .spyOn(services.commentService, 'flagComment')
        .mockReturnValueOnce(deferred as any);

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isBusy('note-456')).toBe(false);

      act(() => {
        result.current.flagNote({ id: 'note-456' });
      });

      expect(result.current.isBusy('note-456')).toBe(true);

      // Second press while in flight is ignored
      act(() => {
        result.current.flagNote({ id: 'note-456' });
      });

      // Allow microtask to run so flagSpy is invoked
      await act(async () => {
        await Promise.resolve();
      });

      expect(flagSpy).toHaveBeenCalledTimes(1);
      expect(result.current.isBusy('note-456')).toBe(true);

      // Settle mutation
      await act(async () => {
        resolvePromise!({ ok: true });
        await deferred;
      });

      expect(result.current.isBusy('note-456')).toBe(false);
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

    it('shows server failure alert when deleteComment fails with generic error', async () => {
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
        i18n.t('translations:address_note_failed_server'),
      );

      deleteSpy.mockRestore();
    });

    it('shows note gone alert when deleteComment fails with 404', async () => {
      const error404 = new AxiosError('Not Found');
      error404.response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
        data: {},
      };
      const deleteSpy = jest
        .spyOn(services.commentService, 'deleteComment')
        .mockRejectedValueOnce(error404);

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.deleteNote('note-789');
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_failed_title'),
        i18n.t('translations:address_note_gone'),
      );

      deleteSpy.mockRestore();
    });

    it('shows connection alert when deleteComment fails with network error (no response)', async () => {
      const netError = new AxiosError('Network Error');
      const deleteSpy = jest
        .spyOn(services.commentService, 'deleteComment')
        .mockRejectedValueOnce(netError);

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

    it('invalidates inProgressOrders on delete failure to clear stale notes (Row 82 review)', async () => {
      const deleteSpy = jest
        .spyOn(services.commentService, 'deleteComment')
        .mockRejectedValueOnce(new Error('Delete error'));

      const { result } = renderHook(() => useAddressNotes(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.deleteNote('note-789');
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });

      deleteSpy.mockRestore();
    });
  });
});
