import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventType } from '@notifee/react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { queryClient } from '@app/services/queryClient';
import {
  noticeChatMessage,
  openChatFromNotice,
} from '@app/services/chat/chatNotice';
import { onNotificationEvent, onRemoteMessage } from './pushHandlers';
import { QueryKeys } from '@app/utilities/queryKeys';

jest.mock('@app/services/chat/chatNotice', () => ({
  showChatNotice: jest.fn(() => Promise.resolve()),
  noticeChatMessage: jest.fn(() => Promise.resolve()),
  openChatFromNotice: jest.fn(),
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

describe('onRemoteMessage CHAT_MESSAGE (spec 0034, AC-11)', () => {
  const chatPushData = {
    type: 'CHAT_MESSAGE',
    threadId: 'th-123',
  };

  const push = (data: Record<string, string>) =>
    ({ data } as unknown as FirebaseMessagingTypes.RemoteMessage);

  let invalidateQueriesSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    invalidateQueriesSpy = jest
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    invalidateQueriesSpy.mockRestore();
  });

  it('in the background with a token: calls noticeChatMessage AND refetches chatMessages', async () => {
    await AsyncStorage.setItem('token', 'valid-courier-token');

    await onRemoteMessage(push(chatPushData), 'background');

    expect(noticeChatMessage).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.chatMessages],
    });
  });

  it('in the foreground with a token: calls noticeChatMessage AND refetches chatMessages (review of 2026-11-18)', async () => {
    await AsyncStorage.setItem('token', 'valid-courier-token');

    await onRemoteMessage(push(chatPushData), 'foreground');

    expect(noticeChatMessage).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.chatMessages],
    });
  });

  it('with no token in storage: does nothing (no notice, no query invalidation)', async () => {
    // Storage has no 'token'
    await onRemoteMessage(push(chatPushData), 'background');

    expect(noticeChatMessage).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();

    await onRemoteMessage(push(chatPushData), 'foreground');

    expect(noticeChatMessage).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});

describe('onNotificationEvent CHAT_MESSAGE tap (spec 0034, Minor 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tapping a notification whose data.type is CHAT_MESSAGE calls openChatFromNotice', async () => {
    await onNotificationEvent({
      type: EventType.PRESS,
      detail: {
        notification: {
          id: 'chat-message',
          data: { type: 'CHAT_MESSAGE' },
        },
      },
    });

    expect(openChatFromNotice).toHaveBeenCalledTimes(1);
  });

  it('non-PRESS event with CHAT_MESSAGE does not call openChatFromNotice', async () => {
    await onNotificationEvent({
      type: EventType.ACTION_PRESS,
      detail: {
        notification: {
          id: 'chat-message',
          data: { type: 'CHAT_MESSAGE' },
        },
      },
    });

    expect(openChatFromNotice).not.toHaveBeenCalled();
  });

  it('PRESS event with different data type does not call openChatFromNotice', async () => {
    await onNotificationEvent({
      type: EventType.PRESS,
      detail: {
        notification: {
          id: 'offer-1',
          data: { type: 'NEW_OFFER' },
        },
      },
    });

    expect(openChatFromNotice).not.toHaveBeenCalled();
  });
});
