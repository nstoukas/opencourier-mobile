import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '@app/localization/i18n';
import { prepareToGoOnline } from './goOnlineChecks';
import * as phone from './phone';

jest.mock('./phone', () => ({
  getRingerState: jest.fn(),
  isPhoneSilenced: jest.requireActual('./phone').isPhoneSilenced,
  canUseFullScreenAlert: jest.fn(),
  openFullScreenAlertSettings: jest.fn(),
  openSoundSettings: jest.fn(),
}));

const flushMicrotasks = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
};

describe('goOnlineChecks (spec 0003, AC-8, AC-9, Decisions 58.22, 58.23)', () => {
  const originalOS = Platform.OS;
  const originalVersion = Platform.Version;
  let alertSpy: jest.SpyInstance;
  let appStateListeners: Array<(state: string) => void> = [];

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    await AsyncStorage.clear();

    Platform.OS = 'android';
    Object.defineProperty(Platform, 'Version', {
      value: 33,
      configurable: true,
      writable: true,
    });

    appStateListeners = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event: string, listener: any) => {
        if (event === 'change') {
          appStateListeners.push(listener);
        }
        return {
          remove: () => {
            appStateListeners = appStateListeners.filter(l => l !== listener);
          },
        } as any;
      });

    (phone.getRingerState as jest.Mock).mockResolvedValue({
      ringerMode: 'normal',
      doNotDisturb: false,
    });
    (phone.canUseFullScreenAlert as jest.Mock).mockResolvedValue(true);

    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue('granted' as any);

    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = originalOS;
    Object.defineProperty(Platform, 'Version', {
      value: originalVersion,
      configurable: true,
      writable: true,
    });
    alertSpy.mockRestore();
  });

  const triggerAppState = (state: string) => {
    appStateListeners.forEach(listener => listener(state));
  };

  describe('AC-8: Ringer and Do Not Disturb warnings', () => {
    beforeEach(async () => {
      // Mark permissions as already asked so AC-8 tests only test silent warning
      await AsyncStorage.setItem('offer_alert_permissions_asked', 'yes');
    });

    it('shows warning with spec words when phone is on silent', async () => {
      (phone.getRingerState as jest.Mock).mockResolvedValue({
        ringerMode: 'silent',
        doNotDisturb: false,
      });

      const promise = prepareToGoOnline();
      await flushMicrotasks();

      expect(alertSpy).toHaveBeenCalledTimes(1);
      const [title, message, buttons] = alertSpy.mock.calls[0];

      expect(title).toBe('');
      expect(message).toBe('Your phone is on silent. You may miss offers.');

      const buttonTexts = buttons.map((b: any) => b.text);
      expect(buttonTexts).toContain('Go Online anyway');
      expect(buttonTexts).toContain('Turn sound on');

      // Dismiss / answer dialog
      buttons[0].onPress();
      await promise;
    });

    it('shows warning when phone is on vibrate', async () => {
      (phone.getRingerState as jest.Mock).mockResolvedValue({
        ringerMode: 'vibrate',
        doNotDisturb: false,
      });

      const promise = prepareToGoOnline();
      await flushMicrotasks();

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0][1]).toBe(
        'Your phone is on silent. You may miss offers.',
      );

      alertSpy.mock.calls[0][2][0].onPress();
      await promise;
    });

    it('shows warning when Do Not Disturb is enabled', async () => {
      (phone.getRingerState as jest.Mock).mockResolvedValue({
        ringerMode: 'normal',
        doNotDisturb: true,
      });

      const promise = prepareToGoOnline();
      await flushMicrotasks();

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0][1]).toBe(
        'Your phone is on silent. You may miss offers.',
      );

      alertSpy.mock.calls[0][2][0].onPress();
      await promise;
    });

    it('shows no warning when phone has normal ringer and no DND', async () => {
      (phone.getRingerState as jest.Mock).mockResolvedValue({
        ringerMode: 'normal',
        doNotDisturb: false,
      });

      await prepareToGoOnline();

      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('both buttons let the rider proceed Online without storing or sending anything', async () => {
      (phone.getRingerState as jest.Mock).mockResolvedValue({
        ringerMode: 'silent',
        doNotDisturb: false,
      });

      // 1. "Go Online anyway"
      const promise1 = prepareToGoOnline();
      await flushMicrotasks();
      const buttons1 = alertSpy.mock.calls[0][2];
      const goAnywayBtn = buttons1.find(
        (b: any) => b.text === 'Go Online anyway',
      );
      goAnywayBtn.onPress();
      await expect(promise1).resolves.toBeUndefined();

      alertSpy.mockClear();

      // 2. "Turn sound on" opens sound settings and waits for return
      const promise2 = prepareToGoOnline();
      await flushMicrotasks();
      const buttons2 = alertSpy.mock.calls[0][2];
      const turnOnBtn = buttons2.find((b: any) => b.text === 'Turn sound on');
      turnOnBtn.onPress();

      expect(phone.openSoundSettings).toHaveBeenCalledTimes(1);

      // Simulate rider returning to app (AppState transition)
      triggerAppState('background');
      triggerAppState('active');

      await expect(promise2).resolves.toBeUndefined();

      // Nothing stored in AsyncStorage about silent state
      const keys = await AsyncStorage.getAllKeys();
      expect(keys).not.toContain('ringerState');
      expect(keys).not.toContain('silent');
      expect(keys).not.toContain('doNotDisturb');
    });
  });

  describe('AC-9: First-time alert permissions flow', () => {
    it('asks notification permission on Android 33+ and full screen explanation on first time', async () => {
      (phone.canUseFullScreenAlert as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);

      const promise = prepareToGoOnline();
      await flushMicrotasks();

      // Asked notification permission via PermissionsAndroid
      expect(PermissionsAndroid.request).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );

      // Explained full-screen alerts
      expect(alertSpy).toHaveBeenCalledTimes(1);
      const [title, message, buttons] = alertSpy.mock.calls[0];
      expect(title).toBe('Show offers on a locked phone');
      expect(message).toBe(
        'To show a new offer over the lock screen, allow full screen alerts for this app on the next screen. Without it, offers still come as a normal alert.',
      );

      const buttonTexts = buttons.map((b: any) => b.text);
      expect(buttonTexts).toContain('Not now');
      expect(buttonTexts).toContain('Open settings');

      // Dismiss dialog
      buttons[0].onPress();
      await promise;

      // Recorded flag in AsyncStorage
      expect(await AsyncStorage.getItem('offer_alert_permissions_asked')).toBe(
        'yes',
      );
    });

    it('second Online asks nothing', async () => {
      await AsyncStorage.setItem('offer_alert_permissions_asked', 'yes');
      (phone.canUseFullScreenAlert as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);

      await prepareToGoOnline();

      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('refusing everything still goes Online without throwing', async () => {
      (phone.canUseFullScreenAlert as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        'denied' as any,
      );

      const promise = prepareToGoOnline();
      await flushMicrotasks();

      expect(alertSpy).toHaveBeenCalledTimes(1);
      const buttons = alertSpy.mock.calls[0][2];
      const notNowBtn = buttons.find((b: any) => b.text === 'Not now');

      notNowBtn.onPress();
      await expect(promise).resolves.toBeUndefined();
    });

    it('settings button opens full screen settings and waits for AppState return', async () => {
      (phone.canUseFullScreenAlert as jest.Mock).mockResolvedValue(false);

      const promise = prepareToGoOnline();
      await flushMicrotasks();

      const buttons = alertSpy.mock.calls[0][2];
      const openSettingsBtn = buttons.find(
        (b: any) => b.text === 'Open settings',
      );

      openSettingsBtn.onPress();
      expect(phone.openFullScreenAlertSettings).toHaveBeenCalledTimes(1);

      // Simulate AppState cycle (leaving and coming back)
      triggerAppState('background');
      triggerAppState('active');

      await expect(promise).resolves.toBeUndefined();
    });

    it('does not hang if settings screen never opened (times out after 1500ms)', async () => {
      (phone.canUseFullScreenAlert as jest.Mock).mockResolvedValue(false);

      const promise = prepareToGoOnline();
      await flushMicrotasks();

      const buttons = alertSpy.mock.calls[0][2];
      const openSettingsBtn = buttons.find(
        (b: any) => b.text === 'Open settings',
      );

      openSettingsBtn.onPress();
      expect(phone.openFullScreenAlertSettings).toHaveBeenCalledTimes(1);

      // AppState NEVER leaves active (settings failed to open)
      // Fast forward past the 1500ms fallback timer
      jest.advanceTimersByTime(1500);

      await expect(promise).resolves.toBeUndefined();
    });
  });
});
