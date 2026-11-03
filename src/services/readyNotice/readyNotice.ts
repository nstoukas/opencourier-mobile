import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import i18next from 'i18next';
import { JobReadyUpdate, readyNoticeText } from '@app/utilities/readySignals';

// Spec 0023 (AC-6): one notice per job when its restaurant moves the ready time or marks the food
// ready. Its id is the job's, so a second change replaces the first instead of stacking.
export const READY_CHANNEL_ID = 'job-ready';

const ensureReadyChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: READY_CHANNEL_ID,
    name: i18next.t('translations:ready_channel'),
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    // The phone's own sound: a channel with none is silent.
    sound: 'default',
  });
};

// On Android notifee reads a body as HTML, so outside text (the restaurant's name) is escaped there
// (row 100); iOS shows plain text.
const escapeHtml = (line: string): string =>
  line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const showReadyNotice = async (
  update: JobReadyUpdate,
  now = Date.now(),
): Promise<void> => {
  await ensureReadyChannel();
  const text = readyNoticeText(update, now, i18next.t.bind(i18next) as never);
  await notifee.displayNotification({
    id: `ready-${update.deliveryId}`,
    title: i18next.t('translations:ready_notice_title'),
    body: Platform.OS === 'android' ? escapeHtml(text) : text,
    android: {
      channelId: READY_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
    },
  });
};
