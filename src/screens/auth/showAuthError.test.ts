import { Alert } from 'react-native';
import i18n from '@app/localization/i18n';
import { showAuthError } from './showAuthError';

// Spec 0051 (AC-2): a deactivated rider who tries to log in is told so in the server's own sentence,
// which says how to reach the co-op, not the generic "wrong email or password".
describe('showAuthError on a deactivated login (spec 0051, AC-2)', () => {
  let alertSpy: jest.SpyInstance;

  const SERVER_SENTENCE =
    'Your account was deactivated by the co-op. If you think this is a mistake, call the co-op on +30 24210 12345.';
  const refusal = (status: number, code: string, message?: string) => ({
    response: {
      status,
      data: { error: true, result: [{ code, message, statusCode: status }] },
    },
  });

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("shows the server's sentence, word for word, under the deactivated title", () => {
    showAuthError(
      refusal(401, 'ACCOUNT_DEACTIVATED', SERVER_SENTENCE),
      'login',
    );

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Your account was deactivated',
      SERVER_SENTENCE,
    );
  });

  it("with no sentence from the server, shows the app's own deactivated words", () => {
    showAuthError(refusal(401, 'ACCOUNT_DEACTIVATED'), 'login');

    expect(alertSpy).toHaveBeenCalledWith(
      'Your account was deactivated',
      'Your account was deactivated by the co-op. If you think this is a mistake, contact the co-op.',
    );
  });

  it('a reset by code refused for a deactivated account says the same', () => {
    showAuthError(
      refusal(401, 'ACCOUNT_DEACTIVATED', SERVER_SENTENCE),
      'reset',
    );

    expect(alertSpy).toHaveBeenCalledWith(
      'Your account was deactivated',
      SERVER_SENTENCE,
    );
  });

  it('never shows an HTTP code or the error code itself', () => {
    showAuthError(
      refusal(401, 'ACCOUNT_DEACTIVATED', SERVER_SENTENCE),
      'login',
    );

    const shown = alertSpy.mock.calls[0].join(' ');
    expect(shown).not.toContain('401');
    expect(shown).not.toContain('ACCOUNT_DEACTIVATED');
  });

  it("any other refused login keeps the usual words, and never the server's message", () => {
    showAuthError(
      refusal(403, 'FORBIDDEN', 'These credentials are incorrect'),
      'login',
    );

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body] = alertSpy.mock.calls[0];
    expect(title).toBe(i18n.t('translations:auth_error_title'));
    expect(title).not.toBe('Your account was deactivated');
    expect(body).not.toBe('These credentials are incorrect');
    expect(body).not.toContain('deactivated');
  });

  it('the deactivated words under another code are not shown: the code decides', () => {
    showAuthError(refusal(403, 'FORBIDDEN', SERVER_SENTENCE), 'login');

    const [title, body] = alertSpy.mock.calls[0];
    expect(title).toBe(i18n.t('translations:auth_error_title'));
    expect(body).not.toBe(SERVER_SENTENCE);
  });
});
