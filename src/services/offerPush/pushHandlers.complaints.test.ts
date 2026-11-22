import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventType } from '@notifee/react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import {
  COMPLAINT_NEEDS_REPLY_TYPE,
  openComplaintsFromNotice,
  receiveComplaintNeedsReply,
} from '@app/services/complaintNotice';
import { onNotificationEvent, onRemoteMessage } from './pushHandlers';

jest.mock('@app/services/complaintNotice', () => ({
  COMPLAINT_NEEDS_REPLY_TYPE: 'COMPLAINT_NEEDS_REPLY',
  receiveComplaintNeedsReply: jest.fn(() => Promise.resolve()),
  openComplaintsFromNotice: jest.fn(),
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

// Spec 0052 (AC-4): COMPLAINT_NEEDS_REPLY push handler tests.
describe('pushHandlers COMPLAINT_NEEDS_REPLY (spec 0052, AC-4)', () => {
  const complaintPushData = {
    type: 'COMPLAINT_NEEDS_REPLY',
    complaintId: 'comp-789',
  };

  const push = (data: Record<string, string>) =>
    ({ data } as unknown as FirebaseMessagingTypes.RemoteMessage);

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  describe('onRemoteMessage', () => {
    it('with token in background: calls receiveComplaintNeedsReply (shown Online or Offline)', async () => {
      await AsyncStorage.setItem('token', 'courier-session-token');

      await onRemoteMessage(push(complaintPushData), 'background');

      expect(receiveComplaintNeedsReply).toHaveBeenCalledTimes(1);
    });

    it('with token in foreground: calls receiveComplaintNeedsReply', async () => {
      await AsyncStorage.setItem('token', 'courier-session-token');

      await onRemoteMessage(push(complaintPushData), 'foreground');

      expect(receiveComplaintNeedsReply).toHaveBeenCalledTimes(1);
    });

    it('with no token in storage: stays quiet (no receiveComplaintNeedsReply)', async () => {
      await onRemoteMessage(push(complaintPushData), 'background');
      expect(receiveComplaintNeedsReply).not.toHaveBeenCalled();

      await onRemoteMessage(push(complaintPushData), 'foreground');
      expect(receiveComplaintNeedsReply).not.toHaveBeenCalled();
    });
  });

  describe('onNotificationEvent', () => {
    it('tapping notification with data.type COMPLAINT_NEEDS_REPLY calls openComplaintsFromNotice', async () => {
      await onNotificationEvent({
        type: EventType.PRESS,
        detail: {
          notification: {
            id: 'complaint-needs-reply',
            data: { type: COMPLAINT_NEEDS_REPLY_TYPE },
          },
        },
      });

      expect(openComplaintsFromNotice).toHaveBeenCalledTimes(1);
    });

    it('non-PRESS event with COMPLAINT_NEEDS_REPLY does not call openComplaintsFromNotice', async () => {
      await onNotificationEvent({
        type: EventType.ACTION_PRESS,
        detail: {
          notification: {
            id: 'complaint-needs-reply',
            data: { type: COMPLAINT_NEEDS_REPLY_TYPE },
          },
        },
      });

      expect(openComplaintsFromNotice).not.toHaveBeenCalled();
    });

    it('PRESS event with different data type does not call openComplaintsFromNotice', async () => {
      await onNotificationEvent({
        type: EventType.PRESS,
        detail: {
          notification: {
            id: 'other-notif',
            data: { type: 'SOME_OTHER_TYPE' },
          },
        },
      });

      expect(openComplaintsFromNotice).not.toHaveBeenCalled();
    });
  });
});
