import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStackRoute } from './useStackRoute';
import { services } from '@app/services/service';
import { RouteLegKind, StackRoute } from '@app/types/route';
import { QueryKeys } from '@app/utilities/queryKeys';

describe('useStackRoute (spec 0048, AC-10)', () => {
  let queryClient: QueryClient;
  let appStateListeners: Array<(state: AppStateStatus) => void> = [];
  const mockGetStackRoute = jest.fn();

  const sampleStackRoute: StackRoute = {
    legs: [
      {
        kind: RouteLegKind.BetweenStops,
        distanceMetres: 1200,
        durationSeconds: 240,
        points: [{ latitude: 39.36, longitude: 22.94 }],
        toStopNumber: 2,
      },
    ],
    stops: [
      {
        number: 1,
        deliveryId: 'deliv-1',
        stop: 'PICKUP',
        latitude: 39.36,
        longitude: 22.94,
        done: true,
      },
      {
        number: 2,
        deliveryId: 'deliv-2',
        stop: 'PICKUP',
        latitude: 39.37,
        longitude: 22.95,
        done: false,
      },
    ],
  };

  beforeEach(() => {
    appStateListeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => {
      appStateListeners.push(listener as any);
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

    jest.clearAllMocks();
    mockGetStackRoute.mockResolvedValue(sampleStackRoute);
    services.routeService.getStackRoute = mockGetStackRoute;
  });

  afterEach(() => {
    queryClient.clear();
    jest.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('holds deliveryId and serverStatuses in the query key and fetches data', async () => {
    const { result } = renderHook(
      () =>
        useStackRoute({
          deliveryId: 'deliv-1',
          serverStatuses: 'DISPATCHED+DISPATCHED',
          isJob: true,
          waitingToSend: false,
          inFront: true,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleStackRoute);
    expect(mockGetStackRoute).toHaveBeenCalledWith('deliv-1');

    const cacheState = queryClient.getQueryState([
      QueryKeys.stackRoute,
      'deliv-1',
      'DISPATCHED+DISPATCHED',
    ]);
    expect(cacheState).toBeDefined();
    expect(cacheState?.data).toEqual(sampleStackRoute);
  });

  it('is disabled when deliveryId is undefined, serverStatuses is undefined, or waitingToSend is true', () => {
    // 1. deliveryId is undefined
    const { result: noId } = renderHook(
      () =>
        useStackRoute({
          deliveryId: undefined,
          serverStatuses: 'DISPATCHED+DISPATCHED',
          isJob: true,
          waitingToSend: false,
          inFront: true,
        }),
      { wrapper },
    );
    expect(noId.current.fetchStatus).toBe('idle');
    expect(mockGetStackRoute).not.toHaveBeenCalled();

    // 2. serverStatuses is undefined
    const { result: noStatus } = renderHook(
      () =>
        useStackRoute({
          deliveryId: 'deliv-1',
          serverStatuses: undefined,
          isJob: true,
          waitingToSend: false,
          inFront: true,
        }),
      { wrapper },
    );
    expect(noStatus.current.fetchStatus).toBe('idle');
    expect(mockGetStackRoute).not.toHaveBeenCalled();

    // 3. waitingToSend is true
    const { result: waiting } = renderHook(
      () =>
        useStackRoute({
          deliveryId: 'deliv-1',
          serverStatuses: 'DISPATCHED+DISPATCHED',
          isJob: true,
          waitingToSend: true,
          inFront: true,
        }),
      { wrapper },
    );
    expect(waiting.current.fetchStatus).toBe('idle');
    expect(mockGetStackRoute).not.toHaveBeenCalled();
  });
});
