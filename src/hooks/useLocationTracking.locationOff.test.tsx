import React from 'react';
import { renderHook, act, cleanup } from '@testing-library/react-native';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Geolocation from 'react-native-geolocation-service';
import notifee from '@notifee/react-native';
import '@app/localization/i18n';
import { User, UserStatus } from '@app/types/types';
import { TrackingMode } from '@app/utilities/locationTracking';
import {
  LOCATION_OFF_RETRY_MS,
  getLocationOff,
  setLocationOff,
} from '@app/services/locationOff';
import { stopOnlineService } from '@app/services/onlineService';
import { useLocationTracking } from './useLocationTracking';

const mockSetUserLocation = jest.fn().mockResolvedValue({});
const mockGetInProgressOrders = jest.fn().mockResolvedValue([]);
const mockGetUser = jest.fn().mockResolvedValue(null);

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

describe('useLocationTracking locationOff warning & retry (Row 156, Clauses 1, 2, 3, 4, Review fixes)', () => {
  let queryClient: QueryClient;
  let watchIdCounter = 100;
  let watchSuccessCb: ((pos: any) => void) | undefined;
  let watchErrorCb: ((err: any) => void) | undefined;
  let consoleErrorSpy: jest.SpyInstance;
  const originalOS = Platform.OS;
  let appStateListeners: Array<(state: AppStateStatus) => void> = [];

  const triggerAppState = (state: AppStateStatus) => {
    AppState.currentState = state;
    act(() => {
      appStateListeners.forEach(listener => listener(state));
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
    Platform.OS = 'android';
    AppState.currentState = 'active';
    appStateListeners = [];
    setLocationOff(false);

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
    watchSuccessCb = undefined;
    watchErrorCb = undefined;

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      },
    });

    (Geolocation.watchPosition as jest.Mock).mockImplementation(
      (success: (pos: any) => void, error: (err: any) => void) => {
        watchSuccessCb = success;
        watchErrorCb = error;
        watchIdCounter += 1;
        return watchIdCounter;
      },
    );

    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
      (_success: (pos: any) => void, _error: (err: any) => void) => {},
    );

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
    cleanup();
    consoleErrorSpy.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
    await stopOnlineService().catch(() => {});
    queryClient.clear();
    Platform.OS = originalOS;
    setLocationOff(false);
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

  describe('Error codes and locationOff flag (Clause 1, Clause 4)', () => {
    it('sets locationOff to true when watch reports error code 2 (POSITION_UNAVAILABLE)', () => {
      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      expect(getLocationOff()).toBe(false);
      expect(watchErrorCb).toBeDefined();

      act(() => {
        watchErrorCb!({ code: 2, message: 'Location provider disabled' });
      });

      expect(getLocationOff()).toBe(true);
    });

    it('sets locationOff to true when watch reports error code 5 (SETTINGS_NOT_SATISFIED)', () => {
      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      expect(getLocationOff()).toBe(false);
      expect(watchErrorCb).toBeDefined();

      act(() => {
        watchErrorCb!({ code: 5, message: 'Settings not satisfied' });
      });

      expect(getLocationOff()).toBe(true);
    });

    it('does NOT set locationOff when watch reports error code 3 (TIMEOUT / weak signal) (Clause 4)', () => {
      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      expect(getLocationOff()).toBe(false);
      expect(watchErrorCb).toBeDefined();

      act(() => {
        watchErrorCb!({ code: 3, message: 'Location request timed out' });
      });

      expect(getLocationOff()).toBe(false);
    });

    it('does NOT set locationOff for other error codes (e.g. code 1 PERMISSION_DENIED)', () => {
      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      expect(getLocationOff()).toBe(false);
      expect(watchErrorCb).toBeDefined();

      act(() => {
        watchErrorCb!({ code: 1, message: 'Permission denied' });
      });

      expect(getLocationOff()).toBe(false);
    });
  });

  describe('Fix clears flag and mode Off resets flag (Clause 2, Clause 3)', () => {
    it('clears locationOff (sets false) when a location fix arrives (Clause 2)', () => {
      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      // Simulate location off error first
      act(() => {
        watchErrorCb!({ code: 2, message: 'Location provider disabled' });
      });
      expect(getLocationOff()).toBe(true);

      // Now a fix arrives
      act(() => {
        watchSuccessCb!({
          coords: {
            latitude: 39.362,
            longitude: 22.945,
            accuracy: 10,
          },
        });
      });

      expect(getLocationOff()).toBe(false);
    });

    it('resets locationOff to false when tracking mode becomes Off (Clause 3)', () => {
      setLocationOff(true);

      // Render while rider is Offline
      const { result } = renderHook(
        () => useLocationTracking(offlineUser, true),
        { wrapper: createWrapper() },
      );

      expect(result.current).toBe(TrackingMode.Off);
      expect(getLocationOff()).toBe(false);
    });

    it('resets locationOff to false when rider transitions from Online to Offline (Clause 3)', () => {
      const { rerender } = renderHook(
        ({ user, hasPermission }) => useLocationTracking(user, hasPermission),
        {
          initialProps: { user: onlineUser, hasPermission: true },
          wrapper: createWrapper(),
        },
      );

      // Trigger location off
      act(() => {
        watchErrorCb!({ code: 2, message: 'Location disabled' });
      });
      expect(getLocationOff()).toBe(true);

      // Rider goes Offline
      rerender({ user: offlineUser, hasPermission: true });

      expect(getLocationOff()).toBe(false);
    });
  });

  describe('Watch restarts on app return and 30s retry (Review fixes)', () => {
    it('restarts watch when app returns to active (AppState active) while locationOff is true', () => {
      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);

      // Trigger location off
      act(() => {
        watchErrorCb!({ code: 2, message: 'Location disabled' });
      });
      expect(getLocationOff()).toBe(true);

      // Rider leaves app to change settings and returns
      triggerAppState('background');
      triggerAppState('active');

      // Watch was cleared and restarted (new watchPosition called)
      expect(Geolocation.clearWatch).toHaveBeenCalledTimes(1);
      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2);
    });

    it('does NOT restart watch on AppState active when locationOff is false', () => {
      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
      expect(getLocationOff()).toBe(false);

      triggerAppState('background');
      triggerAppState('active');

      // Watch was not restarted because location is not off
      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
    });

    it('while locationOff is true and app is active, restarts watch every LOCATION_OFF_RETRY_MS (30 s)', () => {
      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);

      // Trigger location off
      act(() => {
        watchErrorCb!({ code: 2, message: 'Location disabled' });
      });
      expect(getLocationOff()).toBe(true);

      // Advance 30 seconds
      act(() => {
        jest.advanceTimersByTime(LOCATION_OFF_RETRY_MS);
      });

      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2);

      // Advance another 30 seconds
      act(() => {
        jest.advanceTimersByTime(LOCATION_OFF_RETRY_MS);
      });

      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(3);
    });

    it('stops the 30 s retry interval once a fix arrives and clears locationOff', () => {
      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      act(() => {
        watchErrorCb!({ code: 2, message: 'Location disabled' });
      });
      expect(getLocationOff()).toBe(true);

      // Advance 30 seconds -> retry fires
      act(() => {
        jest.advanceTimersByTime(LOCATION_OFF_RETRY_MS);
      });
      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2);

      // Fix arrives on new watch
      act(() => {
        watchSuccessCb!({
          coords: {
            latitude: 39.362,
            longitude: 22.945,
            accuracy: 10,
          },
        });
      });
      expect(getLocationOff()).toBe(false);

      // Advance another 30 seconds -> retry should NOT fire again
      act(() => {
        jest.advanceTimersByTime(LOCATION_OFF_RETRY_MS);
      });

      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2);
    });

    it('does not retry every 30 s while app is in background', () => {
      renderHook(() => useLocationTracking(onlineUser, true), {
        wrapper: createWrapper(),
      });

      act(() => {
        watchErrorCb!({ code: 2, message: 'Location disabled' });
      });
      expect(getLocationOff()).toBe(true);

      // App is in background
      triggerAppState('background');

      const callsBefore = (Geolocation.watchPosition as jest.Mock).mock.calls
        .length;

      act(() => {
        jest.advanceTimersByTime(LOCATION_OFF_RETRY_MS);
      });

      // No new watchPosition call while backgrounded
      expect((Geolocation.watchPosition as jest.Mock).mock.calls.length).toBe(
        callsBefore,
      );
    });
  });
});
