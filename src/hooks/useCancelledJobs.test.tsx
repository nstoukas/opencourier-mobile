import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { client } from '@app/services/Client';
import { QueryKeys } from '@app/utilities/queryKeys';
import { useCancelledJobs } from './useCancelledJobs';
import {
  alertNewCancelledJobs,
  CancelledJob,
} from '@app/services/cancelledJobs/cancelledJobs';

jest.mock('@app/services/Client', () => ({
  client: {
    get: jest.fn(),
  },
}));

jest.mock('@app/services/cancelledJobs/cancelledJobs', () => {
  const actual = jest.requireActual(
    '@app/services/cancelledJobs/cancelledJobs',
  );
  return {
    ...actual,
    alertNewCancelledJobs: jest.fn(() => Promise.resolve([])),
  };
});

describe('useCancelledJobs (spec 0015, AC-7, AC-12)', () => {
  let appStateListeners: Array<(state: AppStateStatus) => void> = [];
  let subscriptionRemoveSpy: jest.Mock;
  let activeQueryClient: QueryClient | undefined;

  const mockCancelledJobs: Partial<CancelledJob>[] = [
    {
      id: 'del-canc-1',
      pickupBusinessName: 'Pizza Roma',
      cancelledBy: 'RESTAURANT',
      pickedUp: true,
      payAmount: 350,
    },
  ];

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
      <QueryClientProvider client={activeQueryClient!}>
        {children}
      </QueryClientProvider>
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

  it('GETs deliveries/cancelled-jobs and returns result.data (item 3)', async () => {
    (client.get as jest.Mock).mockResolvedValueOnce({
      data: {
        error: null,
        result: { data: mockCancelledJobs },
      },
    });

    const { result, unmount } = renderHook(() => useCancelledJobs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.get).toHaveBeenCalledWith('deliveries/cancelled-jobs');
    expect(result.current.data).toEqual(mockCancelledJobs);
    unmount();
  });

  it('calls alertNewCancelledJobs when data arrives with jobs (AC-7)', async () => {
    (client.get as jest.Mock).mockResolvedValueOnce({
      data: {
        error: null,
        result: { data: mockCancelledJobs },
      },
    });

    const { result, unmount } = renderHook(() => useCancelledJobs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(alertNewCancelledJobs).toHaveBeenCalledWith(mockCancelledJobs);
    unmount();
  });

  it('does not call alertNewCancelledJobs when data is empty', async () => {
    (client.get as jest.Mock).mockResolvedValueOnce({
      data: {
        error: null,
        result: { data: [] },
      },
    });

    const { result, unmount } = renderHook(() => useCancelledJobs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(alertNewCancelledJobs).not.toHaveBeenCalled();
    unmount();
  });

  it('refetches when AppState transitions to active', async () => {
    (client.get as jest.Mock).mockResolvedValue({
      data: {
        error: null,
        result: { data: mockCancelledJobs },
      },
    });

    const { result, unmount } = renderHook(() => useCancelledJobs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.get).toHaveBeenCalledTimes(1);

    // Transition to background
    triggerAppState('background');
    expect(client.get).toHaveBeenCalledTimes(1);

    // Transition back to active -> triggers refetch
    triggerAppState('active');
    await waitFor(() => expect(client.get).toHaveBeenCalledTimes(2));

    unmount();
  });

  it('cleans up AppState subscription on unmount', () => {
    (client.get as jest.Mock).mockResolvedValue({
      data: { error: null, result: { data: [] } },
    });

    const { unmount } = renderHook(() => useCancelledJobs(), {
      wrapper: createWrapper(),
    });

    expect(subscriptionRemoveSpy).not.toHaveBeenCalled();
    unmount();
    expect(subscriptionRemoveSpy).toHaveBeenCalledTimes(1);
  });

  describe('polling interval scoping (inFront and AppState gating)', () => {
    it('sets refetchInterval to 60000 ms while inFront is true and AppState is active', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: { data: mockCancelledJobs } },
      });

      const { result, unmount } = renderHook(() => useCancelledJobs(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const query = activeQueryClient
        ?.getQueryCache()
        .find({ queryKey: [QueryKeys.cancelledJobs] });
      const observer = (query as any)?.observers?.[0];
      expect(observer?.options?.refetchInterval).toBe(60_000);
      unmount();
    });

    it('sets refetchInterval to false when inFront is false', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: { data: mockCancelledJobs } },
      });

      const { result, unmount } = renderHook(() => useCancelledJobs(false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const query = activeQueryClient
        ?.getQueryCache()
        .find({ queryKey: [QueryKeys.cancelledJobs] });
      const observer = (query as any)?.observers?.[0];
      expect(observer?.options?.refetchInterval).toBe(false);
      unmount();
    });

    it('sets refetchInterval to false when AppState becomes inactive or background', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: { data: mockCancelledJobs } },
      });

      const { result, unmount } = renderHook(() => useCancelledJobs(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const query = activeQueryClient
        ?.getQueryCache()
        .find({ queryKey: [QueryKeys.cancelledJobs] });
      const observer = (query as any)?.observers?.[0];
      expect(observer?.options?.refetchInterval).toBe(60_000);

      // App transitions to background
      triggerAppState('background');

      await waitFor(() => {
        expect(observer?.options?.refetchInterval).toBe(false);
      });

      // App returns to active -> poll resumes
      triggerAppState('active');

      await waitFor(() => {
        expect(observer?.options?.refetchInterval).toBe(60_000);
      });

      unmount();
    });
  });
});
