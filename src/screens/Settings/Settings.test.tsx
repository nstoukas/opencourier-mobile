import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { SettingsScreen } from './Settings';
import { MainScreens } from '@app/navigation/main/types';
import i18n from '@app/localization/i18n';
import { MapLinkingOptions } from '@app/types/types';
import * as mapPreferences from '@app/services/mapPreferences';

// SectionList virtualizes items in Jest; render all items so every setting is visible
jest.mock('react-native/Libraries/Lists/SectionList', () => {
  const { View: MockView } = require('react-native');
  const MockSectionList = ({
    sections,
    renderItem,
    renderSectionHeader,
  }: any) => (
    <MockView testID="mock-section-list">
      {sections.map((section: any, sectionIdx: number) => (
        <MockView key={`section-${sectionIdx}`}>
          {renderSectionHeader ? renderSectionHeader({ section }) : null}
          {section.data.map((item: any, itemIdx: number) => (
            <MockView key={`item-${sectionIdx}-${itemIdx}`}>
              {renderItem({ item, index: itemIdx, section })}
            </MockView>
          ))}
        </MockView>
      ))}
    </MockView>
  );
  return {
    __esModule: true,
    default: MockSectionList,
  };
});

describe('SettingsScreen (Row 18, settings trimmed to wishlist item 35; spec 0018 AC-12)', () => {
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

  const removedKeys = [
    'accessibility',
    'earning_method',
    'theme',
    'cuisine_types',
    'restaurant_types',
    'order_types',
    'weight_order',
    'include_orders_drinks',
    'rushed_orders',
    'delivery_bag',
  ];

  const keptKeys = [
    'account_information',
    'emergency_contact',
    'language',
    'navigation',
    'specify_operating',
    'vehicle_type',
    'verification',
    'notifications',
    'cash_on_delivery',
    'shift_availability',
    'licenses',
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    focusListeners = [];
  });

  it('Navigation row subtitle is "Ask every time" when no app is saved', async () => {
    jest.spyOn(mapPreferences, 'getNavigationApp').mockResolvedValue(null);

    const { findByText } = render(
      <SettingsScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('Ask every time')).toBeTruthy();
  });

  it('Navigation row subtitle is "Google Maps" when Google Maps is saved', async () => {
    jest
      .spyOn(mapPreferences, 'getNavigationApp')
      .mockResolvedValue(MapLinkingOptions.google);

    const { findByText } = render(
      <SettingsScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('Google Maps')).toBeTruthy();
  });

  it('Navigation row subtitle is "Waze" when Waze is saved', async () => {
    jest
      .spyOn(mapPreferences, 'getNavigationApp')
      .mockResolvedValue(MapLinkingOptions.waze);

    const { findByText } = render(
      <SettingsScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('Waze')).toBeTruthy();
  });

  it('Navigation row subtitle is read again on the navigation focus event', async () => {
    const getAppSpy = jest
      .spyOn(mapPreferences, 'getNavigationApp')
      .mockResolvedValue(null);

    const { findByText, queryByText } = render(
      <SettingsScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('Ask every time')).toBeTruthy();

    getAppSpy.mockResolvedValue(MapLinkingOptions.google);
    expect(focusListeners.length).toBeGreaterThan(0);

    await act(async () => {
      focusListeners.forEach(listener => listener());
    });

    expect(await findByText('Google Maps')).toBeTruthy();
    expect(queryByText('Ask every time')).toBeNull();
  });

  it('none of the removed settings rows renders', () => {
    render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);

    for (const key of removedKeys) {
      const translated = i18n.t(`translations:${key}`);
      expect(screen.queryByText(translated)).toBeNull();
      expect(screen.queryByText(key)).toBeNull();
    }
  });

  it('all kept settings rows render', () => {
    render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);

    for (const key of keptKeys) {
      const translated = i18n.t(`translations:${key}`);
      expect(screen.getByText(translated)).toBeTruthy();
    }
  });

  it('pressing a kept setting row navigates to its screen', () => {
    render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);

    const operatingAreaTitle = i18n.t('translations:specify_operating');
    fireEvent.press(screen.getByText(operatingAreaTitle));

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      MainScreens.OperatingArea,
    );
  });
});
