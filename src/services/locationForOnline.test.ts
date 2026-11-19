import { Alert, Linking } from 'react-native';
import {
  confirmLocationForOnline,
  showLocationOffAlert,
} from './locationForOnline';
import * as permissionsUtil from '@app/utilities/permissions';
import i18n from '@app/localization/i18n';

describe('confirmLocationForOnline and showLocationOffAlert (spec 0039, AC-16)', () => {
  let alertSpy: jest.SpyInstance;
  let openSettingsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert');
    openSettingsSpy = jest
      .spyOn(Linking, 'openSettings')
      .mockImplementation(() => Promise.resolve() as any);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    openSettingsSpy.mockRestore();
  });

  describe('showLocationOffAlert', () => {
    it('shows exact sentence and options "Open settings" and "Not now"', () => {
      showLocationOffAlert();

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:location_off_title'),
        "Location is off. Dispatch needs your position to offer you jobs, so you can't go Online without it.",
        expect.arrayContaining([
          expect.objectContaining({ text: 'Not now', style: 'cancel' }),
          expect.objectContaining({ text: 'Open settings' }),
        ]),
      );

      // Verify tapping Open settings calls Linking.openSettings()
      const buttons = alertSpy.mock.calls[0][2];
      const openSettingsButton = buttons.find((b: any) => b.text === 'Open settings');
      openSettingsButton.onPress();
      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirmLocationForOnline', () => {
    it('returns true if location is already granted', async () => {
      jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(true);
      const mockRequest = jest.fn();

      const result = await confirmLocationForOnline(mockRequest);

      expect(result).toBe(true);
      expect(mockRequest).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('requests location if not already granted and returns true when granted', async () => {
      jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
      const mockRequest = jest.fn().mockResolvedValue(true);

      const result = await confirmLocationForOnline(mockRequest);

      expect(result).toBe(true);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('refused: shows location off alert and returns false (AC-16)', async () => {
      jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
      const mockRequest = jest.fn().mockResolvedValue(false);

      const result = await confirmLocationForOnline(mockRequest);

      expect(result).toBe(false);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(
        expect.anything(),
        "Location is off. Dispatch needs your position to offer you jobs, so you can't go Online without it.",
        expect.anything(),
      );
    });
  });
});
