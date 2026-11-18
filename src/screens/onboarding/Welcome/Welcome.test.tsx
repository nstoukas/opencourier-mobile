import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { WelcomeScreen } from './Welcome';
import i18n from '@app/localization/i18n';

describe('WelcomeScreen onboarding (row 114: keyboard padding)', () => {
  const originalOS = Platform.OS;

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('renders the welcome title and description', () => {
    render(<WelcomeScreen navigation={mockNavigation} route={{} as any} />);

    expect(screen.getByText(i18n.t('translations:welcome'))).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:looking_for_start')),
    ).toBeTruthy();
  });

  describe('Keyboard padding on Android as well as iOS (row 114)', () => {
    it('uses behavior "padding" on KeyboardAvoidingView on Android as well as iOS', () => {
      try {
        // Test Android behavior
        Platform.OS = 'android';
        const androidRender = render(
          <WelcomeScreen navigation={mockNavigation} route={{} as any} />,
        );
        const androidKav = androidRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(androidKav.props.behavior).toBe('padding');
        androidRender.unmount();

        // Test iOS behavior
        Platform.OS = 'ios';
        const iosRender = render(
          <WelcomeScreen navigation={mockNavigation} route={{} as any} />,
        );
        const iosKav = iosRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(iosKav.props.behavior).toBe('padding');
        iosRender.unmount();
      } finally {
        Platform.OS = originalOS;
      }
    });
  });
});
