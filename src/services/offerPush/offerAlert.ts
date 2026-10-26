// The offer alert itself (row 58, spec 0003, AC-3, AC-7, AC-12): a notifee
// notification the phone builds from the push message's own data.
//
// One alert per offer: its id is the delivery id, so a repeat (the server's
// 2 minute re send) replaces it rather than adding a second one, and
// `OFFER_ENDED` or an answer cancels it by the same id. Cancelling the
// notification also stops its sound.

import notifee, {
  AndroidImportance,
  AndroidVisibility,
  // `type` imports only the TypeScript description, no code.
  type Notification,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import i18next from 'i18next';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import {
  OfferAlertData,
  StoredOfferAlert,
  toNotificationData,
} from './offerMessage';

// Android fixes a channel's sound and vibration when the channel is first
// made, so the two kinds of ring need two channels. Both use the co-op's
// offer ring (`android/app/src/main/res/raw/offer_ring.wav`). Changing that
// sound for phones that already made these channels needs new ids here.
export const OFFERS_CHANNEL_ID = 'offers';
export const OFFERS_INSISTENT_CHANNEL_ID = 'offers-insistent';
// Short, silent notices ("This offer has ended") after a lock screen answer.
const NOTICES_CHANNEL_ID = 'offer-notices';

const OFFER_SOUND = 'offer_ring';
// The insistent ring vibrates longer (AC-7): buzz 800 ms, pause 300 ms, three
// times, then a pause. notifee wants an even count of numbers, none zero.
const INSISTENT_VIBRATION = [300, 800, 300, 800, 300, 800, 300, 1500];

// The alert stops by itself this long after the deadline, in case the
// `OFFER_ENDED` push is lost (the server ends the offer 3 s after it).
export const ALERT_GRACE_AFTER_DEADLINE_MS = 5000;

// The offer screen the alert opens: its own activity, the only one allowed
// over the lock screen (`OfferAlertActivity.kt`).
const OFFER_SCREEN_ACTIVITY = 'com.opendeli.OfferAlertActivity';

export const OPEN_OFFER_ACTION = 'open-offer';
export const ACCEPT_ACTION = 'accept';
export const DECLINE_ACTION = 'decline';

// Creating a channel that exists already changes nothing, so this runs before
// every alert, including in the background with no app open.
export const ensureOfferChannels = async () => {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: OFFERS_CHANNEL_ID,
    name: i18next.t('translations:offer_alert_channel'),
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: OFFER_SOUND,
    vibration: true,
  });
  await notifee.createChannel({
    id: OFFERS_INSISTENT_CHANNEL_ID,
    name: i18next.t('translations:offer_alert_channel_insistent'),
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: OFFER_SOUND,
    vibration: true,
    vibrationPattern: INSISTENT_VIBRATION,
  });
  await notifee.createChannel({
    id: NOTICES_CHANNEL_ID,
    name: i18next.t('translations:offer_alert_channel_notices'),
    importance: AndroidImportance.HIGH,
    vibration: false,
  });
};

// "€4.50"; the same formatting as the offer card.
export const payText = (offer: { payTotal: number; currencyCode: string }) =>
  formatCurrencyFromCents(offer.payTotal, offer.currencyCode || undefined);

// "Pizza Roma to Iasonos · 2.4 km · 12 min", leaving out what is unknown.
export const offerSummary = (
  offer: Pick<
    OfferAlertData,
    'restaurantName' | 'dropoffArea' | 'distanceKm' | 'minutes'
  >,
): string => {
  const parts = [
    offer.dropoffArea !== ''
      ? i18next.t('translations:offer_alert_body_area', {
          restaurant: offer.restaurantName,
          area: offer.dropoffArea,
        })
      : offer.restaurantName,
  ];
  if (offer.distanceKm !== '') {
    parts.push(
      i18next.t('translations:offer_alert_distance', { km: offer.distanceKm }),
    );
  }
  if (offer.minutes !== '') {
    parts.push(
      i18next.t('translations:offer_alert_minutes', { minutes: offer.minutes }),
    );
  }
  return parts.filter(part => part !== '').join(' · ');
};

export type AlertStyle = 'full-screen' | 'heads-up';

// Posts (or replaces) the alert for one offer. `receivedAt` is when the push
// arrived, on this phone's clock: the deadline is that plus the time the
// server said was left, so a wrong phone clock changes nothing (spec 0002).
// `style`: full screen on a locked or backgrounded phone, if the rider allowed
// it (Android falls back to heads up by itself when not); heads up when the
// app is open on another screen (AC-12).
export const showOfferAlert = async (
  offer: OfferAlertData,
  receivedAt: number,
  style: AlertStyle,
): Promise<void> => {
  const deadlineAt =
    offer.msLeftAtSend === null ? null : receivedAt + offer.msLeftAtSend;
  const stopAfterMs =
    deadlineAt === null
      ? null
      : deadlineAt + ALERT_GRACE_AFTER_DEADLINE_MS - Date.now();
  if (stopAfterMs !== null && stopAfterMs <= 0) {
    // Already over: the server has ended it, or is about to.
    return;
  }

  await ensureOfferChannels();
  const openOffer = {
    id: OPEN_OFFER_ACTION,
    launchActivity: OFFER_SCREEN_ACTIVITY,
  };
  const notification: Notification = {
    id: offer.deliveryId,
    title: i18next.t('translations:offer_alert_title', {
      pay: payText(offer),
    }),
    body: offerSummary(offer),
    data: toNotificationData(offer, deadlineAt),
    android: {
      channelId: offer.insistent
        ? OFFERS_INSISTENT_CHANNEL_ID
        : OFFERS_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      // PUBLIC, or the lock screen hides the text and the buttons. Only the
      // offer card's facts are in it (AC-10).
      visibility: AndroidVisibility.PUBLIC,
      // Rings again and again until it is cancelled (AC-3) ...
      loopSound: true,
      // ... and cannot be swiped away: it ends by an answer or by the offer
      // ending.
      ongoing: true,
      autoCancel: false,
      lightUpScreen: true,
      pressAction: openOffer,
      fullScreenAction: style === 'full-screen' ? openOffer : undefined,
      // No `launchActivity` on the buttons: they answer in the background
      // without opening the app (AC-5).
      actions: [
        {
          title: i18next.t('translations:accept'),
          pressAction: { id: ACCEPT_ACTION },
        },
        {
          title: i18next.t('translations:decline'),
          pressAction: { id: DECLINE_ACTION },
        },
      ],
      // A countdown to the deadline, drawn by Android itself, when there is one.
      ...(deadlineAt !== null && stopAfterMs !== null
        ? {
            showChronometer: true,
            chronometerDirection: 'down' as const,
            timestamp: deadlineAt,
            // The local stop (AC-6): Android removes the alert, and its sound,
            // even if the phone is asleep and the app is not running.
            timeoutAfter: stopAfterMs,
          }
        : {}),
    },
  };
  await notifee.displayNotification(notification);
};

export const cancelOfferAlert = async (deliveryId: string): Promise<void> => {
  try {
    await notifee.cancelNotification(deliveryId);
  } catch (error) {
    console.log('Offer alert could not be cancelled', error);
  }
};

// The offer alerts on display now, read back from Android with their data.
export const displayedOfferAlerts = async (): Promise<
  { notificationId: string; data: Notification['data'] }[]
> => {
  try {
    const displayed = await notifee.getDisplayedNotifications();
    return displayed
      .filter(
        item =>
          item.notification.android?.channelId === OFFERS_CHANNEL_ID ||
          item.notification.android?.channelId === OFFERS_INSISTENT_CHANNEL_ID,
      )
      .map(item => ({
        notificationId: item.id ?? item.notification.id ?? '',
        data: item.notification.data,
      }));
  } catch {
    return [];
  }
};

// Logging out: no offer may keep ringing on a phone nobody is logged in on.
export const cancelAllOfferAlerts = async (): Promise<void> => {
  const alerts = await displayedOfferAlerts();
  await Promise.all(
    alerts.map(alert => cancelOfferAlert(alert.notificationId)),
  );
};

// A short notice after an answer from the lock screen did not go through.
export const showOfferNotice = async (
  offer: Pick<StoredOfferAlert, 'deliveryId'>,
  text: string,
): Promise<void> => {
  try {
    await ensureOfferChannels();
    await notifee.displayNotification({
      id: `offer-notice-${offer.deliveryId}`,
      title: text,
      android: {
        channelId: NOTICES_CHANNEL_ID,
        visibility: AndroidVisibility.PUBLIC,
        timeoutAfter: 15000,
        pressAction: { id: 'default' },
      },
    });
  } catch (error) {
    console.log('Offer notice could not be shown', error);
  }
};
