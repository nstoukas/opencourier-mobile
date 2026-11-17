import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import i18next from 'i18next';
import { notificationText } from '@app/utilities/notificationText';

// Spec 0034 (chat), AC-11: dispatch wrote while the app was not in front. The push carries no message
// text (nothing anyone wrote passes through Google), so the phone draws a fixed line itself. Its own
// channel, at default importance, apart from every offer channel: a chat message never sounds like
// an offer. One notification id, so several messages show as one line, not a pile.
export const MESSAGES_CHANNEL_ID = 'messages';
export const CHAT_NOTIFICATION_ID = 'chat-message';

const ensureChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: MESSAGES_CHANNEL_ID,
    name: i18next.t('translations:chat_channel'),
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });
};

export async function showChatNotice(): Promise<void> {
  await ensureChannel();
  await notifee.displayNotification({
    id: CHAT_NOTIFICATION_ID,
    title: notificationText(i18next.t('translations:chat_notice_title')),
    data: { type: 'CHAT_MESSAGE' },
    android: {
      channelId: MESSAGES_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
}

// The rider opened the chat: the notice has nothing more to say.
export function clearChatNotice(): void {
  notifee
    .cancelNotification(CHAT_NOTIFICATION_ID)
    .catch(error => console.log('Could not clear the chat notice', error));
}
