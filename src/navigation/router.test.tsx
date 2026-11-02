import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

const mockUseGrantedLocationPermission = jest.fn();
const mockUseLocationPermission = jest.fn(() => ({
  locationPermission: true,
  requestLocationPermission: jest.fn(),
}));
const mockUseLocationTracking = jest.fn();
const mockUseArrivalDetection = jest.fn();
const mockUseOfferPushRegistration = jest.fn();
const mockUseUser = jest.fn(() => ({
  user: { id: 'courier-1', name: 'Courier' },
}));

jest.mock('@app/hooks/useLocationPermission', () => ({
  useGrantedLocationPermission: () => mockUseGrantedLocationPermission(),
  useLocationPermission: () => mockUseLocationPermission(),
}));

jest.mock('@app/hooks/useLocationTracking', () => ({
  useLocationTracking: (...args: any[]) => mockUseLocationTracking(...args),
}));

jest.mock('@app/hooks/useArrivalDetection', () => ({
  useArrivalDetection: (...args: any[]) => mockUseArrivalDetection(...args),
}));

jest.mock('@app/services/offerPush/registration', () => ({
  useOfferPushRegistration: (...args: any[]) =>
    mockUseOfferPushRegistration(...args),
}));

jest.mock('@app/hooks/useUser', () => () => mockUseUser());

jest.mock('./main/MainNavigation', () => {
  const { View } = require('react-native');
  return {
    MainStack: () => <View testID="mock-main-stack" />,
  };
});

jest.mock('./onboarding/OnboardingNavigation', () => {
  const { View } = require('react-native');
  return {
    OnboardingStack: () => <View testID="mock-onboarding-stack" />,
  };
});

jest.mock('@app/screens/Loading/Loading', () => {
  const { View } = require('react-native');
  return {
    LoadingScreen: () => <View testID="mock-loading" />,
  };
});

jest.mock(
  '@app/screens/SelectOrganizationModal/SelectOrganizationModal',
  () => {
    const { View } = require('react-native');
    return {
      SelectOrganizationModal: () => <View testID="mock-select-org" />,
    };
  },
);

jest.mock('@app/screens/StatusPopup/StatusPopupScreen', () => {
  const { View } = require('react-native');
  return {
    StatusPopupScreen: () => <View testID="mock-status-popup" />,
  };
});

jest.mock('@app/screens/AddNote/AddNote', () => {
  const { View } = require('react-native');
  return {
    AddNote: () => <View testID="mock-add-note" />,
  };
});

jest.mock('@app/screens/DeleteNote/DeleteNote', () => {
  const { View } = require('react-native');
  return {
    DeleteNote: () => <View testID="mock-delete-note" />,
  };
});

jest.mock('@app/screens/DatePicker/DatePicker', () => {
  const { View } = require('react-native');
  return {
    DatePickerScreen: () => <View testID="mock-date-picker" />,
  };
});

import { Router } from './router';

describe('Router (Row 67, Ruling: one permission reader)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls useGrantedLocationPermission exactly once when rendered', () => {
    render(
      <NavigationContainer>
        <Router />
      </NavigationContainer>,
    );

    expect(mockUseGrantedLocationPermission).toHaveBeenCalledTimes(1);
    expect(mockUseArrivalDetection).toHaveBeenCalledWith('courier-1');
  });

  it('runs arrival detection via ArrivalDetector with undefined when no user is logged in (spec 0021, review nit)', () => {
    mockUseUser.mockReturnValueOnce({ user: undefined as any });

    render(
      <NavigationContainer>
        <Router />
      </NavigationContainer>,
    );

    expect(mockUseArrivalDetection).toHaveBeenCalledWith(undefined);
  });
});
