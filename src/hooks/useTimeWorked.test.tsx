import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { client } from '@app/services/Client';
import { QueryKeys } from '@app/utilities/queryKeys';
import { CURRENT_REFETCH_MS } from '@app/utilities/timeWorked';
import {
  useCurrentTimeWorked,
  useTimeWorkedPages,
  useCoopTotals,
} from './useTimeWorked';
import { services } from '@app/services/service';
import {
  CoopTotals,
  CurrentTimeWorked,
  TimeWorkedRange,
} from '@app/types/timeWorked';

jest.mock('@app/services/Client', () => ({
  client: {
    get: jest.fn(),
  },
}));

describe('useTimeWorked hooks (spec 0040, AC-10, AC-11, AC-12)', () => {
  let queryClient: QueryClient;
  let appStateListeners: ((state: AppStateStatus) => void)[] = [];

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const sampleWorkingShift: CurrentTimeWorked = {
    asOf: '2026-11-20T10:00:00.000Z',
    shiftBreakMinutes: 30,
    shift: {
      startedAt: '2026-11-20T07:00:00.000Z',
      onBreakSince: null,
      workSeconds: 10800,
      jobSeconds: 7200,
      paidWaitSeconds: 600,
      unpaidSeconds: 3000,
      moneyCents: 3850,
      centsPerHour: 1283,
      currencyCode: 'EUR',
    },
  };

  const sampleNoShift: CurrentTimeWorked = {
    asOf: '2026-11-20T10:00:00.000Z',
    shiftBreakMinutes: 30,
    shift: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListeners = [];
    AppState.currentState = 'active';

    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event: string, listener: any) => {
        if (event === 'change') {
          appStateListeners.push(listener);
        }
        return {
          remove: () => {
            appStateListeners = appStateListeners.filter(l => l !== listener);
          },
        } as any;
      });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
    jest.restoreAllMocks();
  });

  describe('useCurrentTimeWorked (AC-10)', () => {
    it('fetches time-worked/current on mount', async () => {
      (client.get as jest.Mock).mockResolvedValueOnce({
        data: { error: null, result: sampleWorkingShift },
      });

      const { result } = renderHook(() => useCurrentTimeWorked(true), {
        wrapper,
      });

      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      expect(client.get).toHaveBeenCalledWith('time-worked/current');
      expect(result.current.view.kind).toBe('working');
    });

    it('refetches when user query completes a successful fetch', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: sampleWorkingShift },
      });

      const { result } = renderHook(() => useCurrentTimeWorked(true), {
        wrapper,
      });
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      const initialCalls = (client.get as jest.Mock).mock.calls.length;

      // Successful fetch of QueryKeys.user
      await act(async () => {
        await queryClient.fetchQuery({
          queryKey: [QueryKeys.user],
          queryFn: () => Promise.resolve({ id: 'courier-1', status: 'ONLINE' }),
        });
      });

      await waitFor(() =>
        expect((client.get as jest.Mock).mock.calls.length).toBe(
          initialCalls + 1,
        ),
      );
      expect((client.get as jest.Mock).mock.calls[initialCalls][0]).toBe(
        'time-worked/current',
      );
    });

    it('refetches when inProgressOrders query completes a successful fetch', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: sampleWorkingShift },
      });

      const { result } = renderHook(() => useCurrentTimeWorked(true), {
        wrapper,
      });
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      const initialCalls = (client.get as jest.Mock).mock.calls.length;

      // Successful fetch of QueryKeys.inProgressOrders
      await act(async () => {
        await queryClient.fetchQuery({
          queryKey: [QueryKeys.inProgressOrders],
          queryFn: () => Promise.resolve([]),
        });
      });

      await waitFor(() =>
        expect((client.get as jest.Mock).mock.calls.length).toBe(
          initialCalls + 1,
        ),
      );
    });

    it('does NOT refetch when an unrelated query completes a successful fetch', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: sampleWorkingShift },
      });

      const { result } = renderHook(() => useCurrentTimeWorked(true), {
        wrapper,
      });
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      const initialCalls = (client.get as jest.Mock).mock.calls.length;

      // Fetch of an unrelated query key
      await act(async () => {
        await queryClient.fetchQuery({
          queryKey: ['someOtherQueryKey'],
          queryFn: () => Promise.resolve({ some: 'data' }),
        });
        await queryClient.fetchQuery({
          queryKey: [QueryKeys.earningsSummary],
          queryFn: () => Promise.resolve({ totalEarnings: 100 }),
        });
      });

      // Should not have triggered refetch
      expect((client.get as jest.Mock).mock.calls.length).toBe(initialCalls);
    });

    it('refetches when returning to the foreground (AppState change to active)', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: sampleWorkingShift },
      });

      const { result } = renderHook(() => useCurrentTimeWorked(true), {
        wrapper,
      });
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      const initialCalls = (client.get as jest.Mock).mock.calls.length;

      // Transition to background, then back to active
      act(() => {
        appStateListeners.forEach(listener => listener('background'));
      });
      expect((client.get as jest.Mock).mock.calls.length).toBe(initialCalls);

      act(() => {
        appStateListeners.forEach(listener => listener('active'));
      });

      await waitFor(() =>
        expect((client.get as jest.Mock).mock.calls.length).toBe(
          initialCalls + 1,
        ),
      );
    });

    it('does NOT refetch when queryClient.setQueryData updates user or inProgressOrders (manual updates are ignored) (AC-10)', async () => {
      const getCurrentSpy = jest.spyOn(
        services.timeWorkedService,
        'getCurrent',
      );
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: sampleWorkingShift },
      });

      const { result } = renderHook(() => useCurrentTimeWorked(true), {
        wrapper,
      });
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      const callsAfterMount = getCurrentSpy.mock.calls.length;

      // 1. setQueryData on QueryKeys.user (simulating e.g. location update fix)
      await act(async () => {
        queryClient.setQueryData([QueryKeys.user], {
          id: 'courier-1',
          status: 'ONLINE',
          lat: 39.36,
          lng: 22.94,
        });
      });

      // 2. setQueryData on QueryKeys.inProgressOrders
      await act(async () => {
        queryClient.setQueryData(
          [QueryKeys.inProgressOrders],
          [{ id: 'del-1' }],
        );
      });

      // getCurrent must NOT have been called by manual setQueryData
      expect(getCurrentSpy).toHaveBeenCalledTimes(callsAfterMount);

      // 3. A real fetch (fetchQuery / refetch) of that key still DOES call getCurrent
      await act(async () => {
        await queryClient.fetchQuery({
          queryKey: [QueryKeys.user],
          queryFn: () => Promise.resolve({ id: 'courier-1', status: 'ONLINE' }),
        });
      });

      await waitFor(() =>
        expect(getCurrentSpy).toHaveBeenCalledTimes(callsAfterMount + 1),
      );
    });

    it('does NOT refetch when a trigger key is fetched while AppState.currentState is not active (AC-10)', async () => {
      const getCurrentSpy = jest.spyOn(
        services.timeWorkedService,
        'getCurrent',
      );
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: sampleWorkingShift },
      });

      const { result } = renderHook(() => useCurrentTimeWorked(true), {
        wrapper,
      });
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      const callsAfterMount = getCurrentSpy.mock.calls.length;

      // Put AppState into background
      AppState.currentState = 'background';

      // Real fetch of QueryKeys.user while in background
      await act(async () => {
        await queryClient.fetchQuery({
          queryKey: [QueryKeys.user],
          queryFn: () => Promise.resolve({ id: 'courier-1', status: 'ONLINE' }),
        });
      });

      // Must not call getCurrent while not active
      expect(getCurrentSpy).toHaveBeenCalledTimes(callsAfterMount);
    });

    it('refetches when inFront changes from false to true (Home back in front), calling getCurrent once more, but only once on mount with inFront true (AC-10)', async () => {
      const getCurrentSpy = jest.spyOn(
        services.timeWorkedService,
        'getCurrent',
      );
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: sampleWorkingShift },
      });

      // 1. Initial mount with inFront=true calls getCurrent only once
      const { result: inFrontHook } = renderHook(
        () => useCurrentTimeWorked(true),
        { wrapper },
      );
      await waitFor(() =>
        expect(inFrontHook.current.query.isSuccess).toBe(true),
      );
      expect(getCurrentSpy).toHaveBeenCalledTimes(1);

      getCurrentSpy.mockClear();

      // 2. Rendering hook with inFront=false initially calls getCurrent once on mount
      const { result: togglingHook, rerender } = renderHook(
        ({ inFront }) => useCurrentTimeWorked(inFront),
        {
          wrapper,
          initialProps: { inFront: false },
        },
      );
      await waitFor(() =>
        expect(togglingHook.current.query.isSuccess).toBe(true),
      );
      expect(getCurrentSpy).toHaveBeenCalledTimes(1);

      // Now bring Home back in front (inFront: true)
      act(() => {
        rerender({ inFront: true });
      });

      // Must call getCurrent once more
      await waitFor(() => expect(getCurrentSpy).toHaveBeenCalledTimes(2));
    });

    it('refetchInterval is 5 minutes only while a shift is open, screen in front, and app active, false otherwise', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: sampleWorkingShift },
      });

      // 1. With open shift, inFront=true, appActive=true
      const { result } = renderHook(() => useCurrentTimeWorked(true), {
        wrapper,
      });
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      // Inspect refetchInterval from query options
      const query = queryClient
        .getQueryCache()
        .find({ queryKey: [QueryKeys.timeWorkedCurrent] });
      const refetchIntervalFn = (query as any)?.options?.refetchInterval;
      expect(typeof refetchIntervalFn).toBe('function');

      // Evaluates to CURRENT_REFETCH_MS (5 min = 300,000 ms)
      expect(refetchIntervalFn(query)).toBe(CURRENT_REFETCH_MS);

      // 2. When shift is null -> returns false
      const nullShiftQuery = {
        state: { data: sampleNoShift },
      };
      expect(refetchIntervalFn(nullShiftQuery)).toBe(false);

      // 3. When inFront=false -> returns false
      const { result: notInFront } = renderHook(
        () => useCurrentTimeWorked(false),
        { wrapper },
      );
      await waitFor(() =>
        expect(notInFront.current.query.isSuccess).toBe(true),
      );
      const notInFrontQuery = queryClient
        .getQueryCache()
        .find({ queryKey: [QueryKeys.timeWorkedCurrent] });
      const notInFrontIntervalFn = (notInFrontQuery as any)?.options
        ?.refetchInterval;
      expect(notInFrontIntervalFn(query)).toBe(false);

      // 4. When app becomes background -> returns false
      act(() => {
        appStateListeners.forEach(listener => listener('background'));
      });
      const bgQuery = queryClient
        .getQueryCache()
        .find({ queryKey: [QueryKeys.timeWorkedCurrent] });
      const bgIntervalFn = (bgQuery as any)?.options?.refetchInterval;
      expect(bgIntervalFn(query)).toBe(false);
    });

    it('local tick redraws every 30 s with fake timers, advancing workSeconds', async () => {
      const fixedStart = Date.parse('2026-11-20T10:00:00.000Z');
      jest.useFakeTimers({ now: fixedStart });

      try {
        (client.get as jest.Mock).mockResolvedValue({
          data: { error: null, result: sampleWorkingShift },
        });

        const { result } = renderHook(() => useCurrentTimeWorked(true), {
          wrapper,
        });

        // Let the query resolve
        await act(async () => {
          await jest.advanceTimersByTimeAsync(0);
        });

        expect(result.current.view.kind).toBe('working');
        if (result.current.view.kind === 'working') {
          const initialWorkSeconds = result.current.view.workSeconds;

          // Advance 30 seconds
          act(() => {
            jest.advanceTimersByTime(30000);
          });

          if (result.current.view.kind === 'working') {
            expect(result.current.view.workSeconds).toBe(
              initialWorkSeconds + 30,
            );
          }

          // Advance another 30 seconds
          act(() => {
            jest.advanceTimersByTime(30000);
          });

          if (result.current.view.kind === 'working') {
            expect(result.current.view.workSeconds).toBe(
              initialWorkSeconds + 60,
            );
          }
        }
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('useTimeWorkedPages (AC-11, AC-18)', () => {
    it('fetches time-worked range for initial page 0', async () => {
      const sampleRange: TimeWorkedRange = {
        recordedFrom: '2026-11-19T00:00:00.000Z',
        currencyCode: 'EUR',
        days: [],
        shifts: [],
      };

      (client.get as jest.Mock).mockResolvedValueOnce({
        data: { error: null, result: sampleRange },
      });

      const { result } = renderHook(() => useTimeWorkedPages(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(client.get).toHaveBeenCalledWith(
        'time-worked',
        expect.objectContaining({
          params: expect.objectContaining({
            from: expect.any(String),
            to: expect.any(String),
          }),
        }),
      );
    });

    it('getNextPageParam returns undefined when recordedFrom is null', async () => {
      const pageWithoutRecordedFrom: TimeWorkedRange = {
        recordedFrom: null,
        currencyCode: 'EUR',
        days: [],
        shifts: [],
      };

      (client.get as jest.Mock).mockResolvedValueOnce({
        data: { error: null, result: pageWithoutRecordedFrom },
      });

      const { result } = renderHook(() => useTimeWorkedPages(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.hasNextPage).toBe(false);
    });

    it('getNextPageParam returns next page number when recordedFrom is older than the page from date, and stops (returns undefined) when page reaches recordedFrom', async () => {
      // Suppose today is 2026-11-20.
      // Page 0 from is 2026-11-14.
      // If recordedFrom is 2026-11-01, it is older than 2026-11-14 -> has next page!
      const page0: TimeWorkedRange = {
        recordedFrom: '2026-11-01T00:00:00.000Z',
        currencyCode: 'EUR',
        days: [],
        shifts: [],
      };

      (client.get as jest.Mock).mockResolvedValueOnce({
        data: { error: null, result: page0 },
      });

      const { result } = renderHook(() => useTimeWorkedPages(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.hasNextPage).toBe(true);

      // Now if page 0 had recordedFrom set to '2026-11-18' (within page 0 from: 2026-11-14):
      const pageReached: TimeWorkedRange = {
        recordedFrom: '2026-11-18T00:00:00.000Z',
        currencyCode: 'EUR',
        days: [],
        shifts: [],
      };

      const queryClient2 = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      const wrapper2 = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient2}>
          {children}
        </QueryClientProvider>
      );

      (client.get as jest.Mock).mockResolvedValueOnce({
        data: { error: null, result: pageReached },
      });

      const { result: result2 } = renderHook(() => useTimeWorkedPages(), {
        wrapper: wrapper2,
      });
      await waitFor(() => expect(result2.current.isSuccess).toBe(true));

      expect(result2.current.hasNextPage).toBe(false);
    });
  });

  describe('useCoopTotals (AC-12)', () => {
    it("calls 'time-worked/coop-totals' and returns result", async () => {
      const mockCoop: CoopTotals = {
        thisWeek: {
          weekStart: '2026-11-16',
          tooFewRiders: false,
          workSeconds: 150000,
          unpaidShare: 0.22,
          centsPerHour: 1350,
        },
        lastWeek: {
          weekStart: '2026-11-09',
          tooFewRiders: true,
        },
      };

      (client.get as jest.Mock).mockResolvedValueOnce({
        data: { error: null, result: mockCoop },
      });

      const { result } = renderHook(() => useCoopTotals(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(client.get).toHaveBeenCalledWith('time-worked/coop-totals');
      expect(result.current.data).toEqual(mockCoop);
    });
  });
});
