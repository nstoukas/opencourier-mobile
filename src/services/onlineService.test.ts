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
    (notifee.createChannel as jest.Mock).mockImplementation(() =>
      Promise.resolve(ONLINE_CHANNEL_ID),
    );
    (notifee.displayNotification as jest.Mock).mockImplementation(() =>
      Promise.resolve(ONLINE_NOTIFICATION_ID),
    );
    (notifee.stopForegroundService as jest.Mock).mockImplementation(() =>
      Promise.resolve(),
    );
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

    it('resolves true when show completes without a stop', async () => {
      const shownWaiting = await showOnlineService(TrackingMode.Waiting);
      expect(shownWaiting).toBe(true);

      const shownJob = await showOnlineService(TrackingMode.Job);
      expect(shownJob).toBe(true);
    });

    it('stopOnlineService called while showOnlineService is waiting on createChannel makes the show resolve false and never call displayNotification', async () => {
      // Defer createChannel so we can call stopOnlineService while it is in flight
      let resolveCreateChannel!: (channelId: string) => void;
      (notifee.createChannel as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve => {
            resolveCreateChannel = resolve;
          }),
      );

      const showPromise = showOnlineService(TrackingMode.Waiting);
      expect(notifee.createChannel).toHaveBeenCalledTimes(1);
      expect(notifee.displayNotification).not.toHaveBeenCalled();

      // Stop arrives while createChannel is in flight
      await stopOnlineService();

      // Now createChannel finishes
      resolveCreateChannel(ONLINE_CHANNEL_ID);
      const shown = await showPromise;

      expect(shown).toBe(false);
      expect(notifee.displayNotification).not.toHaveBeenCalled();

      // After such a stop, onOnlineSignDismissed shows nothing because shownMode stayed null
      jest.clearAllMocks();
      await onOnlineSignDismissed(ONLINE_NOTIFICATION_ID);
      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });

    it('stopOnlineService called while showOnlineService is waiting on displayNotification calls stopForegroundService after displaying and resolves false', async () => {
      // Defer displayNotification so we can call stopOnlineService while it is in flight
      let resolveDisplayNotification!: (notificationId: string) => void;
      (notifee.displayNotification as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve => {
            resolveDisplayNotification = resolve;
          }),
      );

      const showPromise = showOnlineService(TrackingMode.Waiting);
      // Wait for createChannel to resolve and displayNotification to be called
      await Promise.resolve();
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);

      // Stop arrives while displayNotification is in flight
      await stopOnlineService();
      // stopOnlineService called stopForegroundService once
      expect(notifee.stopForegroundService).toHaveBeenCalledTimes(1);

      // Now displayNotification resolves
      resolveDisplayNotification(ONLINE_NOTIFICATION_ID);
      const shown = await showPromise;

      expect(shown).toBe(false);
      // stopForegroundService was called a second time to undo the start after displaying
      expect(notifee.stopForegroundService).toHaveBeenCalledTimes(2);

      // And after such a stop, onOnlineSignDismissed shows nothing because shownMode stayed null
      jest.clearAllMocks();
      await onOnlineSignDismissed(ONLINE_NOTIFICATION_ID);
      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });

    it('does nothing on iOS (no channel created, no notification displayed)', async () => {
      Platform.OS = 'ios';

      const shown = await showOnlineService(TrackingMode.Waiting);

      expect(shown).toBe(true);
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

    it('when showOnlineService rejects, the handler resolves (no unhandled rejection) and logs', async () => {
      // First show the waiting sign so shownMode is populated
      await showOnlineService(TrackingMode.Waiting);
      jest.clearAllMocks();

      // Android refuses foreground service start (e.g. app in background)
      const error = new Error('Android refused foreground service start');
      (notifee.displayNotification as jest.Mock).mockRejectedValueOnce(error);

      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Handler must resolve cleanly (no unhandled promise rejection)
      await expect(
        onOnlineSignDismissed(ONLINE_NOTIFICATION_ID),
      ).resolves.toBeUndefined();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Could not show the online sign again',
        error,
      );

      consoleLogSpy.mockRestore();
    });
  });
});
