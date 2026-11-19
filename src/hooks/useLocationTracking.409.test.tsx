import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Geolocation from 'react-native-geolocation-service';
import { User, UserStatus } from '@app/types/types';
import { TrackingMode } from '@app/utilities/locationTracking';
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
  let watchCallback: ((pos: any) => void) | undefined;
  let watchIdCounter = 500;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
      },
    });
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
    watchCallback = undefined;
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

  it('outside SOS: when location route answers 409, clears watch and stops sending fixes', async () => {
    // Server refuses position with 409
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

    // Second fix arrives: must NOT be sent
    fireFix(39.365, 22.945);
    expect(mockSetUserLocation).toHaveBeenCalledTimes(1);
  });

  it('inside SOS: when location route answers 409, keeps watch alive for SOS points but stops ordinary setUserLocation', async () => {
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

    // Advance time slightly and fire second fix
    fireFix(39.37, 22.95);

    // SOS point is still collected!
    expect(sosStore.addSosPoint).toHaveBeenCalledTimes(2);
    // But ordinary setUserLocation was NOT called again (refusedByServer is true)
    expect(mockSetUserLocation).toHaveBeenCalledTimes(1);
  });
});
