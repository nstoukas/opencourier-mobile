import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeliveryRoute } from './useDeliveryRoute';
import { services } from '@app/services/service';
import { OrderStatus } from '@app/types/enums';
import { RouteLeg, RouteLegKind } from '@app/types/route';
import { QueryKeys } from '@app/utilities/queryKeys';

describe('useDeliveryRoute (spec 0018, AC-6)', () => {
  let queryClient: QueryClient;
  let appStateListeners: Array<(state: AppStateStatus) => void> = [];
  const mockGetDeliveryRoute = jest.fn();

  const legs1: RouteLeg[] = [
    {
      kind: RouteLegKind.RiderToPickup,
      distanceMetres: 1000,
      durationSeconds: 180,
      points: [{ latitude: 39.36, longitude: 22.94 }],
    },
  ];

  const legs2: RouteLeg[] = [
    {
      kind: RouteLegKind.PickupToDropoff,
      distanceMetres: 2000,
      durationSeconds: 360,
      points: [{ latitude: 39.37, longitude: 22.95 }],
    },
  ];

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
    mockGetDeliveryRoute.mockResolvedValue([]);
    services.routeService.getDeliveryRoute = mockGetDeliveryRoute;
  });

  afterEach(() => {
    queryClient.clear();
    jest.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('holds the delivery id and server status in the query key and fetches data', async () => {
    mockGetDeliveryRoute.mockResolvedValueOnce(legs1);

    const { result } = renderHook(
      () =>
        useDeliveryRoute({
          deliveryId: 'deliv-1',
          serverStatus: OrderStatus.accepted,
          isJob: true,
          waitingToSend: false,
          inFront: true,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(legs1);
    expect(mockGetDeliveryRoute).toHaveBeenCalledWith('deliv-1');

    const cacheState = queryClient.getQueryState([
      QueryKeys.deliveryRoute,
      'deliv-1',
      OrderStatus.accepted,
    ]);
    expect(cacheState).toBeDefined();
    expect(cacheState?.data).toEqual(legs1);
  });

  it('is disabled when deliveryId is undefined, while waitingToSend is true, and for dropped_off', () => {
    // 1. deliveryId is undefined
    const { result: noId } = renderHook(
      () =>
        useDeliveryRoute({
          deliveryId: undefined,
          serverStatus: OrderStatus.accepted,
          isJob: true,
          waitingToSend: false,
          inFront: true,
        }),
      { wrapper },
    );
    expect(noId.current.fetchStatus).toBe('idle');
    expect(mockGetDeliveryRoute).not.toHaveBeenCalled();

    // 2. waitingToSend is true
    const { result: waiting } = renderHook(
      () =>
        useDeliveryRoute({
          deliveryId: 'deliv-1',
          serverStatus: OrderStatus.accepted,
          isJob: true,
          waitingToSend: true,
          inFront: true,
        }),
      { wrapper },
    );
    expect(waiting.current.fetchStatus).toBe('idle');
    expect(mockGetDeliveryRoute).not.toHaveBeenCalled();

    // 3. serverStatus is dropped_off
    const { result: droppedOff } = renderHook(
      () =>
        useDeliveryRoute({
          deliveryId: 'deliv-1',
          serverStatus: OrderStatus.dropped_off,
          isJob: true,
          waitingToSend: false,
          inFront: true,
        }),
      { wrapper },
    );
    expect(droppedOff.current.fetchStatus).toBe('idle');
    expect(mockGetDeliveryRoute).not.toHaveBeenCalled();

    // 4. serverStatus is undefined
    const { result: undefinedStatus } = renderHook(
      () =>
        useDeliveryRoute({
          deliveryId: 'deliv-1',
          serverStatus: undefined,
          isJob: true,
          waitingToSend: false,
          inFront: true,
        }),
      { wrapper },
    );
    expect(undefinedStatus.current.fetchStatus).toBe('idle');
    expect(mockGetDeliveryRoute).not.toHaveBeenCalled();
  });

  it('sets refetchInterval to 60000 only for a job in front with app active, false for an offer or in background', () => {
    // Offer (isJob: false)
    const { result: offerResult } = renderHook(
      () =>
        useDeliveryRoute({
          deliveryId: 'offer-1',
          serverStatus: 'ASSIGNING_COURIER',
          isJob: false,
          waitingToSend: false,
          inFront: true,
        }),
      { wrapper },
    );
    // Not in front (inFront: false)
    const { result: notInFrontResult } = renderHook(
      () =>
        useDeliveryRoute({
          deliveryId: 'deliv-1',
          serverStatus: OrderStatus.accepted,
          isJob: true,
          waitingToSend: false,
          inFront: false,
        }),
      { wrapper },
    );

    // Job in front and app active
    const { result: activeJobResult } = renderHook(
      () =>
        useDeliveryRoute({
          deliveryId: 'deliv-1',
          serverStatus: OrderStatus.accepted,
          isJob: true,
          waitingToSend: false,
          inFront: true,
        }),
      { wrapper },
    );

    // Active job has 60000 refetchInterval (EVERY_MINUTE)
    // We check via queryClient's active query options
    const offerQuery = queryClient.getQueryCache().find({
      queryKey: [QueryKeys.deliveryRoute, 'offer-1', 'ASSIGNING_COURIER'],
    });
    expect((offerQuery?.options as any).refetchInterval).toBe(false);

    const notInFrontQuery = queryClient.getQueryCache().find({
      queryKey: [QueryKeys.deliveryRoute, 'deliv-1', OrderStatus.accepted],
    });
    // With active job also having this query key, let's verify AppState backgrounding
    act(() => {
      appStateListeners.forEach(l => l('background'));
    });

    const backgroundJobQuery = queryClient.getQueryCache().find({
      queryKey: [QueryKeys.deliveryRoute, 'deliv-1', OrderStatus.accepted],
    });
    expect((backgroundJobQuery?.options as any).refetchInterval).toBe(false);
  });

  it('keeps last data for the same delivery while loading next status, but never for another delivery', async () => {
    mockGetDeliveryRoute.mockResolvedValueOnce(legs1);

    type Props = { deliveryId: string; status: string };
    const { result, rerender } = renderHook(
      ({ deliveryId, status }: Props) =>
        useDeliveryRoute({
          deliveryId,
          serverStatus: status,
          isJob: true,
          waitingToSend: false,
          inFront: true,
        }),
      {
        wrapper,
        initialProps: { deliveryId: 'deliv-1', status: OrderStatus.accepted },
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(legs1);

    // Now status moves to picked_up for the SAME delivery id, but mock hangs / promises legs2
    let resolvePickedUp!: (val: any) => void;
    mockGetDeliveryRoute.mockImplementationOnce(
      () => new Promise(resolve => (resolvePickedUp = resolve)),
    );

    await act(async () => {
      rerender({ deliveryId: 'deliv-1', status: OrderStatus.picked_up });
    });

    // placeholderData keeps legs1 for the same delivery while fetching
    expect(result.current.data).toEqual(legs1);

    // Resolve legs2
    await act(async () => {
      resolvePickedUp(legs2);
    });
    await waitFor(() => expect(result.current.data).toEqual(legs2));

    // Now change delivery to 'deliv-2'. Legs from deliv-1 must NOT be shown!
    let resolveDeliv2!: (val: any) => void;
    mockGetDeliveryRoute.mockImplementationOnce(
      () => new Promise(resolve => (resolveDeliv2 = resolve)),
    );

    await act(async () => {
      rerender({ deliveryId: 'deliv-2', status: OrderStatus.accepted });
    });

    // Another delivery never shows the previous delivery's legs
    expect(result.current.data).toBeUndefined();

    await act(async () => {
      resolveDeliv2(legs1);
    });
    await waitFor(() => expect(result.current.data).toEqual(legs1));
  });
});
