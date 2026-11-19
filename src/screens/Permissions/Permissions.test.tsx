import React from 'react';
import { Linking, Platform } from 'react-native';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import { StackActions } from '@react-navigation/native';
import { Permissions } from './Permissions';
import * as permissionsUtil from '@app/utilities/permissions';
import { MainScreens } from '@app/navigation/main/types';
import i18n from '@app/localization/i18n';

describe('Permissions screen (spec 0039, AC-15, decision 17.22, Clause 4)', () => {
  let openSettingsSpy: jest.SpyInstance;
  const originalPlatform = Platform.OS;

  const mockNavigation: any = {
    dispatch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    openSettingsSpy = jest
      .spyOn(Linking, 'openSettings')
      .mockImplementation(() => Promise.resolve() as any);
    jest
      .spyOn(permissionsUtil, 'isApproximateLocationOnly')
      .mockResolvedValue(false);
  });

  afterEach(() => {
    openSettingsSpy.mockRestore();
    Platform.OS = originalPlatform;
  });

  it('if both location and notifications are already granted, immediately navigates to Home (AC-15)', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(true);
    jest
      .spyOn(permissionsUtil, 'isNotificationsGranted')
      .mockResolvedValue(true);

    render(<Permissions navigation={mockNavigation} route={{} as any} />);

    await waitFor(() => {
      expect(mockNavigation.dispatch).toHaveBeenCalledWith(
        StackActions.replace(MainScreens.Drawer),
      );
    });
  });

  it('renders permission cards when at least one permission is not granted', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    jest
      .spyOn(permissionsUtil, 'isNotificationsGranted')
      .mockResolvedValue(true);

    render(<Permissions navigation={mockNavigation} route={{} as any} />);

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('translations:permission_location_title')),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:permission_notifications_title')),
      ).toBeTruthy();
    });

    // Continue button is present
    expect(screen.getByText(i18n.t('translations:continue'))).toBeTruthy();
  });

  it('Continue always navigates to Home (AC-15)', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    jest
      .spyOn(permissionsUtil, 'isNotificationsGranted')
      .mockResolvedValue(false);

    render(<Permissions navigation={mockNavigation} route={{} as any} />);

    const continueButton = await screen.findByText(
      i18n.t('translations:continue'),
    );
    fireEvent.press(continueButton);

    expect(mockNavigation.dispatch).toHaveBeenCalledWith(
      StackActions.replace(MainScreens.Drawer),
    );
  });

  it('Allow shows "Allowed" once permission is granted (AC-15)', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    jest
      .spyOn(permissionsUtil, 'isNotificationsGranted')
      .mockResolvedValue(false);

    Platform.OS = 'android';
    jest
      .spyOn(permissionsUtil, 'requestAndroidLocation')
      .mockResolvedValue('granted');

    render(<Permissions navigation={mockNavigation} route={{} as any} />);

    // Initially "Allow" buttons are shown
    const allowButtons = await screen.findAllByText(
      i18n.t('translations:allow'),
    );
    expect(allowButtons.length).toBeGreaterThanOrEqual(1);

    // Tap Allow on location
    fireEvent.press(allowButtons[0]);

    // Shows "Allowed"
    await waitFor(() => {
      expect(screen.getByText(i18n.t('translations:allowed'))).toBeTruthy();
    });
  });

  it('on Android "never_ask_again" (blocked) Allow opens settings via Linking.openSettings (AC-15)', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    jest
      .spyOn(permissionsUtil, 'isNotificationsGranted')
      .mockResolvedValue(false);

    Platform.OS = 'android';
    jest
      .spyOn(permissionsUtil, 'requestAndroidLocation')
      .mockResolvedValue('blocked');

    render(<Permissions navigation={mockNavigation} route={{} as any} />);

    const allowButtons = await screen.findAllByText(
      i18n.t('translations:allow'),
    );
    fireEvent.press(allowButtons[0]);

    await waitFor(() => {
      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('precise location sentence under location card (decision 17.22, Clause 4)', () => {
    it('shows the precise sentence under location card when only approximate is allowed', async () => {
      jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
      jest
        .spyOn(permissionsUtil, 'isNotificationsGranted')
        .mockResolvedValue(false);
      jest
        .spyOn(permissionsUtil, 'isApproximateLocationOnly')
        .mockResolvedValue(true);

      render(<Permissions navigation={mockNavigation} route={{} as any} />);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Choose Precise location: dispatch and arrival need it.',
          ),
        ).toBeTruthy();
      });
    });

    it('does NOT show the precise sentence when location is allowed', async () => {
      jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(true);
      jest
        .spyOn(permissionsUtil, 'isNotificationsGranted')
        .mockResolvedValue(false);
      jest
        .spyOn(permissionsUtil, 'isApproximateLocationOnly')
        .mockResolvedValue(false);

      render(<Permissions navigation={mockNavigation} route={{} as any} />);

      await waitFor(() => {
        expect(
          screen.getByText(i18n.t('translations:permission_location_title')),
        ).toBeTruthy();
      });

      expect(
        screen.queryByText(
          'Choose Precise location: dispatch and arrival need it.',
        ),
      ).toBeNull();
    });
  });
});
