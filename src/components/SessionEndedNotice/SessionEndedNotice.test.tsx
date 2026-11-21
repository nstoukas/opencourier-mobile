import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '@app/localization/i18n';
import { SessionEndedNotice } from './SessionEndedNotice';
import {
  getSessionEndNotice,
  setSessionEndNotice,
} from '@app/services/account/sessionEndNotice';

// Spec 0051 (AC-9): when the server says why a session ended, the app shows a full screen notice with
// that reason instead of a generic error: the server's own sentence for a deactivated account (it says
// how to reach the co-op), or the credentials words. OK clears it, leaving the login screen.
describe('SessionEndedNotice (spec 0051, AC-9)', () => {
  const SERVER_SENTENCE =
    'Your account was deactivated by the co-op. If you think this is a mistake, call the co-op on +30 24210 12345.';
  const CREDENTIALS_WORDS =
    'Your password or login email was changed. Log in again.';

  afterEach(() => {
    act(() => setSessionEndNotice(null));
  });

  it('shows nothing while no notice is set', () => {
    render(<SessionEndedNotice />);

    expect(screen.queryByTestId('session-ended-notice')).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  it("a deactivated account: shows the server's sentence, word for word, under the deactivated title", () => {
    setSessionEndNotice({ kind: 'deactivated', message: SERVER_SENTENCE });

    render(<SessionEndedNotice />);

    expect(screen.getByTestId('session-ended-notice')).toBeTruthy();
    expect(screen.getByText('Your account was deactivated')).toBeTruthy();
    expect(screen.getByText(SERVER_SENTENCE)).toBeTruthy();
    // Not the generic "login expired" words, and not the credentials ones.
    expect(
      screen.queryByText(i18n.t('translations:session_ended_body')),
    ).toBeNull();
    expect(screen.queryByText(CREDENTIALS_WORDS)).toBeNull();
  });

  it("a deactivated account with no sentence from the server falls back to the app's own words", () => {
    setSessionEndNotice({ kind: 'deactivated', message: null });

    render(<SessionEndedNotice />);

    expect(
      screen.getByText(
        'Your account was deactivated by the co-op. If you think this is a mistake, contact the co-op.',
      ),
    ).toBeTruthy();
  });

  it('changed credentials: shows "Your password or login email was changed. Log in again."', () => {
    setSessionEndNotice({ kind: 'credentials', message: null });

    render(<SessionEndedNotice />);

    expect(screen.getByText(CREDENTIALS_WORDS)).toBeTruthy();
    expect(screen.getByText('Please log in again')).toBeTruthy();
    expect(screen.queryByText('Your account was deactivated')).toBeNull();
  });

  it('changed credentials never shows a deactivated sentence, even if one came along', () => {
    setSessionEndNotice({ kind: 'credentials', message: SERVER_SENTENCE });

    render(<SessionEndedNotice />);

    expect(screen.getByText(CREDENTIALS_WORDS)).toBeTruthy();
    expect(screen.queryByText(SERVER_SENTENCE)).toBeNull();
  });

  it('appears when the notice is set while the app is already on screen', () => {
    render(<SessionEndedNotice />);
    expect(screen.queryByTestId('session-ended-notice')).toBeNull();

    act(() =>
      setSessionEndNotice({ kind: 'deactivated', message: SERVER_SENTENCE }),
    );

    expect(screen.getByText(SERVER_SENTENCE)).toBeTruthy();
  });

  it('OK clears the notice: it is gone from the screen and from the store', () => {
    setSessionEndNotice({ kind: 'deactivated', message: SERVER_SENTENCE });
    render(<SessionEndedNotice />);

    fireEvent.press(screen.getByText('OK'));

    expect(getSessionEndNotice()).toBeNull();
    expect(screen.queryByTestId('session-ended-notice')).toBeNull();
    expect(screen.queryByText(SERVER_SENTENCE)).toBeNull();
  });

  it('the reason is announced as an alert', () => {
    setSessionEndNotice({ kind: 'credentials', message: null });

    render(<SessionEndedNotice />);

    expect(
      screen.UNSAFE_getByProps({ accessibilityRole: 'alert' }),
    ).toBeTruthy();
  });
});
