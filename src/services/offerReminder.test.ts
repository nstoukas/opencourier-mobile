import { Vibration, Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import '@app/localization/i18n';
import { remindRiderOfOffer, cancelOfferReminder } from './offerReminder';

describe('offerReminder (spec 0002, AC-4)', () => {
  let vibrateSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    vibrateSpy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
  });

  afterEach(() => {
    vibrateSpy.mockRestore();
  });

  it('triggers short vibration when waited time is under 2 minutes (e.g. 30s)', async () => {
    await remindRiderOfOffer('order-123', 30000);

    // Short vibration: [0, 400]
    expect(vibrateSpy).toHaveBeenCalledTimes(1);
    expect(vibrateSpy).toHaveBeenCalledWith([0, 400]);
  });

  it('triggers short vibration when waited time is 90 seconds', async () => {
    await remindRiderOfOffer('order-123', 90000);

    expect(vibrateSpy).toHaveBeenCalledTimes(1);
    expect(vibrateSpy).toHaveBeenCalledWith([0, 400]);
  });

  it('triggers longer vibration pattern once offer has waited 2 minutes (120,000 ms)', async () => {
    await remindRiderOfOffer('order-123', 120000);

    // Long vibration pattern: [0, 800, 300, 800, 300, 800]
    expect(vibrateSpy).toHaveBeenCalledTimes(1);
    expect(vibrateSpy).toHaveBeenCalledWith([0, 800, 300, 800, 300, 800]);
  });

  it('triggers longer vibration pattern for waited time greater than 2 minutes', async () => {
    await remindRiderOfOffer('order-123', 180000);

    expect(vibrateSpy).toHaveBeenCalledTimes(1);
    expect(vibrateSpy).toHaveBeenCalledWith([0, 800, 300, 800, 300, 800]);
  });

  it('creates Android channel offer_reminders and displays notification on Android', async () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';

    try {
      await remindRiderOfOffer('order-456', 60000);

      expect(notifee.createChannel).toHaveBeenCalledWith({
        id: 'offer_reminders',
        name: 'Offer reminders',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: false,
      });

      expect(notifee.displayNotification).toHaveBeenCalledWith({
        id: 'offer-reminder-order-456',
        title: 'An offer is waiting for you',
        body: 'Waiting 1 min',
        android: {
          channelId: 'offer_reminders',
          importance: AndroidImportance.HIGH,
          timeoutAfter: 25000,
          pressAction: { id: 'default' },
        },
        ios: { sound: 'default' },
      });
    } finally {
      Platform.OS = originalOS;
    }
  });

  it('does not throw when notification display fails (e.g. permission denied) and still vibrates', async () => {
    (notifee.displayNotification as jest.Mock).mockRejectedValueOnce(
      new Error('Notification permission denied'),
    );

    // Must resolve cleanly without throwing
    await expect(
      remindRiderOfOffer('order-789', 30000),
    ).resolves.toBeUndefined();

    // Vibration was still called before notification attempt
    expect(vibrateSpy).toHaveBeenCalledWith([0, 400]);
  });

  describe('M2: 30 s reminder text', () => {
    it('uses "Waiting less than 1 min" (offer_waiting_just_now) instead of "Waiting 0 min" under 1 minute', async () => {
      await remindRiderOfOffer('order-30s', 30000);

      expect(notifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'offer-reminder-order-30s',
          title: 'An offer is waiting for you',
          body: 'Waiting less than 1 min',
        }),
      );

      // Explicitly guard against the "Waiting 0 min" bug
      const call = (notifee.displayNotification as jest.Mock).mock.calls.find(
        c => c[0]?.id === 'offer-reminder-order-30s',
      );
      expect(call[0]?.body).not.toBe('Waiting 0 min');
      expect(call[0]?.body).toBe('Waiting less than 1 min');
    });
  });

  describe('M7: cancelOfferReminder', () => {
    it('cancels the notification in tray using offer-reminder-<id>', async () => {
      await cancelOfferReminder('order-abc');

      expect(notifee.cancelNotification).toHaveBeenCalledTimes(1);
      expect(notifee.cancelNotification).toHaveBeenCalledWith(
        'offer-reminder-order-abc',
      );
    });

    it('swallows errors when cancelNotification fails and does not throw', async () => {
      (notifee.cancelNotification as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to cancel notification'),
      );

      await expect(cancelOfferReminder('order-abc')).resolves.toBeUndefined();
    });
  });
});
