import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Geolocation from 'react-native-geolocation-service';
import { User, UserStatus } from '@app/types/types';
import { TrackingMode } from '@app/utilities/locationTracking';
import { QueryKeys } from '@app/utilities/queryKeys';
import * as sosStore from '@app/services/sosStore';
import { useLocationTracking } from './useLocationTracking';

const mockSetUserLocation = jest.fn();
const mockGetInProgressOrders = jest.fn();

jest.mock('@app/services/service', () => ({
  services: {
    userService: {
      setUserLocation: (...args: any[]) => mockSetUserLocation(...args),
      getUser: jest.fn().mockResolvedValue(null),
    },
    orderService: {
      getInProgressOrders: () => mockGetInProgressOrders(),
    },
  },
}));

jest.mock('@app/services/sosStore', () => ({
  addSosPoint: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@app/services/onlineService', () => ({
  showOnlineService: jest.fn().mockResolvedValue(true),
  stopOnlineService: jest.fn().mockResolvedValue(undefined),
}));

describe('useLocationTracking 409 refusal handling (spec 0038, AC-14)', () => {
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;
  let watchCallback: ((pos: any) => void) | undefined;
  let watchIdCounter = 500;
  let currentTime = 1_000_000;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
      },
    });
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  const onlineUser: User = {
    id: 'rider-409',
    status: UserStatus.Online,
  } as User;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetUserLocation.mockResolvedValue(undefined);
    watchCallback = undefined;
    currentTime = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
    mockGetInProgressOrders.mockResolvedValue([]);

    (Geolocation.watchPosition as jest.Mock).mockImplementation(
      (success: (pos: any) => void) => {
        watchCallback = success;
        watchIdCounter += 1;
        return watchIdCounter;
      },
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    queryClient?.clear();
  });

  const fireFix = (latitude = 39.362, longitude = 22.942) => {
    act(() => {
      watchCallback?.({
        coords: { latitude, longitude, accuracy: 10 },
        timestamp: Date.now(),
      });
    });
  };

  it('outside SOS: when location route answers 409, clears watch, invalidates user query, and stops sending fixes', async () => {
    mockSetUserLocation.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { message: 'You are Offline, so no position is stored' },
      },
    });

    const { result } = renderHook(
      () => useLocationTracking(onlineUser, true, false),
      { wrapper: createWrapper() },
    );

    expect(result.current).toBe(TrackingMode.Waiting);
    expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
    const activeWatchId = (Geolocation.watchPosition as jest.Mock).mock
      .results[0].value;

    // First fix arrives and gets 409
    fireFix(39.362, 22.942);
    expect(mockSetUserLocation).toHaveBeenCalledTimes(1);

    // Wait for promise rejection to settle inside catch
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Outside SOS: watch is cleared
    expect(Geolocation.clearWatch).toHaveBeenCalledWith(activeWatchId);
    // User query is invalidated so phone stops showing Online
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.user],
    });

    // Second fix arrives: must NOT be sent
    fireFix(39.365, 22.945);
    expect(mockSetUserLocation).toHaveBeenCalledTimes(1);
  });

  it('inside SOS: when location route answers 409, keeps watch alive for SOS points, invalidates user query, but stops ordinary setUserLocation even past throttle', async () => {
    mockSetUserLocation.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { message: 'You are Offline, so no position is stored' },
      },
    });

    const { result } = renderHook(
      () => useLocationTracking(onlineUser, true, true), // sosSharing = true
      { wrapper: createWrapper() },
    );

    expect(result.current).toBe(TrackingMode.Sos);
    expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);

    // First fix fires
    fireFix(39.362, 22.942);
    expect(mockSetUserLocation).toHaveBeenCalledTimes(1);
    expect(sosStore.addSosPoint).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // In SOS mode: clearWatch is NOT called so watch stays alive
    expect(Geolocation.clearWatch).not.toHaveBeenCalled();
    // User query is invalidated
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.user],
    });

    // Advance clock past the 30s Waiting throttle (fastestInterval: 30000)
    // and move position by > 100m (distanceFilter: 100)
    currentTime += 35_000;
    fireFix(39.37, 22.95);

    // SOS point is still collected!
    expect(sosStore.addSosPoint).toHaveBeenCalledTimes(2);
    // But ordinary setUserLocation was NOT called again (refusedByServer guard prevented it)
    expect(mockSetUserLocation).toHaveBeenCalledTimes(1);
  });

  it('non-409 failure: keeps the watch sending on subsequent fixes and does not invalidate user query', async () => {
    // Non-409 failure (e.g. 500 server error or network issue)
    mockSetUserLocation.mockRejectedValueOnce({
      response: {
        status: 500,
        data: { message: 'Internal server error' },
      },
    });

    const { result } = renderHook(
      () => useLocationTracking(onlineUser, true, false),
      { wrapper: createWrapper() },
    );

    expect(result.current).toBe(TrackingMode.Waiting);
    expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);

    // First fix fires and fails with 500
    fireFix(39.362, 22.942);
    expect(mockSetUserLocation).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Watch is NOT cleared
    expect(Geolocation.clearWatch).not.toHaveBeenCalled();
    // User query is NOT invalidated
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: [QueryKeys.user],
    });

    // Second fix arrives: since watch is still active and error was not 409, it sends again
    fireFix(39.365, 22.945);
    expect(mockSetUserLocation).toHaveBeenCalledTimes(2);
  });
});
