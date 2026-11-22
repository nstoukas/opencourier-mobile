import notifee from '@notifee/react-native';
import i18next from 'i18next';
import { notificationText } from '@app/utilities/notificationText';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import { navigationRef } from '@app/navigation/navigationRef';
import { MainScreens } from '@app/navigation/main/types';
import { DrawerScreens } from '@app/navigation/drawer/types';
import { RootScreen } from '@app/navigation/types';
import { MESSAGES_CHANNEL_ID, ensureChannel } from './chat/chatNotice';

// Spec 0052 (AC-4): a complaint about this rider needs their reply. The push carries only the complaint
// id, never the words (nothing anyone wrote passes through Google); the phone draws a fixed line on
// chat's quiet channel (no offer sound). Unlike chat, it is shown whether the rider is Online or not:
// replying is not work, and the rider's say comes before any decision. One notification id, so several
// complaints show as one line.
export const COMPLAINT_NOTIFICATION_ID = 'complaint-needs-reply';
export const COMPLAINT_NEEDS_REPLY_TYPE = 'COMPLAINT_NEEDS_REPLY';

export async function showComplaintNotice(): Promise<void> {
  await ensureChannel();
  await notifee.displayNotification({
    id: COMPLAINT_NOTIFICATION_ID,
    title: notificationText(i18next.t('translations:complaint_notice_title')),
    data: { type: COMPLAINT_NEEDS_REPLY_TYPE },
    android: {
      channelId: MESSAGES_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
}

// The push arrived: the list is read again (so an open Complaints screen shows the new card) and the
// notice is drawn.
export async function receiveComplaintNeedsReply(): Promise<void> {
  queryClient.invalidateQueries({ queryKey: [QueryKeys.complaints] });
  await showComplaintNotice();
}

// Logout, and the Complaints screen coming into view: the notice has nothing more to say.
export function clearComplaintNotice(): void {
  forgetOpen();
  notifee
    .cancelNotification(COMPLAINT_NOTIFICATION_ID)
    .catch(error => console.log('Could not clear the complaint notice', error));
}

// --- Opening Complaints from the notice -------------------------------------

// A tap that came before the rider's screens exist (the app was closed): Complaints opens once they do.
let openWhenReady = false;
let stopWaiting: (() => void) | null = null;

// Opens the Complaints screen (a drawer screen, inside the Main stack) once the rider's screens exist.
const openNow = (): boolean => {
  if (
    !navigationRef.isReady() ||
    !navigationRef.getRootState()?.routes.some(r => r.name === RootScreen.Main)
  ) {
    return false;
  }
  // The ref is not typed with the app's screens, so `as never` lets this call name a screen (as in
  // chatNotice.ts). The nested params open Complaints inside the drawer, inside the Main stack.
  navigationRef.navigate(
    RootScreen.Main as never,
    {
      screen: MainScreens.Drawer,
      params: { screen: DrawerScreens.Complaints },
    } as never,
  );
  return true;
};

const forgetOpen = () => {
  openWhenReady = false;
  stopWaiting?.();
  stopWaiting = null;
};

export function openComplaintsFromNotice(): void {
  if (openNow()) {
    return;
  }
  openWhenReady = true;
  if (stopWaiting === null) {
    // 'state' fires each time the screens change; the first time Main is there, Complaints opens.
    stopWaiting = navigationRef.addListener('state', () => {
      if (openWhenReady && openNow()) {
        forgetOpen();
      }
    });
  }
}
