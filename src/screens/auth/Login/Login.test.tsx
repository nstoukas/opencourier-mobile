import React from 'react';
import { Alert } from 'react-native';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './Login';
import { Button } from '@app/components/Button/Button';
import { services } from '@app/services/service';
import * as afterLogin from '@app/services/afterLogin';
import * as languageApi from '@app/localization/languageApi';
import * as config from '@app/utilities/config';
import { AuthScreen } from '@app/navigation/auth/types';
import i18n from '@app/localization/i18n';

describe('Login screen (spec 0039, AC-4, AC-5)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;
  let markJustLoggedInSpy: jest.SpyInstance;
  let sendLanguageSpy: jest.SpyInstance;

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    });
    alertSpy = jest.spyOn(Alert, 'alert');
    markJustLoggedInSpy = jest.spyOn(afterLogin, 'markJustLoggedIn');
    sendLanguageSpy = jest
      .spyOn(languageApi, 'sendLanguageToServer')
      .mockImplementation();
  });

  afterEach(() => {
    alertSpy.mockRestore();
    markJustLoggedInSpy.mockRestore();
    sendLanguageSpy.mockRestore();
    queryClient.clear();
  });

  const renderScreen = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <Login navigation={mockNavigation} route={{} as any} />
      </QueryClientProvider>,
    );

  it('no error is shown before an attempt (AC-5)', () => {
    renderScreen();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  describe('Form validation and submission state (AC-5)', () => {
    it('Log in is disabled while email or password is empty, and enabled when both are filled', () => {
      renderScreen();

      const getButton = () => screen.UNSAFE_getByType(Button);
      const emailField = screen.getByPlaceholderText(
        i18n.t('translations:email'),
      );
      const passwordField = screen.getByPlaceholderText(
        i18n.t('translations:password'),
      );

      // Both empty
      expect(getButton().props.disabled).toBe(true);

      // Only email filled
      fireEvent.changeText(emailField, 'rider@example.com');
      expect(getButton().props.disabled).toBe(true);

      // Both filled
      fireEvent.changeText(passwordField, 'secret123');
      expect(getButton().props.disabled).toBe(false);

      // Password cleared
      fireEvent.changeText(passwordField, '');
      expect(getButton().props.disabled).toBe(true);
    });

    it('Log in is disabled while the request runs (AC-5)', async () => {
      let resolveLogin: (res: any) => void = () => {};
      const loginPromise = new Promise(resolve => {
        resolveLogin = resolve;
      });
      jest
        .spyOn(services.userService, 'login')
        .mockImplementation(() => loginPromise as any);

      renderScreen();

      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:email')),
        'rider@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:password')),
        'secret123',
      );

      const button = screen.UNSAFE_getByType(Button);
      expect(button.props.disabled).toBe(false);

      fireEvent.press(screen.getByText(i18n.t('translations:log_in')));

      // While pending, button is disabled
      await waitFor(() => {
        expect(screen.UNSAFE_getByType(Button).props.disabled).toBe(true);
      });

      resolveLogin({
        result: { session: { accessToken: 'tok', refreshToken: 'ref' } },
      });
      await waitFor(() => {
        expect(markJustLoggedInSpy).toHaveBeenCalled();
        expect(sendLanguageSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Error alerts with exact sentences (AC-5)', () => {
    it('403 shows "That email and password don\'t match. Try again, or reset your password."', async () => {
      const error403: any = new Error('403 Forbidden');
      error403.response = { status: 403, data: {} };
      jest.spyOn(services.userService, 'login').mockRejectedValue(error403);

      renderScreen();

      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:email')),
        'rider@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:password')),
        'wrongpass',
      );
      fireEvent.press(screen.getByText(i18n.t('translations:log_in')));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "That didn't work",
          "That email and password don't match. Try again, or reset your password.",
        );
      });
    });

    it('429 shows "Too many tries. Wait a minute and try again."', async () => {
      const error429: any = new Error('429 Too Many Requests');
      error429.response = { status: 429, data: {} };
      jest.spyOn(services.userService, 'login').mockRejectedValue(error429);

      renderScreen();

      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:email')),
        'rider@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:password')),
        'password123',
      );
      fireEvent.press(screen.getByText(i18n.t('translations:log_in')));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "That didn't work",
          'Too many tries. Wait a minute and try again.',
        );
      });
    });

    it('no response shows "No connection. Check your signal and try again."', async () => {
      const errorNetwork: any = new Error('Network error');
      // No error.response
      jest.spyOn(services.userService, 'login').mockRejectedValue(errorNetwork);

      renderScreen();

      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:email')),
        'rider@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:password')),
        'password123',
      );
      fireEvent.press(screen.getByText(i18n.t('translations:log_in')));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "That didn't work",
          'No connection. Check your signal and try again.',
        );
      });
    });

    it('other errors show "Something went wrong. Try again in a minute."', async () => {
      const error500: any = new Error('500 Internal Server Error');
      error500.response = { status: 500, data: {} };
      jest.spyOn(services.userService, 'login').mockRejectedValue(error500);

      renderScreen();

      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:email')),
        'rider@example.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:password')),
        'password123',
      );
      fireEvent.press(screen.getByText(i18n.t('translations:log_in')));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "That didn't work",
          'Something went wrong. Try again in a minute.',
        );
      });
    });
  });

  it('any 2xx is success and marks just logged in (AC-5)', async () => {
    jest.spyOn(services.userService, 'login').mockResolvedValue({
      result: { session: { accessToken: 'a', refreshToken: 'r' } },
    } as any);

    renderScreen();

    fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('translations:email')),
      'rider@example.com',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('translations:password')),
      'goodpassword',
    );
    fireEvent.press(screen.getByText(i18n.t('translations:log_in')));

    await waitFor(() => {
      expect(markJustLoggedInSpy).toHaveBeenCalledTimes(1);
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('navigates to ForgotPassword with trimmed email when link is tapped (AC-6)', () => {
    renderScreen();

    fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('translations:email')),
      '  rider@example.com  ',
    );
    fireEvent.press(screen.getByText(i18n.t('translations:forgot_password')));

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      AuthScreen.ForgotPassword,
      {
        email: 'rider@example.com',
      },
    );
  });

  describe('Release build without a safe address (AC-4)', () => {
    it('shows warning sentence, disables form, and pressing Log in sends no request', () => {
      // Mock hasUsableAddress as false
      const origHasUsable = config.hasUsableAddress;
      (config as any).hasUsableAddress = false;

      const loginSpy = jest.spyOn(services.userService, 'login');

      try {
        renderScreen();

        expect(
          screen.getByText(
            "This app was built without the co-op's address. Tell the co-op.",
          ),
        ).toBeTruthy();

        const emailField = screen.getByPlaceholderText(
          i18n.t('translations:email'),
        );
        const passwordField = screen.getByPlaceholderText(
          i18n.t('translations:password'),
        );
        expect(emailField.props.editable).toBe(false);
        expect(passwordField.props.editable).toBe(false);

        const button = screen.UNSAFE_getByType(Button);
        expect(button.props.disabled).toBe(true);

        fireEvent.press(screen.getByText(i18n.t('translations:log_in')));
        expect(loginSpy).not.toHaveBeenCalled();
      } finally {
        (config as any).hasUsableAddress = origHasUsable;
      }
    });
  });
});
