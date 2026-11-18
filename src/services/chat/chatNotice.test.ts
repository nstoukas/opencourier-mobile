import { AppState, Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import '@app/localization/i18n';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import { User, UserStatus } from '@app/types/types';
import { navigationRef } from '@app/navigation/navigationRef';
import { MainScreens } from '@app/navigation/main/types';
import { RootScreen } from '@app/navigation/types';
import {
  CHAT_NOTIFICATION_ID,
  MESSAGES_CHANNEL_ID,
  clearChatNotice,
  noticeChatMessage,
  openChatFromNotice,
  showChatNotice,
} from './chatNotice';

describe('chatNotice (spec 0034, AC-11, Minor 2, Minor 5)', () => {
  const originalOS = Platform.OS;
  let simulatedTime = 1_000_000_000;

  beforeEach(() => {
    simulatedTime += 60_000;
    jest.useFakeTimers();
    jest.setSystemTime(simulatedTime);
    jest.clearAllMocks();
    Platform.OS = 'android';
    AppState.currentState = 'active';
    queryClient.clear();

    // Default: navigationRef ready and on Home
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    jest.spyOn(navigationRef, 'getCurrentRoute').mockReturnValue({
      key: 'home-key',
      name: 'Home',
    } as any);
    jest.spyOn(navigationRef, 'getRootState').mockReturnValue({
      key: 'root',
      index: 0,
      routeNames: [RootScreen.Main],
      routes: [{ key: 'main-key', name: RootScreen.Main }],
      type: 'stack',
      stale: false,
    } as any);
    jest.spyOn(navigationRef, 'navigate').mockImplementation(() => {});
  });

  afterEach(() => {
    clearChatNotice();
    Platform.OS = originalOS;
    queryClient.clear();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('showChatNotice and clearChatNotice', () => {
    it('showChatNotice uses channel "messages" at AndroidImportance.DEFAULT (never an offer channel, never HIGH)', async () => {
      await showChatNotice();

      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: MESSAGES_CHANNEL_ID,
          name: expect.any(String),
          importance: AndroidImportance.DEFAULT,
          sound: 'default',
        }),
      );
      expect(MESSAGES_CHANNEL_ID).toBe('messages');
      expect(AndroidImportance.DEFAULT).toBe(3);
      // Never an offer channel (offers use high importance ringing channels)
      expect(notifee.createChannel).not.toHaveBeenCalledWith(
        expect.objectContaining({
          importance: AndroidImportance.HIGH,
        }),
      );
    });

    it('showChatNotice displays notification with title "New message from Dispatch", NO message text, and one fixed notification id', async () => {
      await showChatNotice();

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      expect(notifee.displayNotification).toHaveBeenCalledWith({
        id: CHAT_NOTIFICATION_ID,
        title: 'New message from Dispatch',
        data: { type: 'CHAT_MESSAGE' },
        android: {
          channelId: MESSAGES_CHANNEL_ID,
          pressAction: { id: 'default' },
        },
      });

      expect(CHAT_NOTIFICATION_ID).toBe('chat-message');

      const callArgs = (notifee.displayNotification as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.body).toBeUndefined();
      expect(callArgs.title).toBe('New message from Dispatch');
    });

    it('clearChatNotice cancels notification with fixed notification id', () => {
      clearChatNotice();

      expect(notifee.cancelNotification).toHaveBeenCalledWith(
        CHAT_NOTIFICATION_ID,
      );
    });
  });

  describe('noticeChatMessage (Major 2, AC-11 & Minor 2)', () => {
    it('draws notice when app is active and Chat is NOT in front', async () => {
      AppState.currentState = 'active';
      jest.spyOn(navigationRef, 'getCurrentRoute').mockReturnValue({
        key: 'home-key',
        name: 'Home',
      } as any);

      await noticeChatMessage();

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    });

    it('does NOT draw notice when Chat screen is in front (Major 2)', async () => {
      AppState.currentState = 'active';
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      jest.spyOn(navigationRef, 'getCurrentRoute').mockReturnValue({
        key: 'chat-key',
        name: MainScreens.Chat,
      } as any);

      await noticeChatMessage();

      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });

    it('5-second repeat guard: same message arriving by push and socket within 5 s sounds once (Major 2)', async () => {
      await noticeChatMessage();
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);

      // Repeat within 2 seconds
      jest.advanceTimersByTime(2000);
      await noticeChatMessage();
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);

      // After 5 seconds have passed in total (advance 3001 ms -> 5001 ms)
      jest.advanceTimersByTime(3001);
      await noticeChatMessage();
      expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
    });

    it('does NOT draw notice when rider status in query cache is OFFLINE (Minor 2)', async () => {
      queryClient.setQueryData<User>([QueryKeys.user], {
        id: 'u-1',
        status: UserStatus.Offline,
      } as User);

      await noticeChatMessage();

      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });

    it('draws notice when query cache is empty (Minor 2)', async () => {
      queryClient.setQueryData([QueryKeys.user], undefined);

      await noticeChatMessage();

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    });

    it('draws notice when query cache user is ONLINE', async () => {
      queryClient.setQueryData<User>([QueryKeys.user], {
        id: 'u-1',
        status: UserStatus.Online,
      } as User);

      await noticeChatMessage();

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('openChatFromNotice (Minor 5)', () => {
    it('immediately navigates to MainScreens.Chat when navigator is ready with Main stack', () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      jest.spyOn(navigationRef, 'getRootState').mockReturnValue({
        routes: [{ name: RootScreen.Main }],
      } as any);

      openChatFromNotice();

      expect(navigationRef.navigate).toHaveBeenCalledWith(RootScreen.Main, {
        screen: MainScreens.Chat,
      });
    });

    it('waits for navigator state when not ready, then navigates once ready', () => {
      let stateListener: (() => void) | undefined;
      jest
        .spyOn(navigationRef, 'addListener')
        .mockImplementation((event: string, listener: any) => {
          if (event === 'state') {
            stateListener = listener;
          }
          return jest.fn();
        });

      // Navigator is NOT ready initially
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(false);

      openChatFromNotice();

      expect(navigationRef.navigate).not.toHaveBeenCalled();
      expect(navigationRef.addListener).toHaveBeenCalledWith(
        'state',
        expect.any(Function),
      );

      // Now navigator becomes ready and Main appears
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      jest.spyOn(navigationRef, 'getRootState').mockReturnValue({
        routes: [{ name: RootScreen.Main }],
      } as any);

      // Trigger state change
      stateListener?.();

      expect(navigationRef.navigate).toHaveBeenCalledWith(RootScreen.Main, {
        screen: MainScreens.Chat,
      });
    });

    it('logout / clearChatNotice cancels the waiting navigation listener', () => {
      let stateListener: (() => void) | undefined;
      const removeListenerMock = jest.fn();
      jest
        .spyOn(navigationRef, 'addListener')
        .mockImplementation((event: string, listener: any) => {
          if (event === 'state') {
            stateListener = listener;
          }
          return removeListenerMock;
        });

      jest.spyOn(navigationRef, 'isReady').mockReturnValue(false);

      openChatFromNotice();
      expect(navigationRef.navigate).not.toHaveBeenCalled();

      // Logout / clear notice runs
      clearChatNotice();
      expect(removeListenerMock).toHaveBeenCalled();

      // Navigator becomes ready later
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      jest.spyOn(navigationRef, 'getRootState').mockReturnValue({
        routes: [{ name: RootScreen.Main }],
      } as any);

      // Even if listener fired, navigation should NOT happen
      stateListener?.();

      expect(navigationRef.navigate).not.toHaveBeenCalled();
    });
  });
});
