import React from 'react';
import {
  render,
  renderHook,
  act,
  cleanup,
  waitFor,
} from '@testing-library/react-native';
import { AppState, AppStateStatus, Platform } from 'react-native';
import notifee from '@notifee/react-native';
import '@app/localization/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Geolocation from 'react-native-geolocation-service';
import { Polyline } from 'react-native-maps';
import { Order, User, UserStatus } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { TrackingMode, WATCH_OPTIONS } from '@app/utilities/locationTracking';
import { QueryKeys } from '@app/utilities/queryKeys';
import { stopOnlineService } from '@app/services/onlineService';
import * as sosStore from '@app/services/sosStore';
import useUser from '@app/hooks/useUser';
import { getOwnPosition, setOwnPosition } from '@app/services/ownPosition';
import { useLocationTracking } from './useLocationTracking';

const mockSetUserLocation = jest.fn().mockResolvedValue({});
const mockGetInProgressOrders = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@app/services/service', () => ({
  services: {
    userService: {
      setUserLocation: (...args: any[]) => mockSetUserLocation(...args),
      getUser: () => mockGetUser(),
    },
    orderService: {
      getInProgressOrders: () => mockGetInProgressOrders(),
    },
  },
}));

describe('useLocationTracking (Row 67, Clauses 1, 2, 3, 4)', () => {
  let queryClient: QueryClient;
  let watchIdCounter = 100;
  let watchCallback: ((pos: any) => void) | undefined;
  let getCurrentPositionCallback: ((pos: any) => void) | undefined;
  const originalOS = Platform.OS;
  let appStateListeners: Array<(state: AppStateStatus) => void> = [];

  const flushMicrotasks = async () => {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
    }
  };

  const triggerAppState = (state: AppStateStatus) => {
    AppState.currentState = state;
    act(() => {
      appStateListeners.forEach(listener => listener(state));
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    AppState.currentState = 'active';
    appStateListeners = [];
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

    watchIdCounter = 100;
    watchCallback = undefined;
    getCurrentPositionCallback = undefined;

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      },
    });

    (Geolocation.watchPosition as jest.Mock).mockImplementation(
      (success: (pos: any) => void) => {
        watchCallback = success;
        watchIdCounter += 1;
        return watchIdCounter;
      },
    );

    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
      (success: (pos: any) => void) => {
        getCurrentPositionCallback = success;
      },
    );

    mockGetUser.mockResolvedValue(null);
    mockGetInProgressOrders.mockResolvedValue([]);

    (notifee.createChannel as jest.Mock).mockImplementation(() =>
      Promise.resolve('online'),
    );
    (notifee.displayNotification as jest.Mock).mockImplementation(() =>
      Promise.resolve('online-status'),
    );
    (notifee.stopForegroundService as jest.Mock).mockImplementation(() =>
      Promise.resolve(),
    );
  });

  afterEach(async () => {
    await stopOnlineService().catch(() => {});
    cleanup();
    queryClient.clear();
    Platform.OS = originalOS;
  });

  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  const onlineUser: User = {
    id: 'rider-1',
    status: UserStatus.Online,
  } as User;

  const offlineUser: User = {
    id: 'rider-1',
    status: UserStatus.Offline,
  } as User;

  const activeJob = {
    id: 'order-1',
    status: OrderStatus.dispatched,
  } as any;

  describe('Clause 1: Offline mode & watch lifecycle', () => {
    it('while mode is off, Geolocation.watchPosition and setUserLocation are never called', async () => {
      const { result } = renderHook(
        () => useLocationTracking(offlineUser, true),
        { wrapper: createWrapper() },
      );

      expect(result.current).toBe(TrackingMode.Off);
      expect(Geolocation.watchPosition).not.toHaveBeenCalled();
      expect(mockSetUserLocation).not.toHaveBeenCalled();
    });

    it('while permission is false, mode is off and Geolocation.watchPosition is never called', async () => {
      const { result } = renderHook(
        () => useLocationTracking(onlineUser, false),
        { wrapper: createWrapper() },
      );

      expect(result.current).toBe(TrackingMode.Off);
      expect(Geolocation.watchPosition).not.toHaveBeenCalled();
      expect(mockSetUserLocation).not.toHaveBeenCalled();
    });

    it('switching user from Online to Offline calls Geolocation.clearWatch with the watch id', async () => {
      const { result, rerender } = renderHook(
        ({ user, hasPermission }) => useLocationTracking(user, hasPermission),
        {
          initialProps: { user: onlineUser, hasPermission: true },
          wrapper: createWrapper(),
        },
      );

      expect(result.current).toBe(TrackingMode.Waiting);
      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
      const activeWatchId = (Geolocation.watchPosition as jest.Mock).mock
        .results[0].value;
      expect(activeWatchId).toBe(101);

      // Rider goes Offline
      rerender({ user: offlineUser, hasPermission: true });

      expect(result.current).toBe(TrackingMode.Off);
      expect(Geolocation.clearWatch).toHaveBeenCalledTimes(1);
      expect(Geolocation.clearWatch).toHaveBeenCalledWith(101);
    });
  });

  describe('Clause 2: Watch options for waiting vs on a job', () => {
    it('passes waiting options to watchPosition when rider has no in-progress delivery', async () => {
      mockGetInProgressOrders.mockResolvedValue([]);

      const { result } = renderHook(
        () => useLocationTracking(onlineUser, true),
        { wrapper: createWrapper() },
      );

      expect(result.current).toBe(TrackingMode.Waiting);
      expect(Geolocation.watchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          ...WATCH_OPTIONS[TrackingMode.Waiting],
          showsBackgroundLocationIndicator: true,
        },
      );
    });

    it('passes job options to watchPosition when rider has an in-progress delivery', async () => {
      // Pre-seed query cache with an active job
      queryClient.setQueryData([QueryKeys.inProgressOrders], [activeJob]);

      const { result } = renderHook(
        () => useLocationTracking(onlineUser, true),
        { wrapper: createWrapper() },
      );

      expect(result.current).toBe(TrackingMode.Job);
      expect(Geolocation.watchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          ...WATCH_OPTIONS[TrackingMode.Job],
          showsBackgroundLocationIndicator: true,
        },
      );
    });
  });

  describe('Clause 3: Only one location watch runs at a time', () => {
    it('changing mode from waiting to job clears the old watch before starting the new one', async () => {
      mockGetInProgressOrders.mockResolvedValueOnce([]);

      const { result } = renderHook(
        () => useLocationTracking(onlineUser, true),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Waiting);
      });
      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
      expect(Geolocation.clearWatch).not.toHaveBeenCalled();

      // Transition to having an in-progress job
      await act(async () => {
        mockGetInProgressOrders.mockResolvedValue([activeJob]);
        await queryClient.refetchQueries({
          queryKey: [QueryKeys.inProgressOrders],
        });
      });

      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Job);
      });

      // Old watch cleared once with old id 101, watchPosition called twice in total
      expect(Geolocation.clearWatch).toHaveBeenCalledTimes(1);
      expect(Geolocation.clearWatch).toHaveBeenCalledWith(101);
      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2);
    });
  });

  describe('Clause 4: Location fix updates location without triggering refetch storm', () => {
    it('calls userService.setUserLocation with latitude (coords[1]) and longitude (coords[0]) and does NOT invalidateQueries', async () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const refetchSpy = jest.spyOn(queryClient, 'refetchQueries');

      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      expect(watchCallback).toBeDefined();

      // Simulate GPS fix arriving with latitude 39.362, longitude 22.945
      await act(async () => {
        watchCallback!({
          coords: {
            latitude: 39.362,
            longitude: 22.945,
          },
        });
      });

      expect(mockSetUserLocation).toHaveBeenCalledTimes(1);
      expect(mockSetUserLocation).toHaveBeenCalledWith({
        latitude: 39.362,
        longitude: 22.945,
      });

      // Crucial: no refetch storm triggered by the location fix
      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(refetchSpy).not.toHaveBeenCalled();
    });

    it('writes the position into setOwnPosition and the React Query cache for [QueryKeys.user] without invalidating or refetching (spec 0018, AC-5)', async () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const refetchSpy = jest.spyOn(queryClient, 'refetchQueries');

      setOwnPosition(null);
      expect(getOwnPosition()).toBeNull();

      const initialUser: User = {
        id: 'rider-1',
        status: UserStatus.Online,
        currentLocation: { latitude: 39.0, longitude: 22.0 },
      } as User;
      mockGetUser.mockResolvedValue(initialUser);
      queryClient.setQueryData([QueryKeys.user], initialUser);

      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      expect(watchCallback).toBeDefined();

      // GPS fix arrives
      await act(async () => {
        watchCallback!({
          coords: {
            latitude: 39.362,
            longitude: 22.945,
          },
        });
      });

      // Position written to setOwnPosition (AC-5)
      expect(getOwnPosition()).toEqual({
        latitude: 39.362,
        longitude: 22.945,
      });

      // Position written directly into React Query cache for [QueryKeys.user]
      const cachedUser = queryClient.getQueryData<User>([QueryKeys.user]);
      expect(cachedUser?.currentLocation).toEqual({
        latitude: 39.362,
        longitude: 22.945,
      });

      // Does not trigger any queries invalidation or refetches
      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(refetchSpy).not.toHaveBeenCalled();
    });

    it('drops a first fix that arrives after the watch was stopped by rerendering to Offline (calls neither setUserLocation nor setQueryData)', async () => {
      const setQueryDataSpy = jest.spyOn(queryClient, 'setQueryData');

      const { rerender } = renderHook(
        ({ user, hasPermission }) => useLocationTracking(user, hasPermission),
        {
          initialProps: { user: onlineUser, hasPermission: true },
          wrapper: createWrapper(),
        },
      );

      expect(getCurrentPositionCallback).toBeDefined();
      expect(watchCallback).toBeDefined();

      // Rider goes Offline (stopping the watch)
      rerender({ user: offlineUser, hasPermission: true });

      mockSetUserLocation.mockClear();
      setQueryDataSpy.mockClear();

      // A late first fix arrives from getCurrentPosition after watch stopped
      await act(async () => {
        getCurrentPositionCallback!({
          coords: {
            latitude: 39.362,
            longitude: 22.945,
          },
        });
      });

      expect(mockSetUserLocation).not.toHaveBeenCalled();
      expect(setQueryDataSpy).not.toHaveBeenCalled();

      // Late fix from watchPosition is also dropped
      await act(async () => {
        watchCallback!({
          coords: {
            latitude: 39.362,
            longitude: 22.945,
          },
        });
      });

      expect(mockSetUserLocation).not.toHaveBeenCalled();
      expect(setQueryDataSpy).not.toHaveBeenCalled();
    });

    it('drops a first fix that arrives after unmount (calls neither setUserLocation nor setQueryData)', async () => {
      const setQueryDataSpy = jest.spyOn(queryClient, 'setQueryData');

      const { unmount } = renderHook(
        () => useLocationTracking(onlineUser, true),
        { wrapper: createWrapper() },
      );

      expect(getCurrentPositionCallback).toBeDefined();

      unmount();

      mockSetUserLocation.mockClear();
      setQueryDataSpy.mockClear();

      // Late first fix arrives from getCurrentPosition after unmount
      await act(async () => {
        getCurrentPositionCallback!({
          coords: {
            latitude: 39.362,
            longitude: 22.945,
          },
        });
      });

      expect(mockSetUserLocation).not.toHaveBeenCalled();
      expect(setQueryDataSpy).not.toHaveBeenCalled();
    });
  });

  describe('Clause 5: Logout & enabled guard', () => {
    it('logout: rerendering with user undefined while a watch runs calls Geolocation.clearWatch with the live watch id', async () => {
      const { result, rerender } = renderHook(
        ({ user, hasPermission }) => useLocationTracking(user, hasPermission),
        {
          initialProps: {
            user: onlineUser as User | undefined,
            hasPermission: true,
          },
          wrapper: createWrapper(),
        },
      );

      expect(result.current).toBe(TrackingMode.Waiting);
      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
      const activeWatchId = (Geolocation.watchPosition as jest.Mock).mock
        .results[0].value;
      expect(activeWatchId).toBe(101);

      // Rider logs out: user becomes undefined
      rerender({ user: undefined, hasPermission: true });

      expect(result.current).toBe(TrackingMode.Off);
      expect(Geolocation.clearWatch).toHaveBeenCalledTimes(1);
      expect(Geolocation.clearWatch).toHaveBeenCalledWith(101);
    });

    it('rendering with no user never calls services.orderService.getInProgressOrders (enabled: !!user guard)', async () => {
      const { result } = renderHook(
        () => useLocationTracking(undefined, true),
        { wrapper: createWrapper() },
      );

      expect(result.current).toBe(TrackingMode.Off);
      expect(mockGetInProgressOrders).not.toHaveBeenCalled();
    });
  });

  describe('Row 68 (spec 0008): Foreground service notification lifecycle (AC-3, AC-4, AC-6)', () => {
    it('shows waiting notification on start, updates to job text on mode change, and NEVER calls stopForegroundService (AC-3, decision 68.8)', async () => {
      const { result } = renderHook(
        () => useLocationTracking(onlineUser, true),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Waiting);
        expect(notifee.displayNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'online-status',
            title: 'OpenCourier is online',
            body: 'Your location is shared to get offers. Go offline to stop.',
            android: expect.objectContaining({
              asForegroundService: true,
              ongoing: true,
              pressAction: { id: 'default' },
            }),
          }),
        );
      });

      // Transition to having an in-progress job
      await act(async () => {
        mockGetInProgressOrders.mockResolvedValue([activeJob]);
        await queryClient.refetchQueries({
          queryKey: [QueryKeys.inProgressOrders],
        });
      });

      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Job);
        expect(notifee.displayNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'online-status',
            title: 'OpenCourier: delivery in progress',
            body: 'Your location is shared until this delivery ends.',
          }),
        );
      });

      // Crucial: decision 68.8 says service is NEVER stopped when changing between waiting and job
      expect(notifee.stopForegroundService).not.toHaveBeenCalled();
    });

    it('stops the foreground service when rider goes Offline with no job (AC-4)', async () => {
      const { result, rerender } = renderHook(
        ({ user, hasPermission }) => useLocationTracking(user, hasPermission),
        {
          initialProps: { user: onlineUser, hasPermission: true },
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Waiting);
        expect(notifee.displayNotification).toHaveBeenCalled();
      });

      // Rider goes Offline
      rerender({ user: offlineUser, hasPermission: true });

      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Off);
        expect(notifee.stopForegroundService).toHaveBeenCalledTimes(1);
      });
    });

    it('stops the foreground service when user logs out (user becomes undefined) (AC-4)', async () => {
      const { result, rerender } = renderHook(
        ({ user, hasPermission }) => useLocationTracking(user, hasPermission),
        {
          initialProps: {
            user: onlineUser as User | undefined,
            hasPermission: true,
          },
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Waiting);
        expect(notifee.displayNotification).toHaveBeenCalled();
      });

      // Rider logs out: user becomes undefined
      rerender({ user: undefined, hasPermission: true });

      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Off);
        expect(notifee.stopForegroundService).toHaveBeenCalledTimes(1);
      });
    });

    it('a show that resolves after tracking already turned off stops the service at once (AC-4)', async () => {
      let resolveDisplay!: () => void;
      (notifee.displayNotification as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve => {
            resolveDisplay = () => resolve('online-status');
          }),
      );

      const { rerender } = renderHook(
        ({ user, hasPermission }) => useLocationTracking(user, hasPermission),
        {
          initialProps: { user: onlineUser, hasPermission: true },
          wrapper: createWrapper(),
        },
      );

      // Wait for displayNotification to be called so resolveDisplay is populated
      await waitFor(() => {
        expect(notifee.displayNotification).toHaveBeenCalled();
      });

      // Tracking turns off while show is still in flight
      rerender({ user: offlineUser, hasPermission: true });

      // Now the delayed show resolves
      await act(async () => {
        resolveDisplay();
      });

      await waitFor(() => {
        expect(notifee.stopForegroundService).toHaveBeenCalled();
      });
    });

    it('a mode change from waiting to job while the first show is still pending results in one more showOnlineService call with the job text after it resolves (and no stopForegroundService)', async () => {
      let resolveDisplay!: (id: string) => void;
      (notifee.displayNotification as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve => {
            resolveDisplay = () => resolve('online-status');
          }),
      );

      // Mount while Online with no jobs (mode: Waiting)
      const { result } = renderHook(
        () => useLocationTracking(onlineUser, true),
        {
          wrapper: createWrapper(),
        },
      );

      // The initial show is called with Waiting text and is currently pending
      await waitFor(() => {
        expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
        expect(notifee.displayNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'online-status',
            title: 'OpenCourier is online',
          }),
        );
      });

      // A job arrives while the first show is still pending
      act(() => {
        queryClient.setQueryData([QueryKeys.inProgressOrders], [activeJob]);
      });

      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Job);
      });

      // While the first show was pending, serviceRunning was still false, so text effect skipped
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);

      // Subsequent displayNotification calls resolve normally
      (notifee.displayNotification as jest.Mock).mockImplementation(() =>
        Promise.resolve('online-status'),
      );

      // Resolve the initial pending show
      await act(async () => {
        resolveDisplay('online-status');
      });

      // After resolving, the start effect checks latest.current.mode !== shownMode
      // and calls showOnlineService one more time with the Job text
      await waitFor(() => {
        expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
        expect(notifee.displayNotification).toHaveBeenLastCalledWith(
          expect.objectContaining({
            id: 'online-status',
            title: 'OpenCourier: delivery in progress',
            body: 'Your location is shared until this delivery ends.',
          }),
        );
      });

      // Crucial: no stopForegroundService was called
      expect(notifee.stopForegroundService).not.toHaveBeenCalled();
    });

    it('tracking turning off while a text update is in flight leaves no service (the final call to notifee is stopForegroundService, displayNotification is not called after it)', async () => {
      const callLog: string[] = [];

      (notifee.createChannel as jest.Mock).mockImplementation(async () => {
        callLog.push('createChannel');
        return 'online';
      });
      (notifee.displayNotification as jest.Mock).mockImplementation(
        async () => {
          callLog.push('displayNotification');
          return 'online-status';
        },
      );
      (notifee.stopForegroundService as jest.Mock).mockImplementation(
        async () => {
          callLog.push('stopForegroundService');
        },
      );

      // Start Online in Waiting mode
      const { result, rerender } = renderHook(
        ({ user, hasPermission }) => useLocationTracking(user, hasPermission),
        {
          initialProps: {
            user: onlineUser as User | undefined,
            hasPermission: true,
          },
          wrapper: createWrapper(),
        },
      );

      // Wait for initial start to complete
      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Waiting);
        expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      });

      // Prepare deferred createChannel for the upcoming text update
      let resolveTextCreateChannel!: (channelId: string) => void;
      (notifee.createChannel as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve => {
            callLog.push('createChannel');
            resolveTextCreateChannel = resolve;
          }),
      );

      // Transition to Job mode: text effect triggers showOnlineService(Job)
      act(() => {
        queryClient.setQueryData([QueryKeys.inProgressOrders], [activeJob]);
      });

      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Job);
        expect(callLog).toContain('createChannel');
      });

      // While the text update is in flight, tracking turns off (rider logs out)
      rerender({ user: undefined, hasPermission: true });

      await waitFor(() => {
        expect(result.current).toBe(TrackingMode.Off);
        expect(callLog).toContain('stopForegroundService');
      });

      // Now resolve the deferred createChannel from the text update
      await act(async () => {
        resolveTextCreateChannel('online');
      });

      await flushMicrotasks();

      // displayNotification must NOT have been called after stopForegroundService!
      // In fact, displayNotification was only called once (the initial Waiting display)
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);

      // The final call to notifee must be stopForegroundService
      expect(callLog[callLog.length - 1]).toBe('stopForegroundService');
    });

    it('the unmount cleanup sets serviceRunning back so a remount (a fresh renderHook after unmount) starts the service again while tracking', async () => {
      // Simulate React preserving hook refs across unmount and remount (Fast Refresh in dev)
      let preservedRef: any = null;
      const originalUseRef = React.useRef;
      const useRefSpy = jest
        .spyOn(React, 'useRef')
        .mockImplementation((initial: any) => {
          const stack = new Error().stack ?? '';
          if (
            stack.includes('useLocationTracking') &&
            typeof initial === 'boolean'
          ) {
            if (!preservedRef) {
              preservedRef = { current: initial };
            }
            return preservedRef;
          }
          return originalUseRef(initial);
        });

      // First mount while Online
      const first = renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
        expect(preservedRef?.current).toBe(true);
      });

      // Unmount: cleanup must set serviceRunning.current = false
      first.unmount();

      expect(preservedRef?.current).toBe(false);

      // Fresh renderHook (remount) while still tracking
      const second = renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      // Because serviceRunning was set back to false, the remounted hook starts the service again
      await waitFor(() => {
        expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
      });

      second.unmount();
      useRefSpy.mockRestore();
    });

    it('with AppState not active when tracking turns on, displayNotification is not called (AC-6)', async () => {
      AppState.currentState = 'background';

      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      await flushMicrotasks();
      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });

    it('when AppState changes to active, service starts with the mode current at that moment (AC-6)', async () => {
      AppState.currentState = 'background';
      // Pre-seed an active job so current mode is Job
      queryClient.setQueryData([QueryKeys.inProgressOrders], [activeJob]);

      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      expect(notifee.displayNotification).not.toHaveBeenCalled();

      // App comes to the front (active)
      triggerAppState('active');

      await waitFor(() => {
        expect(notifee.displayNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'online-status',
            title: 'OpenCourier: delivery in progress',
          }),
        );
      });
    });

    it('when displayNotification rejects once, nothing throws and the next active tries again (AC-6)', async () => {
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      (notifee.displayNotification as jest.Mock)
        .mockRejectedValueOnce(new Error('Android refused start'))
        .mockResolvedValue('online-status');

      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Could not start the online service',
          expect.any(Error),
        );
      });

      // Leaving and returning to active triggers retry
      triggerAppState('background');
      triggerAppState('active');

      await waitFor(() => {
        expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
      });

      consoleLogSpy.mockRestore();
    });
  });

  describe('Sos mode tracking and throttled ordinary location (spec 0022, AC-5, AC-13, decision 73.9)', () => {
    it('in Sos mode runs exactly one watch at SOS options, clearing watch on mode change', async () => {
      const { result, rerender } = renderHook(
        ({ sosSharing }) => useLocationTracking(onlineUser, true, sosSharing),
        {
          wrapper: createWrapper(),
          initialProps: { sosSharing: true },
        },
      );

      expect(result.current).toBe(TrackingMode.Sos);
      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
      expect(Geolocation.watchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          ...WATCH_OPTIONS[TrackingMode.Sos],
          showsBackgroundLocationIndicator: true,
        },
      );

      // Transition out of Sos mode
      rerender({ sosSharing: false });
      expect(result.current).toBe(TrackingMode.Waiting);
      // Cleared the old watch before starting the new one
      expect(Geolocation.clearWatch).toHaveBeenCalledTimes(1);
      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2);
    });

    it('each fix adds an SOS point with accuracy and phone time, but throttles setUserLocation according to ordinary mode', async () => {
      const addSosPointSpy = jest
        .spyOn(sosStore, 'addSosPoint')
        .mockResolvedValue(undefined);

      // Rider is ONLINE with 0 jobs -> ordinary mode is Waiting (cadence: 30 s and 100 m)
      renderHook(() => useLocationTracking(onlineUser, true, true), {
        wrapper: createWrapper(),
      });

      expect(watchCallback).toBeDefined();

      const baseLat = 39.3622;
      const baseLon = 22.9425;

      // Fix 1: at t = 10000 -> First fix, must be forwarded as ordinary location
      jest.spyOn(Date, 'now').mockReturnValue(10000);
      act(() => {
        watchCallback!({
          coords: {
            latitude: baseLat,
            longitude: baseLon,
            accuracy: 5.5,
          },
          timestamp: 10000,
        });
      });

      expect(addSosPointSpy).toHaveBeenCalledTimes(1);
      expect(addSosPointSpy).toHaveBeenLastCalledWith('rider-1', {
        latitude: baseLat,
        longitude: baseLon,
        accuracyMetres: 5.5,
        takenAt: 10000,
      });
      expect(mockSetUserLocation).toHaveBeenCalledTimes(1);
      expect(mockSetUserLocation).toHaveBeenLastCalledWith({
        latitude: baseLat,
        longitude: baseLon,
      });

      // Fix 2: 5 s later (t = 15000), moved only 10 m (~0.00009 lat)
      // addSosPoint MUST be called, but setUserLocation MUST NOT be called (throttled)
      jest.spyOn(Date, 'now').mockReturnValue(15000);
      act(() => {
        watchCallback!({
          coords: {
            latitude: baseLat + 0.00009,
            longitude: baseLon,
            accuracy: 6.0,
          },
          timestamp: 15000,
        });
      });

      expect(addSosPointSpy).toHaveBeenCalledTimes(2);
      expect(addSosPointSpy).toHaveBeenLastCalledWith('rider-1', {
        latitude: baseLat + 0.00009,
        longitude: baseLon,
        accuracyMetres: 6.0,
        takenAt: 15000,
      });
      // setUserLocation still only called 1 time!
      expect(mockSetUserLocation).toHaveBeenCalledTimes(1);

      // Fix 3: 10 s later (t = 20000), moved another 10 m
      jest.spyOn(Date, 'now').mockReturnValue(20000);
      act(() => {
        watchCallback!({
          coords: {
            latitude: baseLat + 0.00018,
            longitude: baseLon,
            accuracy: 5.0,
          },
          timestamp: 20000,
        });
      });

      expect(addSosPointSpy).toHaveBeenCalledTimes(3);
      // Still throttled!
      expect(mockSetUserLocation).toHaveBeenCalledTimes(1);

      // Fix 4: 35 s after first fix (t = 45000) and moved 150 m (~0.00135 lat)
      // Both >= 30 s and >= 100 m satisfied -> forwarded!
      jest.spyOn(Date, 'now').mockReturnValue(45000);
      act(() => {
        watchCallback!({
          coords: {
            latitude: baseLat + 0.00135,
            longitude: baseLon,
            accuracy: 4.5,
          },
          timestamp: 45000,
        });
      });

      expect(addSosPointSpy).toHaveBeenCalledTimes(4);
      expect(mockSetUserLocation).toHaveBeenCalledTimes(2);
      expect(mockSetUserLocation).toHaveBeenLastCalledWith({
        latitude: baseLat + 0.00135,
        longitude: baseLon,
      });

      addSosPointSpy.mockRestore();
      (Date.now as unknown as jest.SpyInstance).mockRestore();
    });
  });
});
