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
import { SplitBoxSize } from '@app/types/types';

// Spec 0047 (cross check 12), row 11 review: dispatch answered a split request. The rider is told the way
// a removal answer reaches them (spec 0035): the job list is read again (the card shows the answer) and a
// system notification with the phone's sound says it, for when the app is not in front. The same answer
// comes over the live connection and by push; it is shown once.

export const SPLIT_CHANNEL_ID = 'split-decided';

const NOTIFICATION_ID_PREFIX = 'split-';
const notificationId = (deliveryId: string): string =>
  `${NOTIFICATION_ID_PREFIX}${deliveryId}`;

const SIZES: SplitBoxSize[] = ['SMALL', 'MEDIUM', 'LARGE'];

export type SplitDecision = {
  deliveryId: string;
  outcome: 'CONFIRMED' | 'REFUSED';
  adminNote: string | null;
  boxSize: SplitBoxSize | null;
};

// The live connection sends an object, a push sends strings ('' for none): both read the same.
export const parseSplitDecision = (message: unknown): SplitDecision | null => {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const data = message as Record<string, unknown>;
  const deliveryId = data.deliveryId;
  const outcome = data.outcome;
  if (typeof deliveryId !== 'string' || !deliveryId) {
    return null;
  }
  if (outcome !== 'CONFIRMED' && outcome !== 'REFUSED') {
    return null;
  }
  const note =
    typeof data.adminNote === 'string' && data.adminNote.trim()
      ? data.adminNote.trim()
      : null;
  const size = SIZES.find(value => value === data.boxSize) ?? null;
  return { deliveryId, outcome, adminNote: note, boxSize: size };
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const splitNoticeTitle = (decision: SplitDecision, t: Translate) =>
  t(
    decision.outcome === 'CONFIRMED'
      ? 'translations:split_notice_title_confirmed'
      : 'translations:split_refused_title',
  );

export const splitNoticeText = (
  decision: SplitDecision,
  t: Translate,
): string => {
  if (decision.outcome === 'REFUSED') {
    return decision.adminNote
      ? t('translations:split_refused_with_note', { note: decision.adminNote })
      : t('translations:split_refused');
  }
  return decision.boxSize
    ? t('translations:split_confirmed_size', {
        size: t(`translations:split_size_${decision.boxSize}`),
      })
    : t('translations:split_confirmed');
};

const ensureChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: SPLIT_CHANNEL_ID,
    name: i18next.t('translations:split_channel'),
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    // The phone's own sound: a channel with none is silent.
    sound: 'default',
  });
};

// The last answer shown per delivery, so the live message and the push show it once.
const lastShown = new Map<string, string>();

export const showSplitDecision = async (
  decision: SplitDecision,
): Promise<void> => {
  const key = `${decision.outcome}|${decision.adminNote ?? ''}|${
    decision.boxSize ?? ''
  }`;
  if (lastShown.get(decision.deliveryId) === key) {
    return;
  }
  // Marked before the first await: the live message and the push can arrive together.
  lastShown.set(decision.deliveryId, key);
  await ensureChannel();
  const t = i18next.t.bind(i18next) as Translate;
  await notifee.displayNotification({
    id: notificationId(decision.deliveryId),
    title: splitNoticeTitle(decision, t),
    // Android reads the body as HTML, and dispatch's sentence comes from outside the app (row 105).
    body: notificationText(splitNoticeText(decision, t)),
    android: {
      channelId: SPLIT_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
    },
    ios: { sound: 'default' },
  });
};

// The rider flagged again: the next answer is a new one, even if worded the same.
export const forgetSplitDecision = (deliveryId: string): void => {
  lastShown.delete(deliveryId);
};

// A message from the live connection or a push: refetch what the answer changed, then show it. The
// refetch goes first, so a notice that cannot be posted never stops it.
export const receiveSplitDecision = async (
  message: unknown,
  queryClient: QueryClient,
): Promise<void> => {
  const decision = parseSplitDecision(message);
  if (!decision) {
    return;
  }
  [
    QueryKeys.inProgressOrders,
    QueryKeys.earningsMonth,
    QueryKeys.earningsDelivery,
  ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
  await showSplitDecision(decision);
};

// At logout and session end: the next rider on this phone never sees these.
export const clearSplitNotices = (): void => {
  lastShown.clear();
  notifee
    .getDisplayedNotifications()
    .then(shown =>
      Promise.all(
        shown
          .filter(item => item.id?.startsWith(NOTIFICATION_ID_PREFIX))
          .map(item => notifee.cancelNotification(item.id as string)),
      ),
    )
    .catch(error =>
      console.log(
        'Could not clear the split notifications',
        (error as Error)?.message,
      ),
    );
};
