import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { queryClient } from '@app/services/queryClient';
import { receiveSplitDecision } from '@app/services/splitNotice/splitNotice';
import { receiveRemovalDecision } from '@app/services/removalNotice/removalNotice';
import { onRemoteMessage } from './pushHandlers';

jest.mock('@app/services/splitNotice/splitNotice', () => ({
  receiveSplitDecision: jest.fn(() => Promise.resolve()),
}));

jest.mock('@app/services/removalNotice/removalNotice', () => ({
  receiveRemovalDecision: jest.fn(() => Promise.resolve()),
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

// Spec 0047 (cross check 12), row 11 review: the push for dispatch's answer had no branch, so an answer
// reaching a phone whose app was closed said nothing.
describe('onRemoteMessage SPLIT_REQUEST_DECIDED (spec 0047, cross check 12)', () => {
  // The strings the backend's push carries ('' for none).
  const pushData = {
    type: 'SPLIT_REQUEST_DECIDED',
    deliveryId: 'del-push-split',
    outcome: 'CONFIRMED',
    adminNote: '',
    legNumber: '1',
    legCount: '2',
    boxSize: 'MEDIUM',
  };

  const push = (data: Record<string, string>) =>
    ({ data } as unknown as FirebaseMessagingTypes.RemoteMessage);

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it.each(['background', 'foreground'] as const)(
    'hands the answer to receiveSplitDecision when a rider is logged in (%s)',
    async state => {
      await AsyncStorage.setItem('token', 'courier-auth-token');

      await onRemoteMessage(push(pushData), state);

      expect(receiveSplitDecision).toHaveBeenCalledTimes(1);
      expect(receiveSplitDecision).toHaveBeenCalledWith(pushData, queryClient);
    },
  );

  it('does nothing when nobody is logged in on this phone', async () => {
    await onRemoteMessage(push(pushData), 'background');

    expect(receiveSplitDecision).not.toHaveBeenCalled();
  });

  it('is not mistaken for a removal answer', async () => {
    await AsyncStorage.setItem('token', 'courier-auth-token');

    await onRemoteMessage(push(pushData), 'background');

    expect(receiveRemovalDecision).not.toHaveBeenCalled();
  });

  it('a notice that cannot be shown does not break the push handler', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await AsyncStorage.setItem('token', 'courier-auth-token');
    (receiveSplitDecision as jest.Mock).mockRejectedValueOnce(
      new Error('Notifee failed to post'),
    );

    await expect(
      onRemoteMessage(push(pushData), 'background'),
    ).resolves.toBeUndefined();
    logSpy.mockRestore();
  });

  it('another kind of push is not handed to it', async () => {
    await AsyncStorage.setItem('token', 'courier-auth-token');

    await onRemoteMessage(
      push({ ...pushData, type: 'REMOVAL_REQUEST_DECIDED' }),
      'background',
    );

    expect(receiveSplitDecision).not.toHaveBeenCalled();
  });
});
