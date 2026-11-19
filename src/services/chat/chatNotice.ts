import { AppState, Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import i18next from 'i18next';
import { notificationText } from '@app/utilities/notificationText';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import { User, UserStatus } from '@app/types/types';
import { navigationRef } from '@app/navigation/navigationRef';
import { MainScreens } from '@app/navigation/main/types';
import { RootScreen } from '@app/navigation/types';

// Spec 0034 (chat), AC-11: dispatch wrote while the app was not in front. The push carries no message
// text (nothing anyone wrote passes through Google), so the phone draws a fixed line itself. Its own
// channel, at default importance, apart from every offer channel: a chat message never sounds like
// an offer. One notification id, so several messages show as one line, not a pile.
export const MESSAGES_CHANNEL_ID = 'messages';
export const CHAT_NOTIFICATION_ID = 'chat-message';

// Exported for the review answer notice (spec 0038), which uses the same quiet channel.
export const ensureChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: MESSAGES_CHANNEL_ID,
    name: i18next.t('translations:chat_channel'),
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });
};

export async function showChatNotice(): Promise<void> {
  await ensureChannel();
  await notifee.displayNotification({
    id: CHAT_NOTIFICATION_ID,
    title: notificationText(i18next.t('translations:chat_notice_title')),
    data: { type: 'CHAT_MESSAGE' },
    android: {
      channelId: MESSAGES_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
}

// The push and the live connection both bring the same message from dispatch while the app is open, a
// moment apart: the notice sounds once for them.
const REPEAT_WITHIN_MS = 5_000;
let lastDrawnAt = 0;

// True when the Chat screen is on screen in the open app: it shows the message itself.
const isChatInFront = (): boolean =>
  AppState.currentState === 'active' &&
  navigationRef.isReady() &&
  navigationRef.getCurrentRoute()?.name === MainScreens.Chat;

// Dispatch wrote (a push, or the live connection while the app is open). The notice is drawn in the
// background and in front alike (review of 2026-11-18, AC-11), except:
// - while the Chat screen is in front: the message is already on screen;
// - while the rider is Offline, by the status the app last loaded: the server checks it at send time,
//   but a push can arrive up to an hour later, and a rider's time off stays off (AC-10).
// No request is made here: an unknown status (an empty cache) leaves the server's check standing.
export async function noticeChatMessage(): Promise<void> {
  const user = queryClient.getQueryData<User>([QueryKeys.user]);
  if (user?.status === UserStatus.Offline || isChatInFront()) {
    return;
  }
  const now = Date.now();
  if (now - lastDrawnAt < REPEAT_WITHIN_MS) {
    return;
  }
  lastDrawnAt = now;
  await showChatNotice();
}

// --- Opening Chat from the notice -----------------------------------------

// A tap that came before the rider's screens exist (the app was closed): Chat opens once they do.
let openWhenReady = false;
let stopWaiting: (() => void) | null = null;

// Opens Chat when the rider's screens are there (logged in, past the splash). True when it did.
const openChatNow = (): boolean => {
  if (
    !navigationRef.isReady() ||
    !navigationRef.getRootState()?.routes.some(r => r.name === RootScreen.Main)
  ) {
    return false;
  }
  // The ref is not typed with the app's screens, so `as never` lets this call name a screen it cannot
  // check (as in session.ts). The nested `screen` opens Chat inside the Main stack.
  navigationRef.navigate(
    RootScreen.Main as never,
    { screen: MainScreens.Chat } as never,
  );
  return true;
};

// The rider tapped the chat notice (review of 2026-11-18, Minor 5).
export function openChatFromNotice(): void {
  if (openChatNow()) {
    return;
  }
  openWhenReady = true;
  if (stopWaiting === null) {
    // 'state' fires each time the screens change; the first time Main is there, Chat opens.
    stopWaiting = navigationRef.addListener('state', () => {
      if (openWhenReady && openChatNow()) {
        forgetChatOpen();
      }
    });
  }
}

const forgetChatOpen = () => {
  openWhenReady = false;
  stopWaiting?.();
  stopWaiting = null;
};

// The rider opened the chat, or logged out: the notice has nothing more to say.
export function clearChatNotice(): void {
  forgetChatOpen();
  notifee
    .cancelNotification(CHAT_NOTIFICATION_ID)
    .catch(error => console.log('Could not clear the chat notice', error));
}
