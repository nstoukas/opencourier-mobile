import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { OutboxItem } from '@app/services/jobStepOutbox';
import { services } from '@app/services/service';
import { setLatestFix } from '@app/services/latestFix';
import {
  findHeldArrival,
  holdArrival,
  resetHeldArrivalsForTests,
} from '@app/services/heldArrivals';
import { endHandBack, startHandBack } from '@app/services/handBackInFlight';
import * as jobContactModule from './useJobContact';
import * as jobStepOutboxHook from './useJobStepOutbox';
import { useArrivalDetection } from './useArrivalDetection';

const mockDetectedArrival = jest.fn();

jest.mock('./useOrder', () => () => ({
  detectedArrival: (...args: any[]) => mockDetectedArrival(...args),
}));

describe('useArrivalDetection (spec 0021, AC-1, AC-2, AC-12, AC-13)', () => {
  let queryClient: QueryClient;
  let mockOutboxItems: OutboxItem[] = [];
  let getInProgressSpy: jest.SpyInstance;
  let fetchContactSpy: jest.SpyInstance;

  // Restaurant at 39.362, 22.945; Dropoff at 39.370, 22.950
  const sampleJob: Order = {
    id: 'job-1',
    status: OrderStatus.dispatched,
    pickupLocation: { latitude: 39.362, longitude: 22.945 },
    dropoffLocation: { latitude: 39.37, longitude: 22.95 },
    pickupBusinessName: 'Acropolis Grill',
  } as unknown as Order;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    setLatestFix(null);
    resetHeldArrivalsForTests();
    await AsyncStorage.clear();
    endHandBack('job-1');
    endHandBack('job-2');

    mockOutboxItems = [];
    jest
      .spyOn(jobStepOutboxHook, 'useOutboxItems')
      .mockImplementation(() => mockOutboxItems);

    mockDetectedArrival.mockResolvedValue(true);

    getInProgressSpy = jest
      .spyOn(services.orderService, 'getInProgressOrders')
      .mockResolvedValue([sampleJob]);

    fetchContactSpy = jest
      .spyOn(jobContactModule, 'fetchJobContact')
      .mockResolvedValue({
        dispatchPhoneNumber: '+302421012345',
        arrivalRadiusMetres: 50,
      });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  afterEach(async () => {
    queryClient.cancelQueries();
    queryClient.clear();
    jest.clearAllTimers();
    jest.useRealTimers();
    setLatestFix(null);
    resetHeldArrivalsForTests();
    await AsyncStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('does nothing when courierId is undefined', async () => {
    renderHook(() => useArrivalDetection(undefined), { wrapper });

    await act(async () => {
      jest.runAllTicks();
    });

    expect(getInProgressSpy).not.toHaveBeenCalled();
    expect(mockDetectedArrival).not.toHaveBeenCalled();
  });

  it('detects nothing when radius is 0 or undefined (AC-2)', async () => {
    fetchContactSpy.mockResolvedValueOnce({
      dispatchPhoneNumber: '+302421012345',
      arrivalRadiusMetres: 0,
    });

    renderHook(() => useArrivalDetection('courier-1'), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      setLatestFix({
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 10,
        at: Date.now(),
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDetectedArrival).not.toHaveBeenCalled();
  });

  it('happy path: fix within R metres at DISPATCHED queues detectedArrival (AC-1)', async () => {
    renderHook(() => useArrivalDetection('courier-1'), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const fixTime = Date.now();
    act(() => {
      setLatestFix({
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 15,
        at: fixTime,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDetectedArrival).toHaveBeenCalledTimes(1);
    expect(mockDetectedArrival).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1' }),
      'pickup',
      fixTime,
    );
  });

  it('happy path: fix at ACCEPTED queues detectedArrival at pickup (AC-1)', async () => {
    getInProgressSpy.mockResolvedValueOnce([
      { ...sampleJob, status: OrderStatus.accepted },
    ]);

    renderHook(() => useArrivalDetection('courier-1'), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const fixTime = Date.now();
    act(() => {
      setLatestFix({
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 10,
        at: fixTime,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDetectedArrival).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1' }),
      'pickup',
      fixTime,
    );
  });

  it('inaccurate fix (> max(R, 30)) does not trigger arrival (AC-1)', async () => {
    // Radius is 50. max(50, 30) = 50. Accuracy 80 > 50.
    renderHook(() => useArrivalDetection('courier-1'), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      setLatestFix({
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 80,
        at: Date.now(),
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDetectedArrival).not.toHaveBeenCalled();
  });

  it('stale fix (> 60 s old) does not trigger arrival (AC-1)', async () => {
    renderHook(() => useArrivalDetection('courier-1'), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const now = Date.now();
    act(() => {
      setLatestFix({
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 10,
        at: now - 65_000,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDetectedArrival).not.toHaveBeenCalled();
  });

  it('does not trigger arrival if fix was taken before heading to this stop (stageSince check)', async () => {
    // Set time to T
    jest.setSystemTime(100_000);

    renderHook(() => useArrivalDetection('courier-1'), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    // Fix was taken at 90_000, which is before stage was first seen (100_000)
    act(() => {
      setLatestFix({
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 10,
        at: 90_000,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDetectedArrival).not.toHaveBeenCalled();
  });

  it('does not trigger arrival when job has a refused outbox item (AC-1)', async () => {
    mockOutboxItems = [
      {
        id: 'outbox-1',
        courierId: 'courier-1',
        deliveryId: 'job-1',
        step: 'arrived_at_pickup',
        tappedAt: Date.now() - 5000,
        state: 'refused',
        restaurantName: 'Acropolis Grill',
      },
    ];

    renderHook(() => useArrivalDetection('courier-1'), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      setLatestFix({
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 10,
        at: Date.now(),
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDetectedArrival).not.toHaveBeenCalled();
  });

  it('does not trigger arrival when arrival is already on record (AC-1)', async () => {
    getInProgressSpy.mockResolvedValueOnce([
      {
        ...sampleJob,
        status: OrderStatus.courier_arrived_at_pickup_location,
      },
    ]);

    renderHook(() => useArrivalDetection('courier-1'), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      setLatestFix({
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 10,
        at: Date.now(),
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDetectedArrival).not.toHaveBeenCalled();
  });

  it('checks two legs at one restaurant independently (AC-1)', async () => {
    const jobLeg1 = { ...sampleJob, id: 'job-leg-1' };
    const jobLeg2 = { ...sampleJob, id: 'job-leg-2' };
    getInProgressSpy.mockResolvedValueOnce([jobLeg1, jobLeg2]);

    renderHook(() => useArrivalDetection('courier-1'), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const fixTime = Date.now();
    act(() => {
      setLatestFix({
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 15,
        at: fixTime,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDetectedArrival).toHaveBeenCalledTimes(2);
    expect(mockDetectedArrival).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-leg-1' }),
      'pickup',
      fixTime,
    );
    expect(mockDetectedArrival).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-leg-2' }),
      'pickup',
      fixTime,
    );
  });

  it('detects dropoff arrival after pickup (AC-1)', async () => {
    getInProgressSpy.mockResolvedValueOnce([
      {
        ...sampleJob,
        status: OrderStatus.picked_up,
      },
    ]);

    renderHook(() => useArrivalDetection('courier-1'), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const fixTime = Date.now();
    act(() => {
      setLatestFix({
        latitude: 39.37,
        longitude: 22.95,
        accuracyMetres: 15,
        at: fixTime,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDetectedArrival).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1' }),
      'dropoff',
      fixTime,
    );
  });

  describe('AC-12: Free hand back window and held arrivals', () => {
    it('holds arrival during free hand back window instead of queuing (AC-12)', async () => {
      const now = 1_000_000;
      jest.setSystemTime(now);

      // handBackUntilOnPhone is 30 s in the future
      const jobWithHandBack = {
        ...sampleJob,
        status: OrderStatus.dispatched,
        handBackUntilOnPhone: now + 30_000,
      };
      getInProgressSpy.mockResolvedValueOnce([jobWithHandBack]);

      renderHook(() => useArrivalDetection('courier-1'), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        setLatestFix({
          latitude: 39.362,
          longitude: 22.945,
          accuracyMetres: 15,
          at: now,
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      // NOT queued to outbox
      expect(mockDetectedArrival).not.toHaveBeenCalled();

      // HELD in heldArrivals store
      const held = await findHeldArrival('courier-1', 'job-1');
      expect(held).toEqual({
        courierId: 'courier-1',
        deliveryId: 'job-1',
        firstFixAt: now,
      });
    });

    it('releases held arrival when window ends + 3000 ms grace period with firstFixAt time (AC-12)', async () => {
      const startTime = 1_000_000;
      jest.setSystemTime(startTime);

      const jobWithHandBack = {
        ...sampleJob,
        status: OrderStatus.dispatched,
        handBackUntilOnPhone: startTime + 20_000,
      };
      getInProgressSpy.mockResolvedValue([jobWithHandBack]);

      // Pre-seed held arrival
      await holdArrival({
        courierId: 'courier-1',
        deliveryId: 'job-1',
        firstFixAt: startTime + 5_000,
      });

      renderHook(() => useArrivalDetection('courier-1'), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      // Still in window: not released
      expect(mockDetectedArrival).not.toHaveBeenCalled();

      // Advance time past handBackUntilOnPhone + 3000 ms grace period (20s + 3s = 23s)
      await act(async () => {
        jest.setSystemTime(startTime + 24_000);
        jest.advanceTimersByTime(24_000);
      });

      // Released with firstFixAt
      expect(mockDetectedArrival).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'job-1' }),
        'pickup',
        startTime + 5_000,
      );

      // Held arrival was dropped after release
      await waitFor(async () => {
        const remainingHold = await findHeldArrival('courier-1', 'job-1');
        expect(remainingHold).toBeNull();
      });
    });

    it('does NOT release held arrival while isHandBackInFlight is true (AC-12)', async () => {
      const startTime = 1_000_000;
      jest.setSystemTime(startTime);

      const jobWithHandBack = {
        ...sampleJob,
        status: OrderStatus.dispatched,
        handBackUntilOnPhone: startTime + 10_000,
      };
      getInProgressSpy.mockResolvedValue([jobWithHandBack]);

      await holdArrival({
        courierId: 'courier-1',
        deliveryId: 'job-1',
        firstFixAt: startTime + 2_000,
      });

      // Hand back request is in flight!
      startHandBack('job-1');

      renderHook(() => useArrivalDetection('courier-1'), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      // Advance time well past grace period
      await act(async () => {
        jest.setSystemTime(startTime + 20_000);
        jest.advanceTimersByTime(20_000);
      });

      // Hold is NOT released!
      expect(mockDetectedArrival).not.toHaveBeenCalled();

      // End hand back in flight
      endHandBack('job-1');
    });

    it('tidies held arrivals when a job leaves in progress list (AC-12)', async () => {
      // job-old is no longer in progress
      getInProgressSpy.mockResolvedValueOnce([sampleJob]);

      await holdArrival({
        courierId: 'courier-1',
        deliveryId: 'job-old',
        firstFixAt: 100,
      });

      renderHook(() => useArrivalDetection('courier-1'), { wrapper });

      await waitFor(async () => {
        expect(await findHeldArrival('courier-1', 'job-old')).toBeNull();
      });
    });
  });

  describe('re-check paths, queued guard and retry (spec 0021, review fix)', () => {
    it('detects arrival when radius arrives AFTER the fix (no new fix needed) (AC-1)', async () => {
      let resolveContact: (val: any) => void;
      fetchContactSpy.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveContact = resolve;
          }),
      );

      renderHook(() => useArrivalDetection('courier-1'), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      const fixTime = Date.now();
      // Fix arrives while radius is still undefined/pending
      act(() => {
        setLatestFix({
          latitude: 39.362,
          longitude: 22.945,
          accuracyMetres: 15,
          at: fixTime,
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      // No detection yet because radius is not known
      expect(mockDetectedArrival).not.toHaveBeenCalled();

      // Radius arrives now (no new fix)
      await act(async () => {
        resolveContact!({
          dispatchPhoneNumber: '+302421012345',
          arrivalRadiusMetres: 50,
        });
      });

      // Effect re-runs with updated radius and detects arrival using existing recent fix
      await waitFor(() => {
        expect(mockDetectedArrival).toHaveBeenCalledTimes(1);
      });
      expect(mockDetectedArrival).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'job-1' }),
        'pickup',
        fixTime,
      );
    });

    it('queued guard: two effect runs for the same job and stage queue one arrival only (AC-1)', async () => {
      let resolveDetected: (ok: boolean) => void;
      mockDetectedArrival.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveDetected = resolve;
          }),
      );

      renderHook(() => useArrivalDetection('courier-1'), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      const fixTime = Date.now();
      // First effect run with fix
      act(() => {
        setLatestFix({
          latitude: 39.362,
          longitude: 22.945,
          accuracyMetres: 15,
          at: fixTime,
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockDetectedArrival).toHaveBeenCalledTimes(1);

      // Second effect run with another fix for same job and stage
      act(() => {
        setLatestFix({
          latitude: 39.362,
          longitude: 22.945,
          accuracyMetres: 14,
          at: fixTime + 5000,
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Queued guard stops a duplicate call: still 1
      expect(mockDetectedArrival).toHaveBeenCalledTimes(1);

      resolveDetected!(true);
    });

    it('when detectedArrival resolves false the key is released so a later run queues it (AC-1)', async () => {
      mockDetectedArrival.mockResolvedValueOnce(false);

      renderHook(() => useArrivalDetection('courier-1'), { wrapper });

      await act(async () => {
        await Promise.resolve();
      });

      const fixTime = Date.now();
      act(() => {
        setLatestFix({
          latitude: 39.362,
          longitude: 22.945,
          accuracyMetres: 15,
          at: fixTime,
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockDetectedArrival).toHaveBeenCalledTimes(1);

      // Later run succeeds
      mockDetectedArrival.mockResolvedValueOnce(true);

      act(() => {
        setLatestFix({
          latitude: 39.362,
          longitude: 22.945,
          accuracyMetres: 12,
          at: fixTime + 1000,
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockDetectedArrival).toHaveBeenCalledTimes(2);
      expect(mockDetectedArrival).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 'job-1' }),
        'pickup',
        fixTime + 1000,
      );
    });
  });
});
