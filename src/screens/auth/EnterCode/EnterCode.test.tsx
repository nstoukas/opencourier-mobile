import React from 'react';
import { Alert } from 'react-native';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  EnterCode,
  isCodeComplete,
  isNewPasswordLongEnough,
} from './EnterCode';
import { services } from '@app/services/service';
import * as afterLogin from '@app/services/afterLogin';
import { Button } from '@app/components/Button/Button';
import i18n from '@app/localization/i18n';

describe('EnterCode screen (spec 0039, AC-6, AC-10, AC-11)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;
  let markJustLoggedInSpy: jest.SpyInstance;

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const testEmail = 'rider@example.com';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    });
    alertSpy = jest.spyOn(Alert, 'alert');
    markJustLoggedInSpy = jest.spyOn(afterLogin, 'markJustLoggedIn');
  });

  afterEach(async () => {
    alertSpy.mockRestore();
    markJustLoggedInSpy.mockRestore();
    queryClient.clear();
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  const renderScreen = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <EnterCode
          navigation={mockNavigation}
          route={{ params: { email: testEmail } } as any}
        />
      </QueryClientProvider>,
    );

  describe('Pure validation helpers (AC-10, AC-11)', () => {
    it('isCodeComplete requires exactly 6 digits', () => {
      expect(isCodeComplete('004219')).toBe(true);
      expect(isCodeComplete('123456')).toBe(true);
      expect(isCodeComplete('12345')).toBe(false);
      expect(isCodeComplete('1234567')).toBe(false);
      expect(isCodeComplete('abcdef')).toBe(false);
      expect(isCodeComplete('')).toBe(false);
    });

    it('isNewPasswordLongEnough requires between 8 and 72 characters inclusive', () => {
      expect(isNewPasswordLongEnough('1234567')).toBe(false);
      expect(isNewPasswordLongEnough('12345678')).toBe(true);
      expect(isNewPasswordLongEnough('a'.repeat(72))).toBe(true);
      expect(isNewPasswordLongEnough('a'.repeat(73))).toBe(false);
    });
  });

  it('renders the AC-6 instruction sentence with the email', () => {
    renderScreen();

    const expectedSentence = `If ${testEmail} is a rider's login, a code is on its way. It works for 15 minutes. No mail after a few minutes? Ask the co-op.`;
    expect(screen.getByText(expectedSentence)).toBeTruthy();
  });

  describe('60 second countdown for resending code (AC-6)', () => {
    it('initially disables "Send a new code" with countdown, and enables it only after 60 seconds', () => {
      renderScreen();

      // At 0s: button shows countdown and is disabled
      expect(
        screen.getByText(
          i18n.t('translations:send_new_code_in', { seconds: 60 }),
        ),
      ).toBeTruthy();

      // Advance by 30s
      act(() => {
        jest.advanceTimersByTime(30000);
      });
      expect(
        screen.getByText(
          i18n.t('translations:send_new_code_in', { seconds: 30 }),
        ),
      ).toBeTruthy();

      // Advance another 30s (total 60s)
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // Now wait has reached 0: shows "Send a new code"
      const resendButton = screen.getByText(
        i18n.t('translations:send_new_code'),
      );
      expect(resendButton).toBeTruthy();
    });
  });

  describe('Form submission and validation (AC-10, AC-11)', () => {
    it('"Set password and log in" is disabled until code is 6 digits and password is 8 to 72 characters', () => {
      renderScreen();

      const codeField = screen.getByPlaceholderText(
        i18n.t('translations:code_label'),
      );
      const passwordField = screen.getByPlaceholderText(
        i18n.t('translations:new_password'),
      );
      const getSubmitButton = () => screen.UNSAFE_getByType(Button);

      // Initially disabled
      expect(getSubmitButton().props.disabled).toBe(true);

      // 5-digit code with valid password -> disabled
      fireEvent.changeText(codeField, '00421');
      fireEvent.changeText(passwordField, 'validpassword1');
      expect(getSubmitButton().props.disabled).toBe(true);

      // 6-digit code with 7-character password -> disabled
      fireEvent.changeText(codeField, '004219');
      fireEvent.changeText(passwordField, 'short12');
      expect(getSubmitButton().props.disabled).toBe(true);

      // 6-digit code with 8-character password -> enabled!
      fireEvent.changeText(passwordField, 'validpassword1');
      expect(getSubmitButton().props.disabled).toBe(false);
    });

    it('sends email, code as a string preserving leading zeros, and password (AC-10, AC-11)', async () => {
      const resetSpy = jest
        .spyOn(services.userService, 'resetPassword')
        .mockResolvedValue({
          result: { session: { accessToken: 'a', refreshToken: 'r' } },
        } as any);

      renderScreen();

      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:code_label')),
        '004219',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:new_password')),
        'my-new-password-123',
      );

      fireEvent.press(
        screen.getByText(i18n.t('translations:set_password_and_log_in')),
      );

      await waitFor(() => {
        expect(resetSpy).toHaveBeenCalledWith(
          {
            email: testEmail,
            code: '004219',
            password: 'my-new-password-123',
          },
          expect.anything(),
        );
        expect(markJustLoggedInSpy).toHaveBeenCalledTimes(1);
      });
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('after successful reset, button never resends reset, and if loading user fails, shows retry button that refetches user (Clause 8)', async () => {
      const resetSpy = jest
        .spyOn(services.userService, 'resetPassword')
        .mockResolvedValue({
          result: { session: { accessToken: 'a', refreshToken: 'r' } },
        } as any);

      const getUserSpy = jest
        .spyOn(services.userService, 'getUser')
        .mockRejectedValue(new Error('User fetch network error'));

      renderScreen();

      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:code_label')),
        '004219',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:new_password')),
        'my-new-password-123',
      );

      const submitButton = screen.getByText(
        i18n.t('translations:set_password_and_log_in'),
      );
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(resetSpy).toHaveBeenCalledTimes(1);
      });

      // Pressing again or submitting via keyboard does NOT call resetPassword a second time
      fireEvent.press(submitButton);
      const passwordField = screen.getByPlaceholderText(
        i18n.t('translations:new_password'),
      );
      fireEvent(passwordField, 'submitEditing');
      expect(resetSpy).toHaveBeenCalledTimes(1);

      // When loading user fails, "Password set. Tap to try logging in again" button appears
      const retryButton = await screen.findByText(
        i18n.t('translations:reset_done_try_again'),
      );
      expect(retryButton).toBeTruthy();

      // Pressing retry button refetches the user, does not call resetPassword
      getUserSpy.mockResolvedValueOnce({ id: 'courier-1' } as any);
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(getUserSpy).toHaveBeenCalledTimes(2);
      });
      expect(resetSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling (AC-10, AC-11)', () => {
    it('every 400 shows "That code is wrong or has expired. Ask for a new one."', async () => {
      const error400: any = new Error('400 Bad Request');
      error400.response = { status: 400, data: {} };
      jest
        .spyOn(services.userService, 'resetPassword')
        .mockRejectedValue(error400);

      renderScreen();

      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:code_label')),
        '123456',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:new_password')),
        'new-password-123',
      );

      fireEvent.press(
        screen.getByText(i18n.t('translations:set_password_and_log_in')),
      );

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "That didn't work",
          'That code is wrong or has expired. Ask for a new one.',
        );
      });
    });

    it('429 shows "Too many tries. Wait a minute and try again."', async () => {
      const error429: any = new Error('429 Too Many Requests');
      error429.response = { status: 429, data: {} };
      jest
        .spyOn(services.userService, 'resetPassword')
        .mockRejectedValue(error429);

      renderScreen();

      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:code_label')),
        '123456',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText(i18n.t('translations:new_password')),
        'new-password-123',
      );

      fireEvent.press(
        screen.getByText(i18n.t('translations:set_password_and_log_in')),
      );

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "That didn't work",
          'Too many tries. Wait a minute and try again.',
        );
      });
    });
  });
});
