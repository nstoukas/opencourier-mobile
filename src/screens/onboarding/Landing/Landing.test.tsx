import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import PagerView from 'react-native-pager-view';
import { LandingScreen } from './Landing';
import i18n from '@app/localization/i18n';

const mockRequestLocationPermission = jest.fn();
const mockRequestUserPermission = jest.fn();

jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: false,
    requestLocationPermission: mockRequestLocationPermission,
  }),
}));

jest.mock('@app/services/notifications', () => ({
  __esModule: true,
  default: () => ({
    requestUserPermission: mockRequestUserPermission,
    permissionsGiven: false,
  }),
}));

jest.mock('react-native-page-indicator', () => {
  const ReactActual = require('react');
  const { View: MockView } = require('react-native');
  return {
    PageIndicator: (props: any) =>
      ReactActual.createElement(MockView, {
        ...props,
        testID: 'page-indicator',
      }),
  };
});

describe('LandingScreen onboarding (Row 18, no photos / no camera)', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders exactly 5 pages: support locals, earn money, reach goals, location, notifications (and no camera page)', () => {
    render(<LandingScreen navigation={mockNavigation} route={{} as any} />);

    // 1. Support locals
    expect(
      screen.getByText(i18n.t('translations:support_locals')),
    ).toBeTruthy();

    // 2. Earn money
    expect(screen.getByText(i18n.t('translations:earn_money'))).toBeTruthy();

    // 3. Reach goals
    expect(screen.getByText(i18n.t('translations:reach_goals'))).toBeTruthy();

    // 4. Location
    expect(
      screen.getByText(i18n.t('translations:enable_location')),
    ).toBeTruthy();

    // 5. Notifications
    expect(
      screen.getByText(i18n.t('translations:enable_notifications')),
    ).toBeTruthy();

    // Indicator count is exactly 5
    expect(screen.getByTestId('page-indicator').props.count).toBe(5);

    // No camera page
    expect(screen.queryByText(i18n.t('translations:enable_camera'))).toBeNull();
    expect(screen.queryByText(/enable.*camera/i)).toBeNull();
    expect(screen.queryByText(/camera/i)).toBeNull();
  });

  it('on page 4 the permission button asks for notifications (requestUserPermission), not camera', () => {
    const { UNSAFE_getByType } = render(
      <LandingScreen navigation={mockNavigation} route={{} as any} />,
    );

    // Transition to page 4 (notifications page)
    const pager = UNSAFE_getByType(PagerView);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 4 } });

    // The permission button is rendered with "Allow"
    const allowButton = screen.getByText(i18n.t('translations:allow'));
    expect(allowButton).toBeTruthy();

    // Pressing it asks for notifications permission
    fireEvent.press(allowButton);

    expect(mockRequestUserPermission).toHaveBeenCalledTimes(1);
    expect(mockRequestLocationPermission).not.toHaveBeenCalled();
  });
});
