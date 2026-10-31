import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import '@app/localization/i18n';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import * as jobStepOutbox from '@app/services/jobStepOutbox';
import useOrder from './useOrder';

let mockUser: any = undefined;

jest.mock('./useUser', () => () => ({
  user: mockUser,
  isLoading: false,
  refetchUser: jest.fn(),
  updateStatus: jest.fn(),
  updateDeliverySettings: jest.fn(),
}));

describe('useOrder (spec 0009, AC-2, AC-8)', () => {
  let addJobStepsSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;

  const sampleOrder: Order = {
    id: 'del-123',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Acropolis Grill',
  } as unknown as Order;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = undefined;
    addJobStepsSpy = jest
      .spyOn(jobStepOutbox, 'addJobSteps')
      .mockResolvedValue(undefined);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('logs and queues nothing when no rider is loaded (user undefined)', async () => {
    mockUser = undefined;

    const { result } = renderHook(() => useOrder());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.arrivedAtPickup(sampleOrder);
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
      success = await result.current.confirmOrderItems(sampleOrder);
    });

    expect(success).toBe(false);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'A job step was tapped with no rider loaded; nothing queued',
    );
    expect(addJobStepsSpy).not.toHaveBeenCalled();
  });

  it('queues steps with the rider courierId when a rider is loaded', async () => {
    mockUser = { id: 'rider-42' };

    const { result } = renderHook(() => useOrder());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.arrivedAtPickup(sampleOrder);
    });

    expect(success).toBe(true);
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      'A job step was tapped with no rider loaded; nothing queued',
    );
    expect(addJobStepsSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        courierId: 'rider-42',
        deliveryId: 'del-123',
        step: 'arrived_at_pickup',
        restaurantName: 'Acropolis Grill',
      }),
    ]);
  });

  it('shows an alert and returns false when addJobSteps fails', async () => {
    mockUser = { id: 'rider-42' };
    addJobStepsSpy.mockRejectedValueOnce(new Error('Storage failure'));

    const { result } = renderHook(() => useOrder());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.markAsDelivered(
        sampleOrder,
        'left on porch',
      );
    });

    expect(success).toBe(false);
    expect(alertSpy).toHaveBeenCalledWith(
      expect.anything(),
      'Error: Storage failure',
    );
  });
});
