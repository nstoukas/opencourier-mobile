import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import '@app/localization/i18n';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import * as jobStepOutbox from '@app/services/jobStepOutbox';
import * as heldArrivals from '@app/services/heldArrivals';
import useOrder from './useOrder';

let mockUser: any;

jest.mock('./useUser', () => () => ({
  user: mockUser,
  isLoading: false,
  refetchUser: jest.fn(),
  updateStatus: jest.fn(),
  updateDeliverySettings: jest.fn(),
}));

describe('useOrder (spec 0009, spec 0021, AC-3, AC-5, AC-12)', () => {
  let addJobStepsSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;
  let findHeldSpy: jest.SpyInstance;
  let dropHeldSpy: jest.SpyInstance;

  const baseOrder: Order = {
    id: 'del-123',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Acropolis Grill',
  } as unknown as Order;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'rider-42' };
    addJobStepsSpy = jest
      .spyOn(jobStepOutbox, 'addJobSteps')
      .mockResolvedValue(undefined);
    findHeldSpy = jest
      .spyOn(heldArrivals, 'findHeldArrival')
      .mockResolvedValue(null);
    dropHeldSpy = jest
      .spyOn(heldArrivals, 'dropHeldArrival')
      .mockResolvedValue(undefined);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    alertSpy.mockRestore();
    findHeldSpy.mockRestore();
    dropHeldSpy.mockRestore();
  });

  it('logs and queues nothing when no rider is loaded (user undefined)', async () => {
    mockUser = undefined;

    const { result } = renderHook(() => useOrder());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.imHere(baseOrder);
    });

    expect(success).toBe(false);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'A job step was tapped with no rider loaded; nothing queued',
    );
    expect(addJobStepsSpy).not.toHaveBeenCalled();
  });

  it('logs and queues nothing when user id is empty', async () => {
    mockUser = { id: '' };

    const { result } = renderHook(() => useOrder());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.pickedUp(baseOrder);
    });

    expect(success).toBe(false);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'A job step was tapped with no rider loaded; nothing queued',
    );
    expect(addJobStepsSpy).not.toHaveBeenCalled();
  });

  it('shows an alert and returns false when addJobSteps fails', async () => {
    addJobStepsSpy.mockRejectedValueOnce(new Error('Storage failure'));

    const { result } = renderHook(() => useOrder());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.delivered({
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_dropoff_location,
      });
    });

    expect(success).toBe(false);
    expect(alertSpy).toHaveBeenCalledWith(
      expect.anything(),
      'Error: Storage failure',
    );
  });

  describe('imHere (AC-3)', () => {
    it('queues tapped arrived_at_pickup when at dispatched with no arrival on record', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.imHere({
          ...baseOrder,
          status: OrderStatus.dispatched,
        });
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          courierId: 'rider-42',
          deliveryId: 'del-123',
          step: 'arrived_at_pickup',
          restaurantName: 'Acropolis Grill',
          tappedAt: expect.any(Number),
        }),
      ]);
      const item = addJobStepsSpy.mock.calls[0][0][0];
      expect(item.detected).toBeUndefined();
    });

    it('queues dispatched first then arrived_at_pickup when at accepted', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.imHere({
          ...baseOrder,
          status: OrderStatus.accepted,
        });
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          step: 'dispatched',
          deliveryId: 'del-123',
        }),
        expect.objectContaining({
          step: 'arrived_at_pickup',
          deliveryId: 'del-123',
        }),
      ]);
      const steps = addJobStepsSpy.mock.calls[0][0];
      expect(steps[0].tappedAt).toBe(steps[1].tappedAt);
    });

    it('uses held arrival if available during imHere at pickup and drops hold (AC-12)', async () => {
      findHeldSpy.mockResolvedValueOnce({
        courierId: 'rider-42',
        deliveryId: 'del-123',
        firstFixAt: 1700000005000,
      });

      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.imHere({
          ...baseOrder,
          status: OrderStatus.dispatched,
        });
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          step: 'arrived_at_pickup',
          tappedAt: 1700000005000,
          detected: true,
        }),
      ]);
      expect(dropHeldSpy).toHaveBeenCalledWith('rider-42', 'del-123');
    });

    it('queues tapped arrived_at_dropoff when at picked_up', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.imHere({
          ...baseOrder,
          status: OrderStatus.picked_up,
        });
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          step: 'arrived_at_dropoff',
          deliveryId: 'del-123',
        }),
      ]);
      const item = addJobStepsSpy.mock.calls[0][0][0];
      expect(item.detected).toBeUndefined();
    });

    it('does nothing when arrival is already on record', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.imHere({
          ...baseOrder,
          status: OrderStatus.courier_arrived_at_pickup_location,
        });
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).not.toHaveBeenCalled();
    });
  });

  describe('detectedArrival (AC-1, AC-13)', () => {
    it('queues arrived_at_pickup with detected: true and tappedAt = fix.at', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.detectedArrival(
          { ...baseOrder, status: OrderStatus.dispatched },
          'pickup',
          1700000010000,
        );
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          step: 'arrived_at_pickup',
          tappedAt: 1700000010000,
          detected: true,
        }),
      ]);
    });

    it('at accepted queues dispatched then arrived_at_pickup with detected: true', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.detectedArrival(
          { ...baseOrder, status: OrderStatus.accepted },
          'pickup',
          1700000020000,
        );
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          step: 'dispatched',
          tappedAt: 1700000020000,
        }),
        expect.objectContaining({
          step: 'arrived_at_pickup',
          tappedAt: 1700000020000,
          detected: true,
        }),
      ]);
    });

    it('queues arrived_at_dropoff with detected: true and tappedAt = fix.at', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.detectedArrival(
          { ...baseOrder, status: OrderStatus.picked_up },
          'dropoff',
          1700000030000,
        );
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          step: 'arrived_at_dropoff',
          tappedAt: 1700000030000,
          detected: true,
        }),
      ]);
    });
  });

  describe('pickedUp (AC-5)', () => {
    it('when at dispatched without arrival: queues arrived_at_pickup then picked_up (never picked_up alone)', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.pickedUp({
          ...baseOrder,
          status: OrderStatus.dispatched,
        });
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          step: 'arrived_at_pickup',
          deliveryId: 'del-123',
        }),
        expect.objectContaining({
          step: 'picked_up',
          deliveryId: 'del-123',
        }),
      ]);
      const steps = addJobStepsSpy.mock.calls[0][0];
      expect(steps[0].detected).toBeUndefined();
      expect(steps[0].tappedAt).toBe(steps[1].tappedAt);
    });

    it('when at accepted without arrival: queues dispatched, arrived_at_pickup, then picked_up', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.pickedUp({
          ...baseOrder,
          status: OrderStatus.accepted,
        });
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({ step: 'dispatched' }),
        expect.objectContaining({ step: 'arrived_at_pickup' }),
        expect.objectContaining({ step: 'picked_up' }),
      ]);
    });

    it('when arrival already on record: queues only picked_up', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.pickedUp({
          ...baseOrder,
          status: OrderStatus.courier_arrived_at_pickup_location,
        });
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          step: 'picked_up',
          deliveryId: 'del-123',
        }),
      ]);
      expect(addJobStepsSpy.mock.calls[0][0]).toHaveLength(1);
    });

    it('consumes held arrival if available: sends held arrival with firstFixAt and detected: true, then picked_up, and drops hold (AC-12)', async () => {
      findHeldSpy.mockResolvedValueOnce({
        courierId: 'rider-42',
        deliveryId: 'del-123',
        firstFixAt: 1700000099000,
      });

      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.pickedUp({
          ...baseOrder,
          status: OrderStatus.dispatched,
        });
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          step: 'arrived_at_pickup',
          tappedAt: 1700000099000,
          detected: true,
        }),
        expect.objectContaining({
          step: 'picked_up',
        }),
      ]);
      expect(dropHeldSpy).toHaveBeenCalledWith('rider-42', 'del-123');
    });
  });

  describe('delivered (AC-5)', () => {
    it('when at picked_up without arrival: queues arrived_at_dropoff then delivered with no note', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.delivered({
          ...baseOrder,
          status: OrderStatus.picked_up,
        });
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          step: 'arrived_at_dropoff',
          deliveryId: 'del-123',
        }),
        expect.objectContaining({
          step: 'delivered',
          deliveryId: 'del-123',
        }),
      ]);
      const steps = addJobStepsSpy.mock.calls[0][0];
      expect(steps[1].note).toBeUndefined();
    });

    it('when arrival already on record: queues only delivered with no note', async () => {
      const { result } = renderHook(() => useOrder());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.delivered({
          ...baseOrder,
          status: OrderStatus.courier_arrived_at_dropoff_location,
        });
      });

      expect(success).toBe(true);
      expect(addJobStepsSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          step: 'delivered',
          deliveryId: 'del-123',
        }),
      ]);
      expect(addJobStepsSpy.mock.calls[0][0]).toHaveLength(1);
    });
  });
});
