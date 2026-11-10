import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { queryClient } from '@app/services/queryClient';
import { receiveRemovalDecision } from '@app/services/removalNotice/removalNotice';
import { onRemoteMessage } from './pushHandlers';

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

describe('onRemoteMessage REMOVAL_REQUEST_DECIDED (spec 0035, AC-11)', () => {
  const pushData = {
    type: 'REMOVAL_REQUEST_DECIDED',
    deliveryId: 'del-push-removal',
    outcome: 'APPROVED',
    decisionNote: '',
    paid: 'true',
    payAmount: '300',
    currencyCode: 'EUR',
  };

  const push = (data: Record<string, string>) =>
    ({ data } as unknown as FirebaseMessagingTypes.RemoteMessage);

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('routes REMOVAL_REQUEST_DECIDED push to receiveRemovalDecision when logged in', async () => {
    await AsyncStorage.setItem('token', 'courier-auth-token');

    await onRemoteMessage(push(pushData), 'background');

    expect(receiveRemovalDecision).toHaveBeenCalledWith(pushData, queryClient);
  });

  it('ignores REMOVAL_REQUEST_DECIDED push when logged out', async () => {
    await onRemoteMessage(push(pushData), 'background');

    expect(receiveRemovalDecision).not.toHaveBeenCalled();
  });
});
