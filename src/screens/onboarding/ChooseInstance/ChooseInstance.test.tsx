import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { ChooseInstanceScreen } from './ChooseInstance';
import i18n from '@app/localization/i18n';
import UserContext from '@app/context/userContext';

jest.mock('@app/services/Client', () => ({
  client: {
    get: jest.fn(() => Promise.resolve({ data: { instances: [] } })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactActual = require('react');
  return {
    ...actual,
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactActual.useEffect(() => {
        return callback();
      }, [callback]);
    },
  };
});

describe('ChooseInstanceScreen onboarding (row 114: keyboard padding)', () => {
  const originalOS = Platform.OS;
  let consoleLogSpy: jest.SpyInstance;

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
  };

  const mockRoute: any = {
    params: {
      registryLink: 'https://opencourier-registry.org',
    },
  };

  const renderWithContext = () =>
    render(
      <UserContext.Provider
        value={{
          locationPermission: true,
          setLocationPermission: jest.fn(),
          userLatitude: 39.36,
          userLongitude: 22.94,
          setUserLatitude: jest.fn(),
          setUserLongitude: jest.fn(),
        }}>
        <ChooseInstanceScreen navigation={mockNavigation} route={mockRoute} />
      </UserContext.Provider>,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    Platform.OS = originalOS;
  });

  it('renders the choose instance screen with subtitle and search bar', async () => {
    renderWithContext();

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('translations:choose_instance')),
      ).toBeTruthy();
    });
  });

  describe('Keyboard padding on Android as well as iOS (row 114)', () => {
    it('uses behavior "padding" on KeyboardAvoidingView on Android as well as iOS', async () => {
      try {
        // Test Android behavior
        Platform.OS = 'android';
        const androidRender = renderWithContext();
        await waitFor(() => {
          expect(
            androidRender.getByText(i18n.t('translations:choose_instance')),
          ).toBeTruthy();
        });
        const androidKav = androidRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(androidKav.props.behavior).toBe('padding');
        androidRender.unmount();

        // Test iOS behavior
        Platform.OS = 'ios';
        const iosRender = renderWithContext();
        await waitFor(() => {
          expect(
            iosRender.getByText(i18n.t('translations:choose_instance')),
          ).toBeTruthy();
        });
        const iosKav = iosRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(iosKav.props.behavior).toBe('padding');
        iosRender.unmount();
      } finally {
        Platform.OS = originalOS;
      }
    });
  });
});
