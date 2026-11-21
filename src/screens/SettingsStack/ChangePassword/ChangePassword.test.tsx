import React from 'react';
import { Alert } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import messaging from '@react-native-firebase/messaging';
import i18n from '@app/localization/i18n';
import { Button } from '@app/components/Button/Button';
import { changePassword } from '@app/services/account/accountApi';
import { ChangePassword, PASSWORD_MAX, PASSWORD_MIN } from './ChangePassword';

jest.mock('@app/services/account/accountApi', () => ({
  changePassword: jest.fn(),
}));

const mockChangePassword = changePassword as jest.Mock;

// Spec 0051 (AC-8, cross check 13): the rider changes their own password after giving the current one.
// The new one follows the existing rules (8 to 72 characters); a refusal is shown in the server's own
// sentence; this phone's push token goes along so it keeps its offer pushes.
describe('ChangePassword screen (spec 0051, AC-8)', () => {
  let alertSpy: jest.SpyInstance;
  const navigation: any = { goBack: jest.fn() };

  const refusal = (message: string, status = 400) => ({
    response: {
      status,
      data: {
        error: true,
        result: [{ code: 'BAD_REQUEST', message, statusCode: status }],
      },
    },
  });

  const currentBox = () =>
    screen.getByPlaceholderText(i18n.t('translations:password_current'));
  const newBox = () =>
    screen.getByPlaceholderText(i18n.t('translations:password_new'));
  const againBox = () =>
    screen.getByPlaceholderText(i18n.t('translations:password_new_again'));
  const saveButton = () => screen.UNSAFE_getByType(Button);
  const fill = (current: string, next: string, again: string) => {
    fireEvent.changeText(currentBox(), current);
    fireEvent.changeText(newBox(), next);
    fireEvent.changeText(againBox(), again);
  };
  const renderScreen = () =>
    render(<ChangePassword navigation={navigation} route={{} as any} />);

  beforeEach(() => {
    jest.clearAllMocks();
    mockChangePassword.mockResolvedValue(undefined);
    (messaging().getToken as jest.Mock).mockResolvedValue('token-this-phone');
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  describe('the length rule: 8 to 72 characters', () => {
    it('the rule is 8 to 72', () => {
      expect(PASSWORD_MIN).toBe(8);
      expect(PASSWORD_MAX).toBe(72);
    });

    it('a new password of 7 characters cannot be saved and says "8 to 72 characters"', () => {
      renderScreen();

      fill('current-password', '1234567', '1234567');

      expect(saveButton().props.disabled).toBe(true);
      expect(screen.getByText('8 to 72 characters')).toBeTruthy();
      fireEvent(saveButton(), 'press');
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('8 characters and 72 characters can be saved, with no rule shown', () => {
      renderScreen();

      fill('current-password', '12345678', '12345678');
      expect(saveButton().props.disabled).toBe(false);
      expect(screen.queryByText('8 to 72 characters')).toBeNull();

      fill('current-password', 'x'.repeat(72), 'x'.repeat(72));
      expect(saveButton().props.disabled).toBe(false);
    });

    it('73 characters cannot be saved', () => {
      renderScreen();

      fill('current-password', 'x'.repeat(73), 'x'.repeat(73));

      expect(saveButton().props.disabled).toBe(true);
      expect(newBox().props.maxLength).toBe(72);
    });

    it('nothing is shown as wrong before the rider types', () => {
      renderScreen();

      expect(saveButton().props.disabled).toBe(true);
      expect(screen.queryByText('8 to 72 characters')).toBeNull();
      expect(
        screen.queryByText('The two new passwords are not the same.'),
      ).toBeNull();
      expect(screen.queryByTestId('change-password-error')).toBeNull();
    });
  });

  describe('the two new passwords must match', () => {
    it('a mismatch cannot be saved and says so', () => {
      renderScreen();

      fill('current-password', 'a-new-password', 'a-new-passwore');

      expect(saveButton().props.disabled).toBe(true);
      expect(
        screen.getByText('The two new passwords are not the same.'),
      ).toBeTruthy();
      fireEvent(saveButton(), 'press');
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('once they match, the words go and it can be saved', () => {
      renderScreen();

      fill('current-password', 'a-new-password', 'a-new-passwore');
      fireEvent.changeText(againBox(), 'a-new-password');

      expect(
        screen.queryByText('The two new passwords are not the same.'),
      ).toBeNull();
      expect(saveButton().props.disabled).toBe(false);
    });

    it('the second box left empty cannot be saved', () => {
      renderScreen();

      fill('current-password', 'a-new-password', '');

      expect(saveButton().props.disabled).toBe(true);
    });
  });

  it('the current password is needed', () => {
    renderScreen();

    fill('', 'a-new-password', 'a-new-password');

    expect(saveButton().props.disabled).toBe(true);
  });

  it('all three boxes hide what is typed', () => {
    renderScreen();

    for (const box of [currentBox(), newBox(), againBox()]) {
      expect(box.props.secureTextEntry).toBe(true);
    }
  });

  describe('saving', () => {
    it("sends the current password, the new one and this phone's push token, once", async () => {
      renderScreen();
      fill('current-password', 'a-new-password', 'a-new-password');

      fireEvent(saveButton(), 'press');

      await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: 'current-password',
        newPassword: 'a-new-password',
        pushToken: 'token-this-phone',
      });
    });

    it('on success says the password is changed and the other phones are signed out, then goes back', async () => {
      renderScreen();
      fill('current-password', 'a-new-password', 'a-new-password');

      fireEvent(saveButton(), 'press');

      await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
      expect(alertSpy).toHaveBeenCalledWith(
        'Your password is changed. Your other phones are signed out.',
      );
      expect(screen.queryByTestId('change-password-error')).toBeNull();
    });

    it('a phone with no push token still changes the password, sending none', async () => {
      (messaging().getToken as jest.Mock).mockRejectedValue(
        new Error('no firebase'),
      );
      renderScreen();
      fill('current-password', 'a-new-password', 'a-new-password');

      fireEvent(saveButton(), 'press');

      await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));
      expect(mockChangePassword.mock.calls[0][0]).toEqual({
        currentPassword: 'current-password',
        newPassword: 'a-new-password',
        pushToken: undefined,
      });
    });

    it.each([
      'Your current password is not right.',
      'Your new password must be different from the current one.',
      'Too many wrong passwords. Try again in an hour.',
    ])(
      'a refusal shows the server\'s own sentence ("%s") and stays on the screen',
      async sentence => {
        mockChangePassword.mockRejectedValue(refusal(sentence));
        renderScreen();
        fill('current-password', 'a-new-password', 'a-new-password');

        fireEvent(saveButton(), 'press');

        const error = await screen.findByTestId('change-password-error');
        expect(error.props.children).toBe(sentence);
        expect(navigation.goBack).not.toHaveBeenCalled();
        expect(alertSpy).not.toHaveBeenCalled();
        // The rider can try again.
        await waitFor(() => expect(saveButton().props.disabled).toBe(false));
      },
    );

    it('a failure with no sentence from the server (no signal) says so in words', async () => {
      mockChangePassword.mockRejectedValue(new Error('Network Error'));
      renderScreen();
      fill('current-password', 'a-new-password', 'a-new-password');

      fireEvent(saveButton(), 'press');

      const error = await screen.findByTestId('change-password-error');
      expect(error.props.children).toBe(
        'The password could not be changed. Try again.',
      );
      expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('an old refusal is cleared when the rider saves again and it works', async () => {
      mockChangePassword.mockRejectedValueOnce(
        refusal('Your current password is not right.'),
      );
      renderScreen();
      fill('not-it', 'a-new-password', 'a-new-password');
      fireEvent(saveButton(), 'press');
      await screen.findByTestId('change-password-error');

      fireEvent.changeText(currentBox(), 'current-password');
      await waitFor(() => expect(saveButton().props.disabled).toBe(false));
      fireEvent(saveButton(), 'press');

      await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId('change-password-error')).toBeNull();
      expect(mockChangePassword).toHaveBeenCalledTimes(2);
    });

    it('while the request runs the button is off, so it is not sent twice', async () => {
      let finish: () => void = () => {};
      mockChangePassword.mockImplementation(
        () => new Promise<void>(resolve => (finish = resolve)),
      );
      renderScreen();
      fill('current-password', 'a-new-password', 'a-new-password');

      fireEvent(saveButton(), 'press');

      await waitFor(() => expect(saveButton().props.disabled).toBe(true));
      fireEvent(saveButton(), 'press');
      finish();
      await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
      expect(mockChangePassword).toHaveBeenCalledTimes(1);
    });
  });
});
