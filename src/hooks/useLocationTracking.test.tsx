import React from 'react';
import {
  render,
  renderHook,
  act,
  cleanup,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Geolocation from 'react-native-geolocation-service';
import { Polyline } from 'react-native-maps';
import { Order, User, UserStatus } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { TrackingMode, WATCH_OPTIONS } from '@app/utilities/locationTracking';
import { QueryKeys } from '@app/utilities/queryKeys';
import useUser from '@app/hooks/useUser';
import Map from '@app/components/Map/Map';
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

  beforeEach(() => {
    jest.clearAllMocks();
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

    it('writes the position into the React Query cache for [QueryKeys.user] without invalidating or refetching, and consumer Map reads the updated position', async () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const refetchSpy = jest.spyOn(queryClient, 'refetchQueries');

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

      // Consumer Map reads user location through useUser under the same QueryClient
      const MapConsumer = ({ order }: { order: Order }) => {
        const { user } = useUser();
        if (!user) {
          return null;
        }
        return <Map order={order} user={user} />;
      };

      const testOrder: Order = {
        id: 'order-1',
        pickupLocation: { latitude: 39.36, longitude: 22.94 },
        dropoffLocation: { latitude: 39.37, longitude: 22.95 },
      } as Order;

      const { UNSAFE_getByType } = render(
        <QueryClientProvider client={queryClient}>
          <MapConsumer order={testOrder} />
        </QueryClientProvider>,
      );

      // Verify initial position in Map consumer
      const polylineBefore = UNSAFE_getByType(Polyline);
      expect(polylineBefore.props.coordinates[0]).toEqual({
        latitude: 39.0,
        longitude: 22.0,
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

      // Position written directly into React Query cache for [QueryKeys.user]
      const cachedUser = queryClient.getQueryData<User>([QueryKeys.user]);
      expect(cachedUser?.currentLocation).toEqual({
        latitude: 39.362,
        longitude: 22.945,
      });

      // Does not trigger any queries invalidation or refetches
      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(refetchSpy).not.toHaveBeenCalled();

      // Consumer Map receives new coordinates reactive to query cache update
      await waitFor(() => {
        const polylineAfter = UNSAFE_getByType(Polyline);
        expect(polylineAfter.props.coordinates[0]).toEqual({
          latitude: 39.362,
          longitude: 22.945,
        });
      });
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
});
