import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import i18next from 'i18next';
// `type` brings in only the TypeScript description, no code.
import type { QueryClient } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';
import { notificationText } from '@app/utilities/notificationText';
import {
  parseRemovalDecision,
  RemovalDecision,
  removalNoticeText,
  removalNoticeTitle,
} from '@app/utilities/removalRequest';

// Spec 0035 (AC-11): dispatch answered a removal request. The rider gets a notice on Home that stays
// until tapped, and a system notification for when the app is not in front.
//
// The notices live in memory only: the spec keeps the amount in the rider's earnings after a restart,
// and a refusal stays on the job. Riders never see a list or a count of their requests.

export const REMOVAL_CHANNEL_ID = 'removal-decided';

const NOTIFICATION_ID_PREFIX = 'removal-';
const notificationId = (deliveryId: string): string =>
  `${NOTIFICATION_ID_PREFIX}${deliveryId}`;

const ensureChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: REMOVAL_CHANNEL_ID,
    name: i18next.t('translations:removal_channel'),
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    // The phone's own sound: a channel with none is silent.
    sound: 'default',
  });
};

// --- The notices on Home --------------------------------------------------

let notices: RemovalDecision[] = [];
const listeners = new Set<() => void>();

const setNotices = (next: RemovalDecision[]) => {
  notices = next;
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getNotices = (): RemovalDecision[] => notices;

export const useRemovalNotices = (): RemovalDecision[] =>
  useSyncExternalStore(subscribe, getNotices);

// The rider tapped the notice.
export const dismissRemovalNotice = (deliveryId: string): void => {
  setNotices(notices.filter(notice => notice.deliveryId !== deliveryId));
  notifee
    .cancelNotification(notificationId(deliveryId))
    .catch(error => console.log('Could not clear the removal notice', error));
};

// --- Receiving a decision -------------------------------------------------

// The last decision shown for each delivery. The backend sends each one over the live connection and
// by push, so the same decision can arrive twice; it is shown once.
const lastShown = new Map<string, string>();

const decisionKey = (decision: RemovalDecision): string =>
  `${decision.outcome}|${decision.decisionNote ?? ''}|${
    decision.payAmount ?? ''
  }`;

// The rider asked again: the next answer is a new one, even if dispatch words it the same.
export const forgetRemovalDecision = (deliveryId: string): void => {
  lastShown.delete(deliveryId);
};

// One notice per delivery: a later answer replaces the earlier one.
export const showRemovalDecision = async (
  decision: RemovalDecision,
): Promise<void> => {
  const key = decisionKey(decision);
  if (lastShown.get(decision.deliveryId) === key) {
    return;
  }
  // Marked before the first await: the live message and the push can arrive together.
  lastShown.set(decision.deliveryId, key);
  setNotices([
    ...notices.filter(notice => notice.deliveryId !== decision.deliveryId),
    decision,
  ]);
  await ensureChannel();
  const t = i18next.t.bind(i18next);
  await notifee.displayNotification({
    id: notificationId(decision.deliveryId),
    title: removalNoticeTitle(decision, t),
    // Android reads the body as HTML, and dispatch's sentence comes from outside the app (row 105).
    body: notificationText(removalNoticeText(decision, t)),
    android: {
      channelId: REMOVAL_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
    },
    ios: { sound: 'default' },
  });
};

// A message from the live connection or a push: refetch whatever the answer changed, then show it.
// The refetch goes first, so a notice that cannot be posted never stops it.
export const receiveRemovalDecision = async (
  message: unknown,
  queryClient: QueryClient,
): Promise<void> => {
  const decision = parseRemovalDecision(message);
  if (!decision) {
    return;
  }
  [
    QueryKeys.inProgressOrders,
    QueryKeys.newOrders,
    QueryKeys.cancelledJobs,
    QueryKeys.earningsMonth,
    QueryKeys.earningsDelivery,
  ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
  await showRemovalDecision(decision);
};

// Asks the phone what is really in the shade, because those can outlive the app being closed.
const cancelShownNotifications = async (): Promise<void> => {
  try {
    const shown = await notifee.getDisplayedNotifications();
    await Promise.all(
      shown
        .filter(item => item.id?.startsWith(NOTIFICATION_ID_PREFIX))
        .map(item => notifee.cancelNotification(item.id as string)),
    );
  } catch (error) {
    console.log(
      'Could not clear the removal notifications',
      (error as Error)?.message,
    );
  }
};

// At logout: the next rider on this phone never sees these.
export const clearRemovalNotices = (): void => {
  lastShown.clear();
  setNotices([]);
  cancelShownNotifications();
};
