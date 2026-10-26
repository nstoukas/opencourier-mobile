import { Vibration, Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import '@app/localization/i18n';
import { remindRiderOfOffer } from './offerReminder';

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
});
