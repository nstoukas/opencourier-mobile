import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import { showJobEditedNotice } from '@app/services/readyNotice/readyNotice';
import {
  clearJobEditMarks,
  jobEditMarksFor,
} from '@app/services/jobEdits/jobEditMarks';
import { onRemoteMessage } from './pushHandlers';
import { showOfferAlert } from './offerAlert';

jest.mock('@app/services/readyNotice/readyNotice', () => ({
  showJobEditedNotice: jest.fn(() => Promise.resolve()),
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

// Row 164 (AC-1): push notification handling for JOB_EDITED
describe('onRemoteMessage JOB_EDITED (row 164, AC-1)', () => {
  const pushData = {
    type: 'JOB_EDITED',
    deliveryId: 'del-push-edit-1',
    restaurantName: 'R73 Kitchen',
    changed: 'NOTES,TIMES',
    editedAt: '2026-11-25T14:30:00.000Z',
  };

  const push = (data: Record<string, string>) =>
    ({ data } as unknown as FirebaseMessagingTypes.RemoteMessage);

  let invalidateSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clearJobEditMarks();
    queryClient.clear();
    await AsyncStorage.clear();
    await AsyncStorage.setItem('token', 'courier-valid-token');
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    invalidateSpy.mockRestore();
    clearJobEditMarks();
    queryClient.clear();
    jest.useRealTimers();
  });

  it('with a token: marks the job, posts the notice, and invalidates inProgressOrders only', async () => {
    await onRemoteMessage(push(pushData), 'background');

    // 1. Marks the job
    expect(jobEditMarksFor('del-push-edit-1')).toEqual(['NOTES', 'TIMES']);

    // 2. Posts notice
    expect(showJobEditedNotice).toHaveBeenCalledTimes(1);
    expect(showJobEditedNotice).toHaveBeenCalledWith({
      deliveryId: 'del-push-edit-1',
      restaurantName: 'R73 Kitchen',
      changed: ['NOTES', 'TIMES'],
      editedAt: '2026-11-25T14:30:00.000Z',
    });

    // 3. Invalidates inProgressOrders
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });

    // Not handled as an offer
    expect(showOfferAlert).not.toHaveBeenCalled();
  });

  it('works the same in foreground mode', async () => {
    await onRemoteMessage(
      push({
        ...pushData,
        changed: 'NOTES',
      }),
      'foreground',
    );

    expect(jobEditMarksFor('del-push-edit-1')).toEqual(['NOTES']);
    expect(showJobEditedNotice).toHaveBeenCalledWith({
      deliveryId: 'del-push-edit-1',
      restaurantName: 'R73 Kitchen',
      changed: ['NOTES'],
      editedAt: '2026-11-25T14:30:00.000Z',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
  });

  it('with no token (logged out): does nothing (no marks, no notice, no invalidation)', async () => {
    await AsyncStorage.removeItem('token');

    await onRemoteMessage(push(pushData), 'background');

    expect(jobEditMarksFor('del-push-edit-1')).toEqual([]);
    expect(showJobEditedNotice).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('a notice that throws still invalidates inProgressOrders and logs error', async () => {
    (showJobEditedNotice as jest.Mock).mockRejectedValueOnce(
      new Error('notification permission denied'),
    );

    await onRemoteMessage(push(pushData), 'background');

    expect(jobEditMarksFor('del-push-edit-1')).toEqual(['NOTES', 'TIMES']);
    expect(showJobEditedNotice).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
  });

  it('malformed push data does nothing', async () => {
    await onRemoteMessage(
      push({
        type: 'JOB_EDITED',
        deliveryId: '',
        changed: 'NOTES',
      }),
      'background',
    );

    await onRemoteMessage(
      push({
        type: 'JOB_EDITED',
        deliveryId: 'del-push-edit-1',
        changed: '',
      }),
      'background',
    );

    expect(jobEditMarksFor('del-push-edit-1')).toEqual([]);
    expect(showJobEditedNotice).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
