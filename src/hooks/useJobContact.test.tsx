import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { client } from '@app/services/Client';
import { QueryKeys } from '@app/utilities/queryKeys';
import { useJobContact, JobContact } from './useJobContact';

jest.mock('@app/services/Client', () => ({
  client: {
    get: jest.fn(),
  },
}));

describe('useJobContact (row 72, decisions 72.5, 72.7, review fix 26bab10)', () => {
  let appStateListeners: Array<(state: AppStateStatus) => void> = [];
  let subscriptionRemoveSpy: jest.Mock;
  let activeQueryClient: QueryClient | undefined;

  const mockJobContact: JobContact = {
    dispatchPhoneNumber: '+302421012345',
  };

  const createWrapper = () => {
    activeQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={activeQueryClient!}>{children}</QueryClientProvider>
    );
  };

  const triggerAppState = (state: AppStateStatus) => {
    AppState.currentState = state;
    act(() => {
      appStateListeners.forEach(listener => listener(state));
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListeners = [];
    AppState.currentState = 'active';
    subscriptionRemoveSpy = jest.fn();

    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event: string, listener: any) => {
        if (event === 'change') {
          appStateListeners.push(listener);
        }
        return {
          remove: () => {
            subscriptionRemoveSpy();
            appStateListeners = appStateListeners.filter(l => l !== listener);
          },
        } as any;
      });
  });

  afterEach(() => {
    activeQueryClient?.clear();
    jest.restoreAllMocks();
  });

  it("GETs 'config/contact' with the app's client and returns data.result", async () => {
    (client.get as jest.Mock).mockResolvedValueOnce({
      data: {
        error: null,
        result: mockJobContact,
      },
    });

    const { result, unmount } = renderHook(() => useJobContact(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.get).toHaveBeenCalledWith('config/contact');
    expect(result.current.data).toEqual(mockJobContact);
    unmount();
  });

  it("returns null dispatchPhoneNumber when the route returns dispatchPhoneNumber: null", async () => {
    (client.get as jest.Mock).mockResolvedValueOnce({
      data: {
        error: null,
        result: { dispatchPhoneNumber: null },
      },
    });

    const { result, unmount } = renderHook(() => useJobContact(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.get).toHaveBeenCalledWith('config/contact');
    expect(result.current.data).toEqual({ dispatchPhoneNumber: null });
    unmount();
  });

  it("refetches when AppState changes to 'active'", async () => {
    (client.get as jest.Mock).mockResolvedValue({
      data: {
        error: null,
        result: mockJobContact,
      },
    });

    const { result, unmount } = renderHook(() => useJobContact(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.get).toHaveBeenCalledTimes(1);

    // Transition to background: refetch must NOT be called
    triggerAppState('background');
    expect(client.get).toHaveBeenCalledTimes(1);

    // Transition to active: refetch MUST be called
    triggerAppState('active');
    await waitFor(() => expect(client.get).toHaveBeenCalledTimes(2));
    unmount();
  });

  it('removes AppState listener on unmount', async () => {
    (client.get as jest.Mock).mockResolvedValue({
      data: {
        error: null,
        result: mockJobContact,
      },
    });

    const { unmount } = renderHook(() => useJobContact(), {
      wrapper: createWrapper(),
    });

    expect(subscriptionRemoveSpy).not.toHaveBeenCalled();
    unmount();
    expect(subscriptionRemoveSpy).toHaveBeenCalledTimes(1);
  });

  describe('polling interval (inFront and AppState gating, review fix 26bab10)', () => {
    const TEN_MINUTES_MS = 10 * 60_000;

    it('sets refetchInterval to 600000 ms (10 minutes) while inFront is true and AppState is active', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: mockJobContact },
      });

      const { result, unmount } = renderHook(() => useJobContact(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const query = activeQueryClient
        ?.getQueryCache()
        .find({ queryKey: [QueryKeys.jobContact] });
      const observer = (query as any)?.observers?.[0];
      expect(observer?.options?.refetchInterval).toBe(TEN_MINUTES_MS);
      unmount();
    });

    it('sets refetchInterval to false when inFront is false', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: mockJobContact },
      });

      const { result, unmount } = renderHook(() => useJobContact(false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const query = activeQueryClient
        ?.getQueryCache()
        .find({ queryKey: [QueryKeys.jobContact] });
      const observer = (query as any)?.observers?.[0];
      expect(observer?.options?.refetchInterval).toBe(false);
      unmount();
    });

    it('sets refetchInterval to false when AppState is backgrounded', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: mockJobContact },
      });

      const { result, unmount } = renderHook(() => useJobContact(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const query = activeQueryClient
        ?.getQueryCache()
        .find({ queryKey: [QueryKeys.jobContact] });
      const observer = (query as any)?.observers?.[0];
      expect(observer?.options?.refetchInterval).toBe(TEN_MINUTES_MS);

      // App transitions to background
      triggerAppState('background');

      await waitFor(() => {
        expect(observer?.options?.refetchInterval).toBe(false);
      });
      unmount();
    });

    it('resumes refetchInterval of 600000 ms when returning to active while inFront is true', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: mockJobContact },
      });

      const { result, unmount } = renderHook(() => useJobContact(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const query = activeQueryClient
        ?.getQueryCache()
        .find({ queryKey: [QueryKeys.jobContact] });
      const observer = (query as any)?.observers?.[0];
      expect(observer?.options?.refetchInterval).toBe(TEN_MINUTES_MS);

      // App transitions to background -> stops polling
      triggerAppState('background');
      await waitFor(() => {
        expect(observer?.options?.refetchInterval).toBe(false);
      });

      // App transitions back to active -> resumes polling
      triggerAppState('active');
      await waitFor(() => {
        expect(observer?.options?.refetchInterval).toBe(TEN_MINUTES_MS);
      });
      unmount();
    });
  });
});
