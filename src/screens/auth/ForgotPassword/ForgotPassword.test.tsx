import React from 'react';
import { Alert } from 'react-native';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ForgotPassword } from './ForgotPassword';
import { services } from '@app/services/service';
import { Button } from '@app/components/Button/Button';
import { AuthScreen } from '@app/navigation/auth/types';
import i18n from '@app/localization/i18n';

describe('ForgotPassword screen (spec 0039, AC-6)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;

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
  });

  afterEach(() => {
    alertSpy.mockRestore();
    queryClient.clear();
  });

  const renderScreen = (emailParam: string = '') =>
    render(
      <QueryClientProvider client={queryClient}>
        <ForgotPassword
          navigation={mockNavigation}
          route={{ params: { email: emailParam } } as any}
        />
      </QueryClientProvider>,
    );

  it('opens with the typed email filled in from navigation params (AC-6)', () => {
    renderScreen('typed-rider@example.com');

    const emailField = screen.getByPlaceholderText(
      i18n.t('translations:email'),
    );
    expect(emailField.props.value).toBe('typed-rider@example.com');
  });

  it('Send code is disabled until the email looks like a valid email (AC-6)', () => {
    renderScreen('');

    const emailField = screen.getByPlaceholderText(
      i18n.t('translations:email'),
    );
    const getButton = () => screen.UNSAFE_getByType(Button);

    // Empty
    expect(getButton().props.disabled).toBe(true);

    // Invalid email
    fireEvent.changeText(emailField, 'notanemail');
    expect(getButton().props.disabled).toBe(true);

    fireEvent.changeText(emailField, 'missingatsign.com');
    expect(getButton().props.disabled).toBe(true);

    // Valid email
    fireEvent.changeText(emailField, 'rider@example.com');
    expect(getButton().props.disabled).toBe(false);
  });

  it('any 2xx opens Enter code screen with the email (AC-6)', async () => {
    const forgotSpy = jest
      .spyOn(services.userService, 'forgotPassword')
      .mockResolvedValue(undefined);

    renderScreen('rider@example.com');

    const sendButton = screen.getByText(i18n.t('translations:send_code'));
    fireEvent.press(sendButton);

    await waitFor(() => {
      expect(forgotSpy).toHaveBeenCalledWith(
        'rider@example.com',
        expect.anything(),
      );
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        AuthScreen.EnterCode,
        {
          email: 'rider@example.com',
        },
      );
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('503 shows "Reset by email isn\'t set up yet. Ask the co-op to set a new password." and stays on screen (AC-6)', async () => {
    const error503: any = new Error('503 Service Unavailable');
    error503.response = { status: 503, data: {} };
    jest
      .spyOn(services.userService, 'forgotPassword')
      .mockRejectedValue(error503);

    renderScreen('rider@example.com');

    fireEvent.press(screen.getByText(i18n.t('translations:send_code')));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "That didn't work",
        "Reset by email isn't set up yet. Ask the co-op to set a new password.",
      );
    });

    // Stays on screen
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('429 shows "Too many tries. Wait a minute and try again." and stays on screen (AC-6)', async () => {
    const error429: any = new Error('429 Too Many Requests');
    error429.response = { status: 429, data: {} };
    jest
      .spyOn(services.userService, 'forgotPassword')
      .mockRejectedValue(error429);

    renderScreen('rider@example.com');

    fireEvent.press(screen.getByText(i18n.t('translations:send_code')));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "That didn't work",
        'Too many tries. Wait a minute and try again.',
      );
    });

    // Stays on screen
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('no response shows "No connection. Check your signal and try again." (AC-6)', async () => {
    const errorNetwork: any = new Error('Network error');
    jest
      .spyOn(services.userService, 'forgotPassword')
      .mockRejectedValue(errorNetwork);

    renderScreen('rider@example.com');

    fireEvent.press(screen.getByText(i18n.t('translations:send_code')));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "That didn't work",
        'No connection. Check your signal and try again.',
      );
    });

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});
