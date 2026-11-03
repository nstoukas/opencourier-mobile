import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import { showReadyNotice } from '@app/services/readyNotice/readyNotice';
import { onRemoteMessage } from './pushHandlers';
import { showOfferAlert } from './offerAlert';

// The notice itself is tested in readyNotice.test.ts; here only that the push
// handler posts it, from the push's own fields.
jest.mock('@app/services/readyNotice/readyNotice', () => ({
  showReadyNotice: jest.fn(() => Promise.resolve()),
}));

jest.mock('@app/navigation/navigationRef', () => ({
  isHomeInFront: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('./offerAlert', () => ({
  cancelOfferAlert: jest.fn(),
  showOfferAlert: jest.fn(),
  ACCEPT_ACTION: 'accept',
  DECLINE_ACTION: 'decline',
}));

// Spec 0023 (AC-6): the JOB_READY_UPDATED data push (every value text).
describe('onRemoteMessage JOB_READY_UPDATED (spec 0023, AC-6)', () => {
  const pushData = {
    type: 'JOB_READY_UPDATED',
    deliveryId: 'del-ready-1',
    restaurantName: 'R73 Kitchen',
    readyAt: '2026-11-03T12:12:00.000Z',
    foodReadyAt: '',
    delayMinutes: '10',
  };

  const push = (data: Record<string, string>) =>
    ({ data } as unknown as FirebaseMessagingTypes.RemoteMessage);

  let invalidateSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    queryClient.clear();
    await AsyncStorage.clear();
    await AsyncStorage.setItem('token', 'courier-valid-token');
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    invalidateSpy.mockRestore();
    queryClient.clear();
    jest.useRealTimers();
  });

  it('posts the notice from the push fields and refetches the in progress jobs only', async () => {
    await onRemoteMessage(push(pushData), 'background');

    expect(showReadyNotice).toHaveBeenCalledTimes(1);
    expect(showReadyNotice).toHaveBeenCalledWith({
      deliveryId: 'del-ready-1',
      restaurantName: 'R73 Kitchen',
      readyAt: '2026-11-03T12:12:00.000Z',
      foodReadyAt: null,
      delayMinutes: 10,
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
    // Not handled as an offer.
    expect(showOfferAlert).not.toHaveBeenCalled();
  });

  it('works the same when the app is in front', async () => {
    await onRemoteMessage(
      push({
        ...pushData,
        foodReadyAt: '2026-11-03T12:01:00.000Z',
        delayMinutes: '',
      }),
      'foreground',
    );
    expect(showReadyNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: 'del-ready-1',
        foodReadyAt: '2026-11-03T12:01:00.000Z',
        delayMinutes: null,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
  });

  it('does nothing without a stored token (logged out)', async () => {
    await AsyncStorage.removeItem('token');
    await onRemoteMessage(push(pushData), 'background');
    expect(showReadyNotice).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('does nothing for a malformed push with no deliveryId', async () => {
    const noId: Record<string, string> = { ...pushData };
    delete noId.deliveryId;
    await onRemoteMessage(push(noId), 'background');
    await onRemoteMessage(push({ ...pushData, deliveryId: '' }), 'background');
    expect(showReadyNotice).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(showOfferAlert).not.toHaveBeenCalled();
  });

  // Row 21 review: a notice that cannot be posted (notifee throws, no permission) must not stop the
  // held jobs being refetched, and must not reject into Firebase's handler.
  it('still refetches the in progress jobs, and does not throw, when the notice fails', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    (showReadyNotice as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('notifee: no permission')),
    );

    await expect(
      onRemoteMessage(push(pushData), 'background'),
    ).resolves.toBeUndefined();

    expect(showReadyNotice).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
    logSpy.mockRestore();
  });
});
