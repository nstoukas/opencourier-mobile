import React from 'react';
import {
  renderHook,
  act,
  cleanup,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Geolocation from 'react-native-geolocation-service';
import { User, UserStatus } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { TrackingMode, WATCH_OPTIONS } from '@app/utilities/locationTracking';
import { QueryKeys } from '@app/utilities/queryKeys';
import { useLocationTracking } from './useLocationTracking';

const mockSetUserLocation = jest.fn().mockResolvedValue({});
const mockGetInProgressOrders = jest.fn();

jest.mock('@app/services/service', () => ({
  services: {
    userService: {
      setUserLocation: (...args: any[]) => mockSetUserLocation(...args),
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

  beforeEach(() => {
    jest.clearAllMocks();
    watchIdCounter = 100;
    watchCallback = undefined;

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
      },
    });

    (Geolocation.watchPosition as jest.Mock).mockImplementation(
      (success: (pos: any) => void) => {
        watchCallback = success;
        watchIdCounter += 1;
        return watchIdCounter;
      },
    );

    mockGetInProgressOrders.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
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
          enableHighAccuracy: true,
          ...WATCH_OPTIONS[TrackingMode.Waiting],
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
          enableHighAccuracy: true,
          ...WATCH_OPTIONS[TrackingMode.Job],
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
  });
});
