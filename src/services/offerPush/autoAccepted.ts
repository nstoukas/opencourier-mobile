// The auto accept notice (spec 0020, AC-12): when the phone accepts an offer
// by itself (the rider's auto accept setting), it says so once, with a sound
// of its own that a rider on a moped cannot miss.
//
// It plays at the notification volume, through an ordinary notifee
// notification: no native sound code. A rider's own tap plays nothing new.

import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import i18next from 'i18next';

// Android fixes a channel's sound when the channel is first made, so the new
// sound needs a channel of its own (decision 71.7). The sound is
// `android/app/src/main/res/raw/auto_accept.wav`, made by
// `scripts/make-auto-accept-sound.py`. Changing that sound for phones that
// already made this channel needs a new id here.
export const AUTO_ACCEPTED_CHANNEL_ID = 'auto-accepted';
// The file's name without its extension, as Android names raw resources.
const AUTO_ACCEPT_SOUND = 'auto_accept';

// Creating a channel that exists already changes nothing, so this runs before
// every notice.
const ensureAutoAcceptedChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: AUTO_ACCEPTED_CHANNEL_ID,
    name: i18next.t('translations:auto_accepted_channel'),
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: AUTO_ACCEPT_SOUND,
    vibration: true,
  });
};

// One notice per accepted offer: its id is the delivery id, so a repeat for
// the same delivery replaces it rather than ringing twice in the tray.
export const announceAutoAccept = async (
  deliveryId: string,
  restaurantName: string,
): Promise<void> => {
  try {
    await ensureAutoAcceptedChannel();
    await notifee.displayNotification({
      id: `auto-accepted-${deliveryId}`,
      title: i18next.t('translations:auto_accepted_title', {
        restaurant: restaurantName,
      }),
      android: {
        channelId: AUTO_ACCEPTED_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        // It has done its job once heard: it leaves the tray by itself after
        // two minutes, so a day of auto accepts does not pile up (row 71 review).
        timeoutAfter: 2 * 60 * 1000,
        pressAction: { id: 'default' },
      },
      ios: { sound: 'default' },
    });
  } catch (error) {
    // No notification permission, for example. The job is accepted and on
    // home either way.
    console.log('Auto accept notice could not be shown', error);
  }
};
