import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import '@app/localization/i18n';
import { TrackingMode } from '@app/utilities/locationTracking';
import {
  ONLINE_CHANNEL_ID,
  ONLINE_NOTIFICATION_ID,
  onOnlineSignDismissed,
  showOnlineService,
  stopOnlineService,
} from './onlineService';

describe('onlineService (spec 0008, AC-3, AC-4)', () => {
  const originalOS = Platform.OS;

  beforeEach(async () => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    // Clear module-level shownMode state by stopping service before each test
    await stopOnlineService();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await stopOnlineService();
    Platform.OS = originalOS;
  });

  describe('showOnlineService (AC-3)', () => {
    it('creates channel "online" with AndroidImportance.LOW and displays notification with waiting translation keys', async () => {
      await showOnlineService(TrackingMode.Waiting);

      expect(notifee.createChannel).toHaveBeenCalledTimes(1);
      expect(notifee.createChannel).toHaveBeenCalledWith({
        id: ONLINE_CHANNEL_ID,
        name: 'Online status',
        importance: AndroidImportance.LOW,
      });

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      expect(notifee.displayNotification).toHaveBeenCalledWith({
        id: ONLINE_NOTIFICATION_ID,
        title: 'OpenCourier is online',
        body: 'Your location is shared to get offers. Go offline to stop.',
        android: {
          channelId: ONLINE_CHANNEL_ID,
          asForegroundService: true,
          ongoing: true,
          pressAction: { id: 'default' },
        },
      });
    });

    it('creates channel and displays notification with job translation keys when mode is Job', async () => {
      await showOnlineService(TrackingMode.Job);

      expect(notifee.createChannel).toHaveBeenCalledTimes(1);
      expect(notifee.createChannel).toHaveBeenCalledWith({
        id: ONLINE_CHANNEL_ID,
        name: 'Online status',
        importance: AndroidImportance.LOW,
      });

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      expect(notifee.displayNotification).toHaveBeenCalledWith({
        id: ONLINE_NOTIFICATION_ID,
        title: 'OpenCourier: delivery in progress',
        body: 'Your location is shared until this delivery ends.',
        android: {
          channelId: ONLINE_CHANNEL_ID,
          asForegroundService: true,
          ongoing: true,
          pressAction: { id: 'default' },
        },
      });
    });

    it('does nothing on iOS (no channel created, no notification displayed)', async () => {
      Platform.OS = 'ios';

      await showOnlineService(TrackingMode.Waiting);

      expect(notifee.createChannel).not.toHaveBeenCalled();
      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });
  });

  describe('stopOnlineService (AC-4)', () => {
    it('calls notifee.stopForegroundService on Android and is safe when nothing runs', async () => {
      await stopOnlineService();

      expect(notifee.stopForegroundService).toHaveBeenCalledTimes(1);
    });

    it('does nothing on iOS', async () => {
      Platform.OS = 'ios';

      await stopOnlineService();

      expect(notifee.stopForegroundService).not.toHaveBeenCalled();
    });
  });

  describe('onOnlineSignDismissed (AC-3: swipe recovery)', () => {
    it('shows the sign again with the currently shown mode when notificationId matches "online-status"', async () => {
      // First show the waiting sign
      await showOnlineService(TrackingMode.Waiting);
      jest.clearAllMocks();

      // Notification is dismissed (e.g. swiped away on Android 14+)
      await onOnlineSignDismissed(ONLINE_NOTIFICATION_ID);

      expect(notifee.createChannel).toHaveBeenCalledTimes(1);
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      expect(notifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: ONLINE_NOTIFICATION_ID,
          title: 'OpenCourier is online',
        }),
      );
    });

    it('shows the job sign again if mode was Job when dismissed', async () => {
      await showOnlineService(TrackingMode.Job);
      jest.clearAllMocks();

      await onOnlineSignDismissed(ONLINE_NOTIFICATION_ID);

      expect(notifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: ONLINE_NOTIFICATION_ID,
          title: 'OpenCourier: delivery in progress',
        }),
      );
    });

    it('does nothing when notificationId does not match "online-status"', async () => {
      await showOnlineService(TrackingMode.Waiting);
      jest.clearAllMocks();

      await onOnlineSignDismissed('different-notification-id');
      await onOnlineSignDismissed(undefined);

      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });

    it('does nothing after stopOnlineService has cleared shownMode', async () => {
      await showOnlineService(TrackingMode.Waiting);
      await stopOnlineService();
      jest.clearAllMocks();

      await onOnlineSignDismissed(ONLINE_NOTIFICATION_ID);

      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });
  });
});
