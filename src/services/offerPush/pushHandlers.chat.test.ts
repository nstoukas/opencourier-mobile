import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { queryClient } from '@app/services/queryClient';
import { showChatNotice } from '@app/services/chat/chatNotice';
import { onRemoteMessage } from './pushHandlers';
import { QueryKeys } from '@app/utilities/queryKeys';

jest.mock('@app/services/chat/chatNotice', () => ({
  showChatNotice: jest.fn(() => Promise.resolve()),
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

  it('in the background with a token: shows the chat notice AND refetches chatMessages', async () => {
    await AsyncStorage.setItem('token', 'valid-courier-token');

    await onRemoteMessage(push(chatPushData), 'background');

    expect(showChatNotice).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.chatMessages],
    });
  });

  it('in the foreground with a token: does NOT show the chat notice, but STILL refetches chatMessages', async () => {
    await AsyncStorage.setItem('token', 'valid-courier-token');

    await onRemoteMessage(push(chatPushData), 'foreground');

    expect(showChatNotice).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.chatMessages],
    });
  });

  it('with no token in storage: does nothing (no notice, no query invalidation)', async () => {
    // Storage has no 'token'
    await onRemoteMessage(push(chatPushData), 'background');

    expect(showChatNotice).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();

    await onRemoteMessage(push(chatPushData), 'foreground');

    expect(showChatNotice).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
