import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import i18next from 'i18next';
import { JobReadyUpdate, readyNoticeText } from '@app/utilities/readySignals';
import { JobEdited, jobEditedNoticeText } from '@app/utilities/jobEdits';
import { escapeHtml } from '@app/utilities/escapeHtml';

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

// The last change each job's notice was posted for. The backend sends every change both over the live
// connection and by push (row 21 review), so the same change can arrive twice; it is shown once.
// Memory only: when the app is not running there is no live connection, so only the push arrives.
const lastShown = new Map<string, string>();

const changeKey = (update: JobReadyUpdate): string =>
  `${update.readyAt ?? ''}|${update.foodReadyAt ?? ''}`;

export const showReadyNotice = async (
  update: JobReadyUpdate,
  now = Date.now(),
): Promise<void> => {
  const key = changeKey(update);
  if (lastShown.get(update.deliveryId) === key) {
    return;
  }
  // Marked before the first await (agy review): the live message and the push can arrive together, and
  // a mark made after the await would let both past the check above. A copy that fails to post gives
  // the mark back, so the other copy can still try.
  lastShown.set(update.deliveryId, key);
  try {
    await ensureReadyChannel();
    const text = readyNoticeText(update, now, i18next.t.bind(i18next));
    await notifee.displayNotification({
      id: `ready-${update.deliveryId}`,
      title: i18next.t('translations:ready_notice_title'),
      body: Platform.OS === 'android' ? escapeHtml(text) : text,
      android: {
        channelId: READY_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
      ios: { sound: 'default' },
    });
  } catch (error) {
    if (lastShown.get(update.deliveryId) === key) {
      lastShown.delete(update.deliveryId);
    }
    throw error;
  }
};

// For tests only: forget which changes were shown.
export const resetReadyNoticeForTests = (): void => {
  lastShown.clear();
};

// Row 164: the restaurant changed the notes or the times of a held job. On the ready channel, since both are the
// restaurant changing a job the rider holds; its own id per job, so a second edit replaces the first. The live copy
// and the push of one edit share `editedAt`, so it is shown once.
const lastEdited = new Map<string, string>();

export const showJobEditedNotice = async (update: JobEdited): Promise<void> => {
  const key = `${update.editedAt}|${update.changed.join(',')}`;
  if (lastEdited.get(update.deliveryId) === key) {
    return;
  }
  // Marked before the first await, as in showReadyNotice; given back if the notice cannot be posted.
  lastEdited.set(update.deliveryId, key);
  try {
    await ensureReadyChannel();
    const text = jobEditedNoticeText(update, i18next.t.bind(i18next));
    await notifee.displayNotification({
      id: `edited-${update.deliveryId}`,
      title: i18next.t('translations:job_edited_title'),
      body: Platform.OS === 'android' ? escapeHtml(text) : text,
      android: {
        channelId: READY_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
      ios: { sound: 'default' },
    });
  } catch (error) {
    if (lastEdited.get(update.deliveryId) === key) {
      lastEdited.delete(update.deliveryId);
    }
    throw error;
  }
};

// For tests only: forget which edits were shown.
export const resetJobEditedNoticeForTests = (): void => {
  lastEdited.clear();
};
