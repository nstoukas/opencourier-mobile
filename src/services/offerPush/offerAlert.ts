// The offer alert itself (row 58, spec 0003, AC-3, AC-7, AC-12): a notifee
// notification the phone builds from the push message's own data.
//
// One alert per offer: its id is the delivery id, so a repeat (the server's
// 2 minute re send) replaces it rather than adding a second one, and
// `OFFER_ENDED` or an answer cancels it by the same id. Cancelling the
// notification also stops its sound.

import notifee, {
  AndroidImportance,
  AndroidStyle,
  AndroidVisibility,
  // `type` imports only the TypeScript description, no code.
  type Notification,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import i18next from 'i18next';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { offerTripLines } from '@app/utilities/offerTrip';
import { escapeHtml } from '@app/utilities/escapeHtml';
import { legLine } from '@app/utilities/legs';
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
// Row 81 (cross check 2): an add on offered while the rider carries food. Its
// own channel because Android fixes a channel's sound and vibration when it is
// first made: the default sound once, one short buzz, never the offer ring.
export const OFFERS_CALM_CHANNEL_ID = 'offers-calm';
// Short, silent notices ("This offer has ended") after a lock screen answer.
const NOTICES_CHANNEL_ID = 'offer-notices';

const OFFER_SOUND = 'offer_ring';
// The insistent ring vibrates longer (AC-7): buzz 800 ms, pause 300 ms, three
// times, then a pause. notifee wants an even count of numbers, none zero.
const INSISTENT_VIBRATION = [300, 800, 300, 800, 300, 800, 300, 1500];
// Row 81: one short buzz for a calm add on (an even number of values, none 0).
const CALM_VIBRATION = [200, 300];

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
    id: OFFERS_CALM_CHANNEL_ID,
    name: i18next.t('translations:offer_alert_channel_calm'),
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    vibration: true,
    vibrationPattern: CALM_VIBRATION,
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

// What the alert's lines are made from. The leg fields are optional in
// OfferAlertData, so they stay optional here.
type AlertLineSource = Pick<
  OfferAlertData,
  'restaurantName' | 'dropoffArea' | 'trip' | 'legNumber' | 'legCount'
>;

// The alert's lines, in the offer card's order and words (row 100, spec 0019's
// AC-3): "1.2 km to the restaurant · 2.9 km to the customer", "About 9 min",
// "Leg 1 of 2" for one leg of a bigger order (spec 0046, AC-7; agy's review of
// row 10), then "Pizza Roma to Iasonos". A line with nothing to say is ''.
export const offerAlertLines = (
  offer: AlertLineSource,
): { distances: string; minutes: string; leg: string; place: string } => {
  // `i18next.t` read through a looser type, the one offerTripLines takes.
  const t = i18next.t.bind(i18next) as (
    key: string,
    options?: Record<string, unknown>,
  ) => string;
  const trip = offerTripLines(offer.trip, t);
  return {
    distances: trip.distances,
    minutes: trip.minutes,
    leg: legLine(offer, t),
    place:
      offer.dropoffArea !== ''
        ? i18next.t('translations:offer_alert_body_area', {
            restaurant: offer.restaurantName,
            area: offer.dropoffArea,
          })
        : offer.restaurantName,
  };
};

// The alert's lines that have something in them, in the card's order. The
// notification and the full screen both read this one list, so their order
// can never drift apart (row 100 review).
export const offerAlertLineList = (offer: AlertLineSource): string[] => {
  const lines = offerAlertLines(offer);
  return [lines.distances, lines.minutes, lines.leg, lines.place].filter(
    line => line !== '',
  );
};

// The notification's one line body: the alert's lines joined, e.g. "1.2 km
// to the restaurant · 2.9 km to the customer · About 9 min · Pizza Roma to
// Iasonos". A collapsed notification cuts it short, so the expanded alert
// shows the same lines one per row (`BIGTEXT` in showOfferAlert).
export const offerSummary = (offer: AlertLineSource): string =>
  offerAlertLineList(offer).join(' · ');

// On Android notifee reads the body and a BIGTEXT style's text as HTML: a
// line break must be <br> (a '\n' shows as a space), and a restaurant's name
// must not be able to add markup ("<b>" was swallowed on the emulator), so
// &, < and > are written as entities.

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
  // Spec 0048 (cross check 11, AC-8): two orders offered together. The push
  // carries only the first order's figures, so the alert names no pay and has
  // no Accept or Decline: a tap opens the app, whose home card shows both
  // orders and their stops. Taking two orders blind from a lock screen would
  // be as unchecked as the phone taking them by itself.
  const isStack = !!offer.partnerDeliveryId;
  // Row 81: an add on is answered in the app too, where its card shows what it
  // adds to the job and the stops (the push carries neither); the alert says
  // to open it once stopped. While the rider carries food it is calm: its own
  // quiet channel, no looping ring, never full screen (cross check 2).
  const isAddOn = !!offer.addOn;
  const calm = isAddOn && !!offer.calm;
  const opensApp = isStack || isAddOn;
  const openOffer = opensApp
    ? { id: 'default', launchActivity: 'default' }
    : {
        id: OPEN_OFFER_ACTION,
        launchActivity: OFFER_SCREEN_ACTIVITY,
      };
  const lines = isStack
    ? [i18next.t('translations:stack_offer_alert_body')]
    : isAddOn
    ? [i18next.t('translations:add_on_offer_alert_body')]
    : offerAlertLineList(offer);
  const summary = opensApp ? lines.join(' · ') : offerSummary(offer);
  const notification: Notification = {
    id: offer.deliveryId,
    title: isStack
      ? i18next.t('translations:stack_offer_alert_title')
      : isAddOn
      ? i18next.t('translations:add_on_offer_alert_title', {
          pay: payText(offer),
        })
      : i18next.t('translations:offer_alert_title', {
          pay: payText(offer),
        }),
    // Android reads the body as HTML too, so it is escaped there; iOS shows it
    // as plain text, where an entity would show as typed.
    body: Platform.OS === 'android' ? escapeHtml(summary) : summary,
    data: toNotificationData(offer, deadlineAt),
    android: {
      channelId: calm
        ? OFFERS_CALM_CHANNEL_ID
        : offer.insistent
        ? OFFERS_INSISTENT_CHANNEL_ID
        : OFFERS_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      // Expanded, every line shows on its own row; collapsed, Android cuts
      // the one line body after about the second km (row 100 review).
      style: {
        type: AndroidStyle.BIGTEXT,
        text: lines.map(escapeHtml).join('<br>'),
      },
      // PUBLIC, or the lock screen hides the text and the buttons. Only the
      // offer card's facts are in it (AC-10).
      visibility: AndroidVisibility.PUBLIC,
      // Rings again and again until it is cancelled (AC-3) ...
      loopSound: !calm,
      // ... and cannot be swiped away: it ends by an answer or by the offer
      // ending.
      ongoing: true,
      autoCancel: false,
      lightUpScreen: !calm,
      pressAction: openOffer,
      fullScreenAction:
        style === 'full-screen' && !calm ? openOffer : undefined,
      // No `launchActivity` on the buttons: they answer in the background
      // without opening the app (AC-5).
      actions: opensApp
        ? []
        : [
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
      // `...(test ? { fields } : {})` adds the fields only when the test holds.
      ...(deadlineAt !== null && stopAfterMs !== null
        ? {
            showChronometer: true,
            // `as const` keeps the type 'down' rather than any string, which
            // is what notifee's type asks for.
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
    console.log('Offer alert could not be cancelled', String(error));
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
    console.log('Offer notice could not be shown', String(error));
  }
};

// True while this offer's alert is on display (its ring is going).
export const isOfferAlertDisplayed = async (
  deliveryId: string,
): Promise<boolean> =>
  (await displayedOfferAlerts()).some(
    alert => alert.notificationId === deliveryId,
  );
