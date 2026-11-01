import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginInstance } from './LoginInstance';
import i18n from '@app/localization/i18n';

const mockLogin = jest.fn();

jest.mock('@app/services/service', () => ({
  services: {
    userService: {
      login: (...args: any[]) => mockLogin(...args),
    },
  },
}));

jest.mock('@app/hooks/useUser', () => () => ({ user: null }));

describe('LoginInstance (spec 0013 AC-7: no public sign up; forgot password as text)', () => {
  let queryClient: QueryClient;

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockInstance: any = {
    id: 'test-instance',
    details: {
      name: 'Volos Courier Co-op',
      userCount: 8,
      imageUrl: 'https://example.com/logo.png',
      link: 'https://volos.opencourier.org',
    },
  };

  const mockRoute: any = {
    params: {
      instance: mockInstance,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderScreen = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <LoginInstance navigation={mockNavigation} route={mockRoute} />
      </QueryClientProvider>,
    );

  it('login state: renders login form with NO "Don\'t have an account?" or Join link', () => {
    renderScreen();

    // Login form fields are present
    expect(
      screen.getByPlaceholderText(i18n.t('translations:email_address')),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(i18n.t('translations:password')),
    ).toBeTruthy();
    expect(screen.getByText(i18n.t('translations:log_in'))).toBeTruthy();

    // Spec 0013 AC-7: No "Don't have an account?" or Join link in login state
    expect(screen.queryByText(i18n.t('translations:no_account'))).toBeNull();
    expect(screen.queryByText(/don't have an account/i)).toBeNull();
    expect(screen.queryByText(i18n.t('translations:join_instance'))).toBeNull();
    expect(screen.queryByText(/join/i)).toBeNull();

    // Forgot password trigger is visible
    expect(
      screen.getByText(new RegExp(i18n.t('translations:forgot_password'), 'i')),
    ).toBeTruthy();
  });

  it('forgot password state: shows ask_coop_for_password text, no email field, no Send Reset Link button, and no Join link', () => {
    renderScreen();

    // Press Forgot password / Reset Your Password link
    const forgotPasswordTrigger = screen.getByText(
      new RegExp(i18n.t('translations:reset_password'), 'i'),
    );
    fireEvent.press(forgotPasswordTrigger);

    // Spec 0013 AC-7: shows text only: ask the co-op to set a new password
    expect(
      screen.getByText(i18n.t('translations:ask_coop_for_password')),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Ask the co-op to set a new password for you. Your login email stays the same.',
      ),
    ).toBeTruthy();

    // Spec 0013 AC-7: no email field and no Send Reset Link button
    expect(
      screen.queryByPlaceholderText(i18n.t('translations:email_address')),
    ).toBeNull();
    expect(screen.queryByText(i18n.t('translations:send_reset'))).toBeNull();
    expect(screen.queryByText(/send reset/i)).toBeNull();

    // Spec 0013 AC-7: No "Don't have an account?" or Join link in forgot password state
    expect(screen.queryByText(i18n.t('translations:no_account'))).toBeNull();
    expect(screen.queryByText(/don't have an account/i)).toBeNull();
    expect(screen.queryByText(i18n.t('translations:join_instance'))).toBeNull();
    expect(screen.queryByText(/join/i)).toBeNull();

    // "Back to log in" button is present
    expect(screen.getByText(i18n.t('translations:back_to_login'))).toBeTruthy();
  });

  it('pressing "Back to log in" returns to the login form', () => {
    renderScreen();

    // Navigate to forgot password state
    fireEvent.press(
      screen.getByText(new RegExp(i18n.t('translations:reset_password'), 'i')),
    );
    expect(
      screen.getByText(i18n.t('translations:ask_coop_for_password')),
    ).toBeTruthy();

    // Press "Back to log in"
    const backButton = screen.getByText(i18n.t('translations:back_to_login'));
    fireEvent.press(backButton);

    // Returned to login state: login form is restored, password reset notice is gone
    expect(
      screen.getByPlaceholderText(i18n.t('translations:email_address')),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(i18n.t('translations:password')),
    ).toBeTruthy();
    expect(screen.getByText(i18n.t('translations:log_in'))).toBeTruthy();
    expect(
      screen.queryByText(i18n.t('translations:ask_coop_for_password')),
    ).toBeNull();
  });

  it('submits login when email and password are submitted on the login form', async () => {
    mockLogin.mockResolvedValueOnce({
      data: {
        result: {
          session: {
            accessToken: 'token-123',
            refreshToken: 'refresh-123',
            tokenType: 'Bearer',
            expiresIn: 3600,
          },
        },
      },
    });

    renderScreen();

    const emailInput = screen.getByPlaceholderText(
      i18n.t('translations:email_address'),
    );
    const passwordInput = screen.getByPlaceholderText(
      i18n.t('translations:password'),
    );
    const logInButton = screen.getByText(i18n.t('translations:log_in'));

    act(() => {
      fireEvent.changeText(emailInput, 'rider@example.com');
      fireEvent.changeText(passwordInput, 'secretpassword');
    });

    await act(async () => {
      fireEvent.press(logInButton);
    });

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin.mock.calls[0][0]).toEqual({
      email: 'rider@example.com',
      password: 'secretpassword',
    });
  });
});
