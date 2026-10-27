import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SettingsScreen } from './Settings';
import { MainScreens } from '@app/navigation/main/types';
import i18n from '@app/localization/i18n';

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

describe('SettingsScreen (Row 18, settings trimmed to wishlist item 35)', () => {
  const mockNavigation: any = {
    toggleDrawer: jest.fn(),
    navigate: jest.fn(),
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
