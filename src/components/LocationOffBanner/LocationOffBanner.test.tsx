import React from 'react';
import { Linking, Platform } from 'react-native';
import {
  render,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react-native';
import '@app/localization/i18n';
import { UserStatus } from '@app/types/types';
import { setLocationOff } from '@app/services/locationOff';
import { LocationOffBanner } from './LocationOffBanner';

describe('LocationOffBanner (Row 156, Clause 1, 3)', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    setLocationOff(false);
  });

  afterEach(() => {
    cleanup();
    Platform.OS = originalPlatform;
    setLocationOff(false);
  });

  it('renders nothing when locationOff is false even while Online', () => {
    setLocationOff(false);
    const { queryByTestId } = render(
      <LocationOffBanner userStatus={UserStatus.Online} />,
    );
    expect(queryByTestId('location-off-banner')).toBeNull();
  });

  it('renders nothing when locationOff is false even on Last call', () => {
    setLocationOff(false);
    const { queryByTestId } = render(
      <LocationOffBanner userStatus={UserStatus.LastCall} />,
    );
    expect(queryByTestId('location-off-banner')).toBeNull();
  });

  it('never shows the banner when Offline even if locationOff is true (Clause 3)', () => {
    setLocationOff(true);
    const { queryByTestId } = render(
      <LocationOffBanner userStatus={UserStatus.Offline} />,
    );
    expect(queryByTestId('location-off-banner')).toBeNull();
  });

  it('renders "Location off" banner and "Turn on" button while Online and locationOff is true (Clause 1)', () => {
    setLocationOff(true);
    const { getByTestId, getByText } = render(
      <LocationOffBanner userStatus={UserStatus.Online} />,
    );

    expect(getByTestId('location-off-banner')).toBeTruthy();
    expect(getByText('Location off')).toBeTruthy();
    expect(getByText('Turn on')).toBeTruthy();
  });

  it('renders banner while on Last call and locationOff is true (Clause 1)', () => {
    setLocationOff(true);
    const { getByTestId, getByText } = render(
      <LocationOffBanner userStatus={UserStatus.LastCall} />,
    );

    expect(getByTestId('location-off-banner')).toBeTruthy();
    expect(getByText('Location off')).toBeTruthy();
    expect(getByText('Turn on')).toBeTruthy();
  });

  it('has accessible button role, accessibility label, and accessibility hint', () => {
    setLocationOff(true);
    const { getByTestId } = render(
      <LocationOffBanner userStatus={UserStatus.Online} />,
    );

    const banner = getByTestId('location-off-banner');
    expect(banner.props.accessibilityRole).toBe('button');
    expect(banner.props.accessibilityLabel).toBe('Location off');
    expect(banner.props.accessibilityHint).toBe(
      "Opens the phone's location settings",
    );
  });

  describe('Press handling and settings navigation (Clause 1)', () => {
    it('pressing banner on Android calls Linking.sendIntent with LOCATION_SOURCE_SETTINGS', async () => {
      Platform.OS = 'android';
      setLocationOff(true);
      const sendIntentSpy = jest
        .spyOn(Linking, 'sendIntent')
        .mockResolvedValue(undefined as any);
      const openSettingsSpy = jest
        .spyOn(Linking, 'openSettings')
        .mockResolvedValue(undefined as any);

      const { getByTestId } = render(
        <LocationOffBanner userStatus={UserStatus.Online} />,
      );

      fireEvent.press(getByTestId('location-off-banner'));

      expect(sendIntentSpy).toHaveBeenCalledWith(
        'android.settings.LOCATION_SOURCE_SETTINGS',
      );
      expect(openSettingsSpy).not.toHaveBeenCalled();
    });

    it('pressing banner on Android falls back to Linking.openSettings when sendIntent rejects', async () => {
      Platform.OS = 'android';
      setLocationOff(true);
      const sendIntentSpy = jest
        .spyOn(Linking, 'sendIntent')
        .mockRejectedValue(new Error('Activity not found'));
      const openSettingsSpy = jest
        .spyOn(Linking, 'openSettings')
        .mockResolvedValue(undefined as any);

      const { getByTestId } = render(
        <LocationOffBanner userStatus={UserStatus.Online} />,
      );

      fireEvent.press(getByTestId('location-off-banner'));

      expect(sendIntentSpy).toHaveBeenCalledWith(
        'android.settings.LOCATION_SOURCE_SETTINGS',
      );
      await waitFor(() => {
        expect(openSettingsSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('pressing banner on iOS opens app settings directly without calling sendIntent', () => {
      Platform.OS = 'ios';
      setLocationOff(true);
      const sendIntentSpy = jest.spyOn(Linking, 'sendIntent');
      const openSettingsSpy = jest
        .spyOn(Linking, 'openSettings')
        .mockResolvedValue(undefined as any);

      const { getByTestId } = render(
        <LocationOffBanner userStatus={UserStatus.Online} />,
      );

      fireEvent.press(getByTestId('location-off-banner'));

      expect(sendIntentSpy).not.toHaveBeenCalled();
      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
    });

    it('logs error if openSettings throws/rejects in fallback', async () => {
      Platform.OS = 'android';
      setLocationOff(true);
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      jest
        .spyOn(Linking, 'sendIntent')
        .mockRejectedValue(new Error('sendIntent failed'));
      const openSettingsError = new Error('openSettings failed');
      jest.spyOn(Linking, 'openSettings').mockRejectedValue(openSettingsError);

      const { getByTestId } = render(
        <LocationOffBanner userStatus={UserStatus.Online} />,
      );

      fireEvent.press(getByTestId('location-off-banner'));

      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Could not open the settings',
          openSettingsError,
        );
      });

      consoleLogSpy.mockRestore();
    });
  });
});
