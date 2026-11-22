import { Linking, Platform } from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import * as phone from '@app/services/offerPush/phone';
import * as offerAlert from '@app/services/offerPush/offerAlert';
import {
  checkPhoneRings,
  hasRingProblem,
  openFixFor,
  RingCheckItem,
} from './ringCheck';

describe('ringCheck (row 84, decisions 84.4, 84.5)', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
  });

  describe('checkPhoneRings', () => {
    it('returns only notifications check on non-Android platform (e.g. iOS)', async () => {
      (Platform as any).OS = 'ios';
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValueOnce({
        authorizationStatus: AuthorizationStatus.AUTHORIZED,
      });
      const ringerSpy = jest.spyOn(phone, 'getRingerState');

      const result = await checkPhoneRings();

      expect(result).toEqual([{ id: 'notifications', problem: null }]);
      expect(ringerSpy).not.toHaveBeenCalled();
    });

    it('returns all 5 checks on Android with all null when healthy', async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValueOnce({
        authorizationStatus: AuthorizationStatus.AUTHORIZED,
      });
      jest.spyOn(offerAlert, 'ensureOfferChannels').mockResolvedValueOnce();
      (notifee.isChannelBlocked as jest.Mock).mockResolvedValue(false);
      jest.spyOn(phone, 'canUseFullScreenAlert').mockResolvedValueOnce(true);
      jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
        ringerMode: 'normal',
        doNotDisturb: false,
      });
      (notifee.isBatteryOptimizationEnabled as jest.Mock).mockResolvedValueOnce(
        false,
      );

      const result = await checkPhoneRings();

      expect(result).toEqual([
        { id: 'notifications', problem: null },
        { id: 'offer_alerts', problem: null },
        { id: 'full_screen', problem: null },
        { id: 'sound', problem: null },
        { id: 'battery', problem: null },
      ]);
      expect(hasRingProblem(result)).toBe(false);
    });

    it('identifies notifications_off when permission is denied', async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValueOnce({
        authorizationStatus: AuthorizationStatus.DENIED,
      });
      (notifee.isChannelBlocked as jest.Mock).mockResolvedValue(false);
      jest.spyOn(phone, 'canUseFullScreenAlert').mockResolvedValueOnce(true);
      jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
        ringerMode: 'normal',
        doNotDisturb: false,
      });
      (notifee.isBatteryOptimizationEnabled as jest.Mock).mockResolvedValueOnce(
        false,
      );

      const result = await checkPhoneRings();

      const notifItem = result.find(i => i.id === 'notifications');
      expect(notifItem?.problem).toBe('notifications_off');
      expect(hasRingProblem(result)).toBe(true);
    });

    it('identifies offer_alerts_off when offer channel is blocked', async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValueOnce({
        authorizationStatus: AuthorizationStatus.AUTHORIZED,
      });
      jest.spyOn(offerAlert, 'ensureOfferChannels').mockResolvedValueOnce();
      // Block the insistent channel
      (notifee.isChannelBlocked as jest.Mock).mockImplementation(
        async channelId => channelId === offerAlert.OFFERS_INSISTENT_CHANNEL_ID,
      );
      jest.spyOn(phone, 'canUseFullScreenAlert').mockResolvedValueOnce(true);
      jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
        ringerMode: 'normal',
        doNotDisturb: false,
      });
      (notifee.isBatteryOptimizationEnabled as jest.Mock).mockResolvedValueOnce(
        false,
      );

      const result = await checkPhoneRings();

      const alertItem = result.find(i => i.id === 'offer_alerts');
      expect(alertItem?.problem).toBe('offer_alerts_off');
    });

    it('identifies full_screen_off when canUseFullScreenAlert is false', async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValueOnce({
        authorizationStatus: AuthorizationStatus.AUTHORIZED,
      });
      (notifee.isChannelBlocked as jest.Mock).mockResolvedValue(false);
      jest.spyOn(phone, 'canUseFullScreenAlert').mockResolvedValueOnce(false);
      jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
        ringerMode: 'normal',
        doNotDisturb: false,
      });
      (notifee.isBatteryOptimizationEnabled as jest.Mock).mockResolvedValueOnce(
        false,
      );

      const result = await checkPhoneRings();

      const fsItem = result.find(i => i.id === 'full_screen');
      expect(fsItem?.problem).toBe('full_screen_off');
    });

    it('identifies phone_silent, phone_vibrate, and do_not_disturb in ringer state', async () => {
      // 1. Silent
      jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
        ringerMode: 'silent',
        doNotDisturb: false,
      });
      let result = await checkPhoneRings();
      expect(result.find(i => i.id === 'sound')?.problem).toBe('phone_silent');

      // 2. Vibrate
      jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
        ringerMode: 'vibrate',
        doNotDisturb: false,
      });
      result = await checkPhoneRings();
      expect(result.find(i => i.id === 'sound')?.problem).toBe('phone_vibrate');

      // 3. Do not disturb (when ringerMode is normal)
      jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
        ringerMode: 'normal',
        doNotDisturb: true,
      });
      result = await checkPhoneRings();
      expect(result.find(i => i.id === 'sound')?.problem).toBe(
        'do_not_disturb',
      );
    });

    it('identifies battery_optimised when battery optimization is enabled', async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValueOnce({
        authorizationStatus: AuthorizationStatus.AUTHORIZED,
      });
      (notifee.isChannelBlocked as jest.Mock).mockResolvedValue(false);
      jest.spyOn(phone, 'canUseFullScreenAlert').mockResolvedValueOnce(true);
      jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
        ringerMode: 'normal',
        doNotDisturb: false,
      });
      (notifee.isBatteryOptimizationEnabled as jest.Mock).mockResolvedValueOnce(
        true,
      );

      const result = await checkPhoneRings();

      const batItem = result.find(i => i.id === 'battery');
      expect(batItem?.problem).toBe('battery_optimised');
    });

    it('safely isolates errors: individual check throwing does not fail other checks', async () => {
      (notifee.getNotificationSettings as jest.Mock).mockRejectedValueOnce(
        new Error('Notification check exploded'),
      );
      (notifee.isChannelBlocked as jest.Mock).mockResolvedValue(false);
      jest.spyOn(phone, 'canUseFullScreenAlert').mockResolvedValueOnce(true);
      jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
        ringerMode: 'normal',
        doNotDisturb: false,
      });
      (notifee.isBatteryOptimizationEnabled as jest.Mock).mockResolvedValueOnce(
        false,
      );

      const result = await checkPhoneRings();

      expect(result.find(i => i.id === 'notifications')?.problem).toBeNull();
      expect(result.find(i => i.id === 'battery')?.problem).toBeNull();
    });
  });

  describe('openFixFor', () => {
    it('opens Linking.openSettings on non-Android', async () => {
      (Platform as any).OS = 'ios';
      const openSettingsSpy = jest
        .spyOn(Linking, 'openSettings')
        .mockResolvedValueOnce();

      await openFixFor('notifications_off');

      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
      expect(notifee.openNotificationSettings).not.toHaveBeenCalled();
    });

    it('opens notification settings for notifications_off on Android', async () => {
      await openFixFor('notifications_off');
      expect(notifee.openNotificationSettings).toHaveBeenCalledWith();
    });

    it('opens notification settings with blocked channel for offer_alerts_off', async () => {
      (notifee.isChannelBlocked as jest.Mock).mockImplementation(
        async id => id === offerAlert.OFFERS_CHANNEL_ID,
      );

      await openFixFor('offer_alerts_off');

      expect(notifee.openNotificationSettings).toHaveBeenCalledWith(
        offerAlert.OFFERS_CHANNEL_ID,
      );
    });

    it('opens full screen alert settings for full_screen_off', async () => {
      const fsSpy = jest
        .spyOn(phone, 'openFullScreenAlertSettings')
        .mockImplementation();

      await openFixFor('full_screen_off');

      expect(fsSpy).toHaveBeenCalledTimes(1);
    });

    it('opens sound settings for sound problems (silent, vibrate, DND)', async () => {
      const soundSpy = jest
        .spyOn(phone, 'openSoundSettings')
        .mockImplementation();

      await openFixFor('phone_silent');
      await openFixFor('phone_vibrate');
      await openFixFor('do_not_disturb');

      expect(soundSpy).toHaveBeenCalledTimes(3);
    });

    it('opens battery optimization settings for battery_optimised', async () => {
      await openFixFor('battery_optimised');
      expect(notifee.openBatteryOptimizationSettings).toHaveBeenCalledTimes(1);
    });

    it('falls back to Linking.openSettings when opening setting throws', async () => {
      (
        notifee.openBatteryOptimizationSettings as jest.Mock
      ).mockRejectedValueOnce(new Error('Activity not found'));
      const openSettingsSpy = jest
        .spyOn(Linking, 'openSettings')
        .mockResolvedValueOnce();

      await openFixFor('battery_optimised');

      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasRingProblem', () => {
    it('returns false when all items have null problem', () => {
      const items: RingCheckItem[] = [
        { id: 'notifications', problem: null },
        { id: 'sound', problem: null },
      ];
      expect(hasRingProblem(items)).toBe(false);
    });

    it('returns true when at least one item has a problem', () => {
      const items: RingCheckItem[] = [
        { id: 'notifications', problem: null },
        { id: 'sound', problem: 'phone_silent' },
      ];
      expect(hasRingProblem(items)).toBe(true);
    });
  });
});
