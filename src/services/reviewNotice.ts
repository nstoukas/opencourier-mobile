import notifee from '@notifee/react-native';
import i18next from 'i18next';
import { notificationText } from '@app/utilities/notificationText';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import { User, UserStatus } from '@app/types/types';
import { navigationRef } from '@app/navigation/navigationRef';
import { MainScreens } from '@app/navigation/main/types';
import { RootScreen } from '@app/navigation/types';
import { MESSAGES_CHANNEL_ID, ensureChannel } from './chat/chatNotice';

// Spec 0038 (AC-9): a person answered one of the rider's review requests. The push carries only the
// request id, never the answer; the phone draws a fixed line on chat's quiet channel (no offer sound).
// One notification id, so several answers show as one line.
export const REVIEW_NOTIFICATION_ID = 'review-answer';
export const REVIEW_ANSWERED_TYPE = 'REVIEW_ANSWERED';

export async function showReviewAnswerNotice(): Promise<void> {
  await ensureChannel();
  await notifee.displayNotification({
    id: REVIEW_NOTIFICATION_ID,
    title: notificationText(i18next.t('translations:review_notice_title')),
    data: { type: REVIEW_ANSWERED_TYPE },
    android: {
      channelId: MESSAGES_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
}

// The push arrived. The server sends none to an Offline rider; the phone also stays quiet if the
// status it last loaded is Offline (a push can arrive late), as chat does. The answer is always on the
// page whatever happens here, so the list is refetched either way.
export async function receiveReviewAnswer(): Promise<void> {
  queryClient.invalidateQueries({ queryKey: [QueryKeys.reviewRequests] });
  const user = queryClient.getQueryData<User>([QueryKeys.user]);
  if (user?.status === UserStatus.Offline) {
    return;
  }
  await showReviewAnswerNotice();
}

// Logout: the next rider on this phone never sees the last one's notice.
export function clearReviewNotice(): void {
  notifee
    .cancelNotification(REVIEW_NOTIFICATION_ID)
    .catch(error => console.log('Could not clear the review notice', error));
}

// --- Opening the page from the notice ---------------------------------------

let openWhenReady = false;
let stopWaiting: (() => void) | null = null;

// Opens "How offers and pay work", where the rider's requests are, once the rider's screens exist.
const openNow = (): boolean => {
  if (
    !navigationRef.isReady() ||
    !navigationRef.getRootState()?.routes.some(r => r.name === RootScreen.Main)
  ) {
    return false;
  }
  // The ref is not typed with the app's screens, so `as never` lets this call name a screen (as in chatNotice.ts).
  navigationRef.navigate(
    RootScreen.Main as never,
    { screen: MainScreens.HowItWorks } as never,
  );
  return true;
};

export function openReviewsFromNotice(): void {
  if (openNow()) {
    return;
  }
  openWhenReady = true;
  if (stopWaiting === null) {
    stopWaiting = navigationRef.addListener('state', () => {
      if (openWhenReady && openNow()) {
        openWhenReady = false;
        stopWaiting?.();
        stopWaiting = null;
      }
    });
  }
}
