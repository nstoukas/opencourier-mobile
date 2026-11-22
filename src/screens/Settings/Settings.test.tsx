import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { SettingsScreen, SETTINGS_ROWS } from './Settings';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { MainScreens } from '@app/navigation/main/types';
import i18n from '@app/localization/i18n';
import { MapLinkingOptions, SettingsOptions } from '@app/types/types';
import { OrderSetting } from '@app/types/enums';
import * as mapPreferences from '@app/services/mapPreferences';
import useUser from '@app/hooks/useUser';
import { useRingCheck } from '@app/hooks/useRingCheck';

jest.mock('@app/hooks/useUser');
jest.mock('@app/hooks/useRingCheck');

describe('SettingsScreen (Row 84: settings trimmed to six, wishlist item 35)', () => {
  let focusListeners: Array<() => void> = [];
  const mockNavigation: any = {
    toggleDrawer: jest.fn(),
    navigate: jest.fn(),
    addListener: jest.fn((event: string, callback: () => void) => {
      if (event === 'focus') {
        focusListeners.push(callback);
      }
      return () => {
        focusListeners = focusListeners.filter(cb => cb !== callback);
      };
    }),
  };

  const mockUpdateDeliverySettings = jest.fn();
  let mockUser: any;
  let mockIsSavingDeliverySetting = false;
  let mockRingCheckItems: any = null;

  beforeEach(() => {
    jest.clearAllMocks();
    focusListeners = [];
    mockUser = {
      id: 'rider-1',
      deliverySetting: OrderSetting.manual,
    };
    mockIsSavingDeliverySetting = false;
    mockRingCheckItems = [
      { id: 'notifications', problem: null },
      { id: 'offer_alerts', problem: null },
      { id: 'full_screen', problem: null },
      { id: 'sound', problem: null },
      { id: 'battery', problem: null },
    ];

    (useUser as jest.Mock).mockImplementation(() => ({
      user: mockUser,
      updateDeliverySettings: mockUpdateDeliverySettings,
      isSavingDeliverySetting: mockIsSavingDeliverySetting,
    }));

    (useRingCheck as jest.Mock).mockImplementation(() => ({
      items: mockRingCheckItems,
      recheck: jest.fn(),
    }));

    jest.spyOn(mapPreferences, 'getNavigationApp').mockResolvedValue(null);
  });

  it('SETTINGS_ROWS contains exactly six rows in order', () => {
    expect(SETTINGS_ROWS).toEqual([
      SettingsOptions.language,
      SettingsOptions.navigation,
      SettingsOptions.offerSound,
      SettingsOptions.autoAccept,
      SettingsOptions.emergencyContact,
      SettingsOptions.ringCheck,
    ]);
    expect(SETTINGS_ROWS.length).toBe(6);
  });

  it('renders all six settings rows and none of the removed ones', () => {
    render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);

    // The six kept settings titles
    for (const row of SETTINGS_ROWS) {
      const translated = i18n.t(`translations:${row}`);
      expect(screen.getByText(translated)).toBeTruthy();
    }

    // Removed upstream settings must not render
    const removedKeys = [
      'specify_operating',
      'vehicle_type',
      'verification',
      'notifications',
      'cash_on_delivery',
      'shift_availability',
      'account_information',
      'theme',
      'cuisine_types',
      'restaurant_types',
      'order_types',
      'weight_order',
    ];
    for (const key of removedKeys) {
      const translated = i18n.t(`translations:${key}`);
      expect(screen.queryByText(translated)).toBeNull();
    }
  });

  describe('navigation row', () => {
    it('shows "Ask every time" when no app is saved', async () => {
      jest.spyOn(mapPreferences, 'getNavigationApp').mockResolvedValue(null);
      const { findByText } = render(
        <SettingsScreen navigation={mockNavigation} route={{} as any} />,
      );
      expect(await findByText('Ask every time')).toBeTruthy();
    });

    it('shows "Google Maps" when Google Maps is saved', async () => {
      jest
        .spyOn(mapPreferences, 'getNavigationApp')
        .mockResolvedValue(MapLinkingOptions.google);
      const { findByText } = render(
        <SettingsScreen navigation={mockNavigation} route={{} as any} />,
      );
      expect(await findByText('Google Maps')).toBeTruthy();
    });

    it('shows "Waze" when Waze is saved', async () => {
      jest
        .spyOn(mapPreferences, 'getNavigationApp')
        .mockResolvedValue(MapLinkingOptions.waze);
      const { findByText } = render(
        <SettingsScreen navigation={mockNavigation} route={{} as any} />,
      );
      expect(await findByText('Waze')).toBeTruthy();
    });

    it('re-reads navigation app on focus event', async () => {
      const getAppSpy = jest
        .spyOn(mapPreferences, 'getNavigationApp')
        .mockResolvedValue(null);

      const { findByText, queryByText } = render(
        <SettingsScreen navigation={mockNavigation} route={{} as any} />,
      );
      expect(await findByText('Ask every time')).toBeTruthy();

      getAppSpy.mockResolvedValue(MapLinkingOptions.google);
      await act(async () => {
        focusListeners.forEach(listener => listener());
      });

      expect(await findByText('Google Maps')).toBeTruthy();
      expect(queryByText('Ask every time')).toBeNull();
    });
  });

  describe('row navigation', () => {
    it('navigates to LanguageScreen on language tap', () => {
      render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      fireEvent.press(screen.getByText(i18n.t('translations:language')));
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        MainScreens.LanguageScreen,
      );
    });

    it('navigates to NavigationScreen on navigation tap', () => {
      render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      fireEvent.press(
        screen.getByText(i18n.t(`translations:${SettingsOptions.navigation}`)),
      );
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        MainScreens.NavigationScreen,
      );
    });

    it('navigates to OfferSound on offer sound tap', () => {
      render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      fireEvent.press(screen.getByText(i18n.t('translations:offer_sound')));
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        MainScreens.OfferSound,
      );
    });

    it('navigates to EmergencyContact on emergency contact tap', () => {
      render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      fireEvent.press(
        screen.getByText(i18n.t('translations:emergency_contact')),
      );
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        MainScreens.EmergencyContact,
      );
    });

    it('navigates to RingCheck on ring check tap', () => {
      render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      fireEvent.press(screen.getByText(i18n.t('translations:ring_check')));
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        MainScreens.RingCheck,
      );
    });

    it('toggles drawer when back navigation button is pressed', () => {
      const { UNSAFE_getByType } = render(
        <SettingsScreen navigation={mockNavigation} route={{} as any} />,
      );
      const backButton = UNSAFE_getByType(BackNavButton);
      fireEvent.press(backButton);
      expect(mockNavigation.toggleDrawer).toHaveBeenCalledTimes(1);
    });
  });

  describe('auto accept setting', () => {
    it('shows switch reflecting server state (off when manual)', () => {
      mockUser.deliverySetting = OrderSetting.manual;
      const { getByRole } = render(
        <SettingsScreen navigation={mockNavigation} route={{} as any} />,
      );
      const switchElement = getByRole('switch');
      expect(switchElement.props.value).toBe(false);
    });

    it('shows switch reflecting server state (on when auto_accept)', () => {
      mockUser.deliverySetting = OrderSetting.auto_accept;
      const { getByRole } = render(
        <SettingsScreen navigation={mockNavigation} route={{} as any} />,
      );
      const switchElement = getByRole('switch');
      expect(switchElement.props.value).toBe(true);
    });

    it('toggling switch calls updateDeliverySettings with new setting', () => {
      mockUser.deliverySetting = OrderSetting.manual;
      const { getByRole } = render(
        <SettingsScreen navigation={mockNavigation} route={{} as any} />,
      );
      const switchElement = getByRole('switch');
      fireEvent(switchElement, 'valueChange', true);

      expect(mockUpdateDeliverySettings).toHaveBeenCalledWith(
        OrderSetting.auto_accept,
      );
    });

    it('ignores taps and disables switch while save is in flight (isSavingDeliverySetting)', () => {
      mockIsSavingDeliverySetting = true;
      (useUser as jest.Mock).mockImplementation(() => ({
        user: mockUser,
        updateDeliverySettings: mockUpdateDeliverySettings,
        isSavingDeliverySetting: true,
      }));

      const { getByRole } = render(
        <SettingsScreen navigation={mockNavigation} route={{} as any} />,
      );
      const switchElement = getByRole('switch');
      expect(switchElement.props.disabled).toBe(true);

      fireEvent(switchElement, 'valueChange', true);
      expect(mockUpdateDeliverySettings).not.toHaveBeenCalled();
    });

    it('disables switch when no user is loaded', () => {
      (useUser as jest.Mock).mockImplementation(() => ({
        user: undefined,
        updateDeliverySettings: mockUpdateDeliverySettings,
        isSavingDeliverySetting: false,
      }));

      const { getByRole } = render(
        <SettingsScreen navigation={mockNavigation} route={{} as any} />,
      );
      const switchElement = getByRole('switch');
      expect(switchElement.props.disabled).toBe(true);
    });
  });

  describe('ring check subtitle', () => {
    it('shows "Checking..." when ring check items is null', () => {
      (useRingCheck as jest.Mock).mockImplementation(() => ({
        items: null,
        recheck: jest.fn(),
      }));

      render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      expect(
        screen.getByText(i18n.t('translations:ring_check_checking')),
      ).toBeTruthy();
    });

    it('shows "Ready to ring" when all checks pass', () => {
      (useRingCheck as jest.Mock).mockImplementation(() => ({
        items: [
          { id: 'notifications', problem: null },
          { id: 'sound', problem: null },
        ],
        recheck: jest.fn(),
      }));

      render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      expect(
        screen.getByText(i18n.t('translations:ring_check_all_good')),
      ).toBeTruthy();
    });

    it('shows "Needs fixing" when at least one check finds a problem', () => {
      (useRingCheck as jest.Mock).mockImplementation(() => ({
        items: [
          { id: 'notifications', problem: 'notifications_off' },
          { id: 'sound', problem: null },
        ],
        recheck: jest.fn(),
      }));

      render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      expect(
        screen.getByText(i18n.t('translations:ring_check_needs_fixing')),
      ).toBeTruthy();
    });
  });
});
