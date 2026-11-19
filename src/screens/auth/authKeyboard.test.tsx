import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './Login/Login';
import { ForgotPassword } from './ForgotPassword/ForgotPassword';
import { EnterCode } from './EnterCode/EnterCode';
import '@app/localization/i18n';

describe('Auth screens keyboard padding (row 114, spec 0039, AC-17)', () => {
  const originalOS = Platform.OS;
  let queryClient: QueryClient;

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    Platform.OS = originalOS;
    queryClient.clear();
  });

  const renderWithProviders = (component: React.ReactElement) =>
    render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);

  describe('Login screen', () => {
    it('uses behavior "padding" on KeyboardAvoidingView on Android as well as iOS', () => {
      try {
        // Android
        Platform.OS = 'android';
        const androidRender = renderWithProviders(
          <Login navigation={mockNavigation} route={{} as any} />,
        );
        const androidKav = androidRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(androidKav.props.behavior).toBe('padding');
        androidRender.unmount();

        // iOS
        Platform.OS = 'ios';
        const iosRender = renderWithProviders(
          <Login navigation={mockNavigation} route={{} as any} />,
        );
        const iosKav = iosRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(iosKav.props.behavior).toBe('padding');
        iosRender.unmount();
      } finally {
        Platform.OS = originalOS;
      }
    });
  });

  describe('ForgotPassword screen', () => {
    it('uses behavior "padding" on KeyboardAvoidingView on Android as well as iOS', () => {
      try {
        // Android
        Platform.OS = 'android';
        const androidRender = renderWithProviders(
          <ForgotPassword
            navigation={mockNavigation}
            route={{ params: { email: 'rider@example.com' } } as any}
          />,
        );
        const androidKav = androidRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(androidKav.props.behavior).toBe('padding');
        androidRender.unmount();

        // iOS
        Platform.OS = 'ios';
        const iosRender = renderWithProviders(
          <ForgotPassword
            navigation={mockNavigation}
            route={{ params: { email: 'rider@example.com' } } as any}
          />,
        );
        const iosKav = iosRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(iosKav.props.behavior).toBe('padding');
        iosRender.unmount();
      } finally {
        Platform.OS = originalOS;
      }
    });
  });

  describe('EnterCode screen', () => {
    it('uses behavior "padding" on KeyboardAvoidingView on Android as well as iOS', () => {
      try {
        // Android
        Platform.OS = 'android';
        const androidRender = renderWithProviders(
          <EnterCode
            navigation={mockNavigation}
            route={{ params: { email: 'rider@example.com' } } as any}
          />,
        );
        const androidKav = androidRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(androidKav.props.behavior).toBe('padding');
        androidRender.unmount();

        // iOS
        Platform.OS = 'ios';
        const iosRender = renderWithProviders(
          <EnterCode
            navigation={mockNavigation}
            route={{ params: { email: 'rider@example.com' } } as any}
          />,
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
