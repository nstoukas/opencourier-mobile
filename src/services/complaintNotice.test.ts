import notifee from '@notifee/react-native';
import '@app/localization/i18n';
import i18next from 'i18next';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import { navigationRef } from '@app/navigation/navigationRef';
import { MainScreens } from '@app/navigation/main/types';
import { DrawerScreens } from '@app/navigation/drawer/types';
import { RootScreen } from '@app/navigation/types';
import { MESSAGES_CHANNEL_ID, ensureChannel } from './chat/chatNotice';
import {
  COMPLAINT_NOTIFICATION_ID,
  COMPLAINT_NEEDS_REPLY_TYPE,
  showComplaintNotice,
  receiveComplaintNeedsReply,
  clearComplaintNotice,
  openComplaintsFromNotice,
} from './complaintNotice';

jest.mock('./chat/chatNotice', () => ({
  MESSAGES_CHANNEL_ID: 'messages',
  ensureChannel: jest.fn().mockResolvedValue(undefined),
}));

// Spec 0052 (AC-4): quiet push notice on chat channel for complaint reply, shown Online or not.
describe('complaintNotice (spec 0052, AC-4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();

    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    jest.spyOn(navigationRef, 'getRootState').mockReturnValue({
      routes: [{ name: RootScreen.Main }],
    } as any);
    jest.spyOn(navigationRef, 'navigate').mockImplementation(() => {});
  });

  afterEach(() => {
    clearComplaintNotice();
    queryClient.clear();
  });

  describe('Notification constants', () => {
    it('defines fixed notification id and type string', () => {
      expect(COMPLAINT_NOTIFICATION_ID).toBe('complaint-needs-reply');
      expect(COMPLAINT_NEEDS_REPLY_TYPE).toBe('COMPLAINT_NEEDS_REPLY');
    });
  });

  describe('showComplaintNotice', () => {
    it('ensures channel and displays notification on chat messages quiet channel', async () => {
      await showComplaintNotice();

      expect(ensureChannel).toHaveBeenCalledTimes(1);
      expect(notifee.displayNotification).toHaveBeenCalledWith({
        id: COMPLAINT_NOTIFICATION_ID,
        title: i18next.t('translations:complaint_notice_title'),
        data: { type: COMPLAINT_NEEDS_REPLY_TYPE },
        android: {
          channelId: MESSAGES_CHANNEL_ID,
          pressAction: { id: 'default' },
        },
      });

      const callArgs = (notifee.displayNotification as jest.Mock).mock
        .calls[0][0];
      // Push never carries body text over the wire or in notification (AC-4)
      expect(callArgs.body).toBeUndefined();
    });
  });

  describe('receiveComplaintNeedsReply', () => {
    it('invalidates complaints query cache and displays notice', async () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      await receiveComplaintNeedsReply();

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.complaints],
      });
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearComplaintNotice', () => {
    it('cancels notification with fixed id complaint-needs-reply', () => {
      clearComplaintNotice();

      expect(notifee.cancelNotification).toHaveBeenCalledWith(
        COMPLAINT_NOTIFICATION_ID,
      );
    });
  });

  describe('openComplaintsFromNotice', () => {
    it('immediately navigates to Drawer Complaints screen when navigator ready with Main stack', () => {
      openComplaintsFromNotice();

      expect(navigationRef.navigate).toHaveBeenCalledWith(RootScreen.Main, {
        screen: MainScreens.Drawer,
        params: { screen: DrawerScreens.Complaints },
      });
    });

    it('waits for navigator state when not ready, then navigates once Main appears', () => {
      let stateListener: (() => void) | undefined;
      jest
        .spyOn(navigationRef, 'addListener')
        .mockImplementation((event: string, listener: any) => {
          if (event === 'state') {
            stateListener = listener;
          }
          return jest.fn();
        });

      jest.spyOn(navigationRef, 'isReady').mockReturnValue(false);

      openComplaintsFromNotice();

      expect(navigationRef.navigate).not.toHaveBeenCalled();
      expect(navigationRef.addListener).toHaveBeenCalledWith(
        'state',
        expect.any(Function),
      );

      // Navigator becomes ready and state fires
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      jest.spyOn(navigationRef, 'getRootState').mockReturnValue({
        routes: [{ name: RootScreen.Main }],
      } as any);

      stateListener?.();

      expect(navigationRef.navigate).toHaveBeenCalledWith(RootScreen.Main, {
        screen: MainScreens.Drawer,
        params: { screen: DrawerScreens.Complaints },
      });
    });

    it('clearComplaintNotice cancels waiting navigation listener', () => {
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

      openComplaintsFromNotice();
      expect(navigationRef.navigate).not.toHaveBeenCalled();

      clearComplaintNotice();
      expect(removeListenerMock).toHaveBeenCalled();

      // State fires after clearing; navigation should not happen
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      jest.spyOn(navigationRef, 'getRootState').mockReturnValue({
        routes: [{ name: RootScreen.Main }],
      } as any);

      stateListener?.();

      expect(navigationRef.navigate).not.toHaveBeenCalled();
    });
  });
});
