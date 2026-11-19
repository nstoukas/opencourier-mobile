import { Platform } from 'react-native';
import notifee from '@notifee/react-native';
import '@app/localization/i18n';
import i18next from 'i18next';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import { User, UserStatus } from '@app/types/types';
import { navigationRef } from '@app/navigation/navigationRef';
import { MainScreens } from '@app/navigation/main/types';
import { RootScreen } from '@app/navigation/types';
import { MESSAGES_CHANNEL_ID } from './chat/chatNotice';
import {
  REVIEW_NOTIFICATION_ID,
  REVIEW_ANSWERED_TYPE,
  clearReviewNotice,
  openReviewsFromNotice,
  receiveReviewAnswer,
  showReviewAnswerNotice,
} from './reviewNotice';

describe('reviewNotice (spec 0038, AC-9)', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    queryClient.clear();

    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
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
    clearReviewNotice();
    Platform.OS = originalOS;
    queryClient.clear();
  });

  describe('showReviewAnswerNotice', () => {
    it('displays notification on messages channel with review-answer id and quiet title', async () => {
      await showReviewAnswerNotice();

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      const callArgs = (notifee.displayNotification as jest.Mock).mock
        .calls[0][0];

      expect(callArgs.id).toBe(REVIEW_NOTIFICATION_ID);
      expect(callArgs.title).toBe(
        i18next.t('translations:review_notice_title'),
      );
      expect(callArgs.data).toEqual({ type: REVIEW_ANSWERED_TYPE });
      expect(callArgs.android?.channelId).toBe(MESSAGES_CHANNEL_ID);
      expect(callArgs.android?.pressAction).toEqual({ id: 'default' });
    });
  });

  describe('receiveReviewAnswer', () => {
    it('invalidates reviewRequests query', async () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      await receiveReviewAnswer();

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.reviewRequests],
      });
    });

    it('shows notice when rider status is Online', async () => {
      queryClient.setQueryData<User>([QueryKeys.user], {
        id: 'rider-1',
        status: UserStatus.Online,
      } as User);

      await receiveReviewAnswer();

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    });

    it('stays quiet (no notification) when rider status is Offline', async () => {
      queryClient.setQueryData<User>([QueryKeys.user], {
        id: 'rider-1',
        status: UserStatus.Offline,
      } as User);

      await receiveReviewAnswer();

      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });

    it('shows notice when cached user is undefined (status unknown, non-offline)', async () => {
      queryClient.setQueryData([QueryKeys.user], undefined);

      await receiveReviewAnswer();

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearReviewNotice', () => {
    it('cancels the review-answer notification', () => {
      clearReviewNotice();

      expect(notifee.cancelNotification).toHaveBeenCalledWith(
        REVIEW_NOTIFICATION_ID,
      );
    });
  });

  describe('openReviewsFromNotice', () => {
    it('navigates to Main -> HowItWorks when navigation is ready and Main route is active', () => {
      openReviewsFromNotice();

      expect(navigationRef.navigate).toHaveBeenCalledWith(
        RootScreen.Main as never,
        { screen: MainScreens.HowItWorks } as never,
      );
    });

    it('defers navigation until state listener fires when navigation is not ready initially', () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(false);

      let stateListener: (() => void) | undefined;
      const removeListenerMock = jest.fn();
      jest
        .spyOn(navigationRef, 'addListener')
        .mockImplementation((event: string, callback: any) => {
          if (event === 'state') {
            stateListener = callback;
          }
          return removeListenerMock;
        });

      openReviewsFromNotice();
      expect(navigationRef.navigate).not.toHaveBeenCalled();
      expect(stateListener).toBeDefined();

      // Navigation becomes ready and state changes
      (navigationRef.isReady as jest.Mock).mockReturnValue(true);
      stateListener!();

      expect(navigationRef.navigate).toHaveBeenCalledWith(
        RootScreen.Main as never,
        { screen: MainScreens.HowItWorks } as never,
      );
      expect(removeListenerMock).toHaveBeenCalled();
    });
  });
});
