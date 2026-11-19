import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventType } from '@notifee/react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import {
  REVIEW_ANSWERED_TYPE,
  openReviewsFromNotice,
  receiveReviewAnswer,
} from '@app/services/reviewNotice';
import { onNotificationEvent, onRemoteMessage } from './pushHandlers';

jest.mock('@app/services/reviewNotice', () => ({
  REVIEW_ANSWERED_TYPE: 'REVIEW_ANSWERED',
  receiveReviewAnswer: jest.fn(() => Promise.resolve()),
  openReviewsFromNotice: jest.fn(),
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

describe('pushHandlers REVIEW_ANSWERED (spec 0038, AC-9)', () => {
  const reviewPushData = {
    type: 'REVIEW_ANSWERED',
    requestId: 'rev-456',
  };

  const push = (data: Record<string, string>) =>
    ({ data } as unknown as FirebaseMessagingTypes.RemoteMessage);

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  describe('onRemoteMessage', () => {
    it('with token in background: calls receiveReviewAnswer', async () => {
      await AsyncStorage.setItem('token', 'courier-session-token');

      await onRemoteMessage(push(reviewPushData), 'background');

      expect(receiveReviewAnswer).toHaveBeenCalledTimes(1);
    });

    it('with token in foreground: calls receiveReviewAnswer', async () => {
      await AsyncStorage.setItem('token', 'courier-session-token');

      await onRemoteMessage(push(reviewPushData), 'foreground');

      expect(receiveReviewAnswer).toHaveBeenCalledTimes(1);
    });

    it('with no token in storage: stays quiet (no receiveReviewAnswer)', async () => {
      await onRemoteMessage(push(reviewPushData), 'background');
      expect(receiveReviewAnswer).not.toHaveBeenCalled();

      await onRemoteMessage(push(reviewPushData), 'foreground');
      expect(receiveReviewAnswer).not.toHaveBeenCalled();
    });
  });

  describe('onNotificationEvent', () => {
    it('tapping notification with data.type REVIEW_ANSWERED calls openReviewsFromNotice', async () => {
      await onNotificationEvent({
        type: EventType.PRESS,
        detail: {
          notification: {
            id: 'review-answer',
            data: { type: REVIEW_ANSWERED_TYPE },
          },
        },
      });

      expect(openReviewsFromNotice).toHaveBeenCalledTimes(1);
    });

    it('non-PRESS event with REVIEW_ANSWERED does not call openReviewsFromNotice', async () => {
      await onNotificationEvent({
        type: EventType.ACTION_PRESS,
        detail: {
          notification: {
            id: 'review-answer',
            data: { type: REVIEW_ANSWERED_TYPE },
          },
        },
      });

      expect(openReviewsFromNotice).not.toHaveBeenCalled();
    });

    it('PRESS event with different data type does not call openReviewsFromNotice', async () => {
      await onNotificationEvent({
        type: EventType.PRESS,
        detail: {
          notification: {
            id: 'other-notif',
            data: { type: 'SOME_OTHER_TYPE' },
          },
        },
      });

      expect(openReviewsFromNotice).not.toHaveBeenCalled();
    });
  });
});
