// Alerts the rider again about an offer that is still waiting (spec 0002, AC-4).
//
// Used only when Offer expiry is off: the offer then has no deadline and keeps
// ringing until the rider answers it or it leaves. Every 30 s the phone plays
// a sound and vibrates; after 2 min the vibration gets longer. Row 58 later
// moves this into push alerts that work when the app is closed.
//
// This only alerts. It never answers the offer, and it records nothing about
// the rider: an offer that waits is never counted against anyone (value 5).

import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform, Vibration } from 'react-native';
import i18next from 'i18next';
import { OFFER_REMINDER_LONGER_AFTER_MS } from '@app/utilities/constants';

// Its own Android channel, so these reminders keep a sound even if the rider
// changes the settings of the push channel. Android fixes a channel's sound
// when the channel is first made; vibration is left to the code below.
const REMINDER_CHANNEL_ID = 'offer_reminders';

// Vibration patterns: wait, buzz, pause, buzz... in milliseconds (Android).
// iOS ignores the pattern and always buzzes once.
const SHORT_VIBRATION = [0, 400];
const LONG_VIBRATION = [0, 800, 300, 800, 300, 800];

// The notification disappears on its own before the next reminder, so
// reminders never pile up in the tray.
const REMINDER_SHOWN_FOR_MS = 25000;

const ensureChannel = async () => {
  if (Platform.OS === 'android') {
    // Creating a channel that exists already changes nothing, so this is safe
    // to call before every reminder.
    await notifee.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'Offer reminders',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: false,
    });
  }
};

// The same id for every reminder of one offer, so a new reminder replaces the
// last one and `cancelOfferReminder` can find it.
const reminderNotificationId = (offerId: string): string =>
  `offer-reminder-${offerId}`;

// The same words the offer card shows: "Waiting 3 min", or "Waiting less
// than 1 min" in the first minute (the 30 s reminder), never "Waiting 0 min".
const waitingText = (waitedMs: number): string => {
  const minutes = Math.floor(waitedMs / 60000);
  return minutes < 1
    ? i18next.t('translations:offer_waiting_just_now')
    : i18next.t('translations:offer_waiting_minutes', { minutes });
};

// `waitedMs`: how long the offer has waited since the server made it.
export const remindRiderOfOffer = async (
  offerId: string,
  waitedMs: number,
): Promise<void> => {
  const longer = waitedMs >= OFFER_REMINDER_LONGER_AFTER_MS;
  Vibration.vibrate(longer ? LONG_VIBRATION : SHORT_VIBRATION);

  try {
    await ensureChannel();
    await notifee.displayNotification({
      // One notification per offer: a new reminder replaces the last one.
      id: reminderNotificationId(offerId),
      title: i18next.t('translations:offer_reminder_title'),
      body: waitingText(waitedMs),
      android: {
        channelId: REMINDER_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        timeoutAfter: REMINDER_SHOWN_FOR_MS,
        pressAction: { id: 'default' },
      },
      ios: { sound: 'default' },
    });
  } catch (error) {
    // No notification permission, for example. The vibration above still
    // happened, and the offer is still on screen, so nothing else is needed.
    console.log('Offer reminder could not show a notification', error);
  }
};

// The offer left (answered, ended by the server, or gone from the list): take
// its reminder out of the tray, so the rider never taps a dead offer.
export const cancelOfferReminder = async (offerId: string): Promise<void> => {
  try {
    await notifee.cancelNotification(reminderNotificationId(offerId));
  } catch (error) {
    // Nothing to cancel, or notifications are off: nothing else to do.
    console.log('Offer reminder could not be cancelled', error);
  }
};
