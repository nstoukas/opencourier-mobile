import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import '@app/localization/i18n';
import { announceAutoAccept, AUTO_ACCEPTED_CHANNEL_ID } from './autoAccepted';

describe('announceAutoAccept (spec 0020, AC-12)', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('creates channel auto-accepted with sound auto_accept and displays notification with timeoutAfter and restaurant name', async () => {
    await announceAutoAccept('del-123', 'Souvlaki Bar');

    // 1. Channel creation on Android with sound 'auto_accept'
    expect(notifee.createChannel).toHaveBeenCalledWith({
      id: AUTO_ACCEPTED_CHANNEL_ID,
      name: 'Orders accepted automatically',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'auto_accept',
      vibration: true,
    });

    // 2. Notification displayed with id auto-accepted-<deliveryId>, sound channel, timeoutAfter 2 minutes
    expect(notifee.displayNotification).toHaveBeenCalledWith({
      id: 'auto-accepted-del-123',
      title: 'Order accepted automatically: Souvlaki Bar',
      android: {
        channelId: AUTO_ACCEPTED_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        timeoutAfter: 120_000,
        pressAction: { id: 'default' },
      },
      ios: { sound: 'default' },
    });
  });

  it('formats title with fallback "a new order" when provided', async () => {
    await announceAutoAccept('del-456', 'a new order');

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'auto-accepted-del-456',
        title: 'Order accepted automatically: a new order',
      }),
    );
  });

  it('does not throw when notifee.displayNotification fails', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    (notifee.displayNotification as jest.Mock).mockRejectedValueOnce(
      new Error('Permission denied'),
    );

    await expect(
      announceAutoAccept('del-789', 'Pizza Roma'),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Auto accept notice could not be shown',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('does not create channel on non-Android platform (e.g. iOS)', async () => {
    Platform.OS = 'ios';

    await announceAutoAccept('del-ios-1', 'Creperie');

    expect(notifee.createChannel).not.toHaveBeenCalled();
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'auto-accepted-del-ios-1',
        title: 'Order accepted automatically: Creperie',
        ios: { sound: 'default' },
      }),
    );
  });

  // Row 105: notifee reads an Android notification's title as HTML, so the restaurant's name is
  // escaped there and shows exactly as typed; iOS shows plain text, so it is left alone.
  it('escapes the restaurant name in the title on Android (row 105)', async () => {
    Platform.OS = 'android';
    await announceAutoAccept('del-html-android', '<b>Bold</b> & Co');

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'auto-accepted-del-html-android',
        title: 'Order accepted automatically: &lt;b&gt;Bold&lt;/b&gt; &amp; Co',
      }),
    );
  });

  it('leaves the restaurant name plain in the title on iOS (row 105)', async () => {
    Platform.OS = 'ios';
    await announceAutoAccept('del-html-ios', '<b>Bold</b> & Co');

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'auto-accepted-del-html-ios',
        title: 'Order accepted automatically: <b>Bold</b> & Co',
      }),
    );
  });
});
