// The "OpenCourier is online" sign on Android (row 68, spec 0008).
//
// Android keeps sending a "while in use" app its location in the background
// only inside a foreground service: a task that must show a notification the
// whole time it runs. notifee (the notification library the app already uses
// for offer alerts) runs that service while this notification is displayed
// with `asForegroundService`. The manifest gives the service its `location`
// type. So the sign and the background location are the same thing: one shows
// exactly while the other runs, which is what binding value 5 asks.

import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';
import i18next from 'i18next';
import { TrackingMode } from '@app/utilities/locationTracking';

export const ONLINE_CHANNEL_ID = 'online';
// One notification, updated in place: a second id would never show while the
// service runs.
export const ONLINE_NOTIFICATION_ID = 'online-status';

// The modes that track; `off` never shows the sign.
export type TrackingOnMode =
  | TrackingMode.Waiting
  | TrackingMode.Job
  | TrackingMode.Sos;

// The sign's words for each mode. During an SOS it says the position is
// shared with the co-op (spec 0022, AC-5), whatever the rider's status.
const SIGN_TEXT: Record<TrackingOnMode, { title: string; body: string }> = {
  [TrackingMode.Waiting]: {
    title: 'translations:online_service_title_waiting',
    body: 'translations:online_service_body_waiting',
  },
  [TrackingMode.Job]: {
    title: 'translations:online_service_title_job',
    body: 'translations:online_service_body_job',
  },
  [TrackingMode.Sos]: {
    title: 'translations:online_service_title_sos',
    body: 'translations:online_service_body_sos',
  },
};

// The mode the sign shows now, or null while it is stopped. Kept here so the
// notification event handler, which has no screen state, can put the sign back.
let shownMode: TrackingOnMode | null = null;
// Counts the stops. A show that sees the count change while it waits on
// Android gives up instead of displaying: displaying would start the service
// again after it was stopped, and the sign would stay with tracking off.
let stops = 0;

// Shows the sign and starts the service, or updates the text if it already
// runs. Resolves true when shown, false when a stop came first (nothing shown).
// Rejects when Android refuses to start it (the app is not in front); the
// caller tries again when the app returns.
export const showOnlineService = async (
  mode: TrackingOnMode,
): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }
  const stopsAtStart = stops;
  // Creating a channel that exists already changes nothing, so this is safe
  // every time. LOW: no sound and no pop up, it is a standing sign.
  await notifee.createChannel({
    id: ONLINE_CHANNEL_ID,
    name: i18next.t('translations:online_service_channel'),
    importance: AndroidImportance.LOW,
  });
  if (stops !== stopsAtStart) {
    return false;
  }
  await notifee.displayNotification({
    id: ONLINE_NOTIFICATION_ID,
    title: i18next.t(SIGN_TEXT[mode].title),
    body: i18next.t(SIGN_TEXT[mode].body),
    android: {
      channelId: ONLINE_CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      // A tap opens the app.
      pressAction: { id: 'default' },
    },
  });
  // A stop that arrived while Android was displaying: undo the start at once.
  if (stops !== stopsAtStart) {
    await notifee.stopForegroundService();
    return false;
  }
  shownMode = mode;
  return true;
};

// Stops the service, which also removes the sign. Safe when nothing runs.
export const stopOnlineService = async (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }
  shownMode = null;
  stops += 1;
  await notifee.stopForegroundService();
};

// Android 14 and later let a rider swipe even a foreground service's
// notification away, while the service and the location sharing go on. The
// sign must stay while location is shared (value 5, spec 0008 AC-3), so a
// swiped sign is shown again at once. Called from the notifee event handler.
export const onOnlineSignDismissed = async (
  notificationId: string | undefined,
): Promise<void> => {
  if (notificationId !== ONLINE_NOTIFICATION_ID || shownMode === null) {
    return;
  }
  console.log('The online sign was swiped away; showing it again');
  try {
    await showOnlineService(shownMode);
  } catch (error) {
    // Android refused (the app is not in front); the sign returns with the
    // next start, when the app comes back.
    console.log('Could not show the online sign again', error);
  }
};
