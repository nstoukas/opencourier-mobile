import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import '@app/localization/i18n';
import {
  CHAT_NOTIFICATION_ID,
  MESSAGES_CHANNEL_ID,
  clearChatNotice,
  showChatNotice,
} from './chatNotice';

describe('chatNotice (spec 0034, AC-11)', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('showChatNotice uses channel "messages" at AndroidImportance.DEFAULT (never an offer channel, never HIGH)', async () => {
    await showChatNotice();

    expect(notifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MESSAGES_CHANNEL_ID,
        name: expect.any(String),
        importance: AndroidImportance.DEFAULT,
        sound: 'default',
      }),
    );
    expect(MESSAGES_CHANNEL_ID).toBe('messages');
    expect(AndroidImportance.DEFAULT).toBe(3);
    // Never an offer channel (offers use high importance ringing channels)
    expect(notifee.createChannel).not.toHaveBeenCalledWith(
      expect.objectContaining({
        importance: AndroidImportance.HIGH,
      }),
    );
  });

  it('showChatNotice displays notification with title "New message from Dispatch", NO message text, and one fixed notification id', async () => {
    await showChatNotice();

    expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    expect(notifee.displayNotification).toHaveBeenCalledWith({
      id: CHAT_NOTIFICATION_ID,
      title: 'New message from Dispatch',
      data: { type: 'CHAT_MESSAGE' },
      android: {
        channelId: MESSAGES_CHANNEL_ID,
        pressAction: { id: 'default' },
      },
    });

    // Verify fixed notification id
    expect(CHAT_NOTIFICATION_ID).toBe('chat-message');

    // Verify NO message text in title or body (body is undefined)
    const callArgs = (notifee.displayNotification as jest.Mock).mock
      .calls[0][0];
    expect(callArgs.body).toBeUndefined();
    expect(callArgs.title).toBe('New message from Dispatch');
  });

  it('clearChatNotice cancels notification with fixed notification id', () => {
    clearChatNotice();

    expect(notifee.cancelNotification).toHaveBeenCalledWith(
      CHAT_NOTIFICATION_ID,
    );
  });
});
