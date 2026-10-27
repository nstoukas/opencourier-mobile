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

// The two modes that track; `off` never shows the sign.
export type TrackingOnMode = TrackingMode.Waiting | TrackingMode.Job;

// The mode the sign shows now, or null while it is stopped. Kept here so the
// notification event handler, which has no screen state, can put the sign back.
let shownMode: TrackingOnMode | null = null;

// Shows the sign and starts the service, or updates the text if it already
// runs. Rejects when Android refuses to start it (the app is not in front);
// the caller tries again when the app returns.
export const showOnlineService = async (
  mode: TrackingOnMode,
): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }
  // Creating a channel that exists already changes nothing, so this is safe
  // every time. LOW: no sound and no pop up, it is a standing sign.
  await notifee.createChannel({
    id: ONLINE_CHANNEL_ID,
    name: i18next.t('translations:online_service_channel'),
    importance: AndroidImportance.LOW,
  });
  const onJob = mode === TrackingMode.Job;
  await notifee.displayNotification({
    id: ONLINE_NOTIFICATION_ID,
    title: i18next.t(
      onJob
        ? 'translations:online_service_title_job'
        : 'translations:online_service_title_waiting',
    ),
    body: i18next.t(
      onJob
        ? 'translations:online_service_body_job'
        : 'translations:online_service_body_waiting',
    ),
    android: {
      channelId: ONLINE_CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      // A tap opens the app.
      pressAction: { id: 'default' },
    },
  });
  shownMode = mode;
};

// Stops the service, which also removes the sign. Safe when nothing runs.
export const stopOnlineService = async (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }
  shownMode = null;
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
  await showOnlineService(shownMode);
};
