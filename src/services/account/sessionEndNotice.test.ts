import {
  errorCodeOf,
  getSessionEndNotice,
  noticeForRefusal,
  setSessionEndNotice,
  subscribeSessionEndNotice,
} from './sessionEndNotice';

// Spec 0051 (AC-9, cross check 3): the app reads the server's error code, not its message, to decide
// why a session ended. The backend answers { error: true, result: [{ code, message, statusCode }] }.
const refusal = (first: unknown, status = 401) => ({
  response: { status, data: { error: true, result: [first] } },
});

const DEACTIVATED_SENTENCE =
  'Your account was deactivated by the co-op. If you think this is a mistake, call the co-op on +30 24210 12345.';

describe('sessionEndNotice (spec 0051, AC-9)', () => {
  afterEach(() => {
    setSessionEndNotice(null);
  });

  describe('errorCodeOf', () => {
    it("reads the code and the message of the backend's first error", () => {
      expect(
        errorCodeOf(
          refusal({
            code: 'ACCOUNT_DEACTIVATED',
            message: DEACTIVATED_SENTENCE,
            statusCode: 401,
          }),
        ),
      ).toEqual({ code: 'ACCOUNT_DEACTIVATED', message: DEACTIVATED_SENTENCE });
    });

    it.each([
      ['nothing', undefined],
      ['null', null],
      ['a plain Error with no response', new Error('Network Error')],
      ['a response with no data', { response: { status: 401 } }],
      [
        'a response whose result is not a list',
        { response: { data: { result: 'Unauthorized' } } },
      ],
      ['an empty result list', { response: { data: { result: [] } } }],
      ['a result holding null', { response: { data: { result: [null] } } }],
      ['a string', 'Unauthorized'],
    ])(
      'answers no code and no message for %s, without throwing',
      (_name, error) => {
        expect(errorCodeOf(error)).toEqual({
          code: undefined,
          message: undefined,
        });
      },
    );

    it('ignores a code or message that is not text', () => {
      expect(errorCodeOf(refusal({ code: 401, message: ['x'] }))).toEqual({
        code: undefined,
        message: undefined,
      });
    });

    it('reads a code that came with no message', () => {
      expect(errorCodeOf(refusal({ code: 'CREDENTIALS_CHANGED' }))).toEqual({
        code: 'CREDENTIALS_CHANGED',
        message: undefined,
      });
    });
  });

  describe('noticeForRefusal', () => {
    it("ACCOUNT_DEACTIVATED gives the deactivated notice with the server's sentence", () => {
      expect(
        noticeForRefusal(
          refusal({
            code: 'ACCOUNT_DEACTIVATED',
            message: DEACTIVATED_SENTENCE,
          }),
        ),
      ).toEqual({ kind: 'deactivated', message: DEACTIVATED_SENTENCE });
    });

    it('ACCOUNT_DEACTIVATED with no sentence still gives the deactivated notice', () => {
      expect(
        noticeForRefusal(refusal({ code: 'ACCOUNT_DEACTIVATED' })),
      ).toEqual({
        kind: 'deactivated',
        message: null,
      });
    });

    it("CREDENTIALS_CHANGED gives the credentials notice, worded by the app (the server's sentence is not carried)", () => {
      expect(
        noticeForRefusal(
          refusal({
            code: 'CREDENTIALS_CHANGED',
            message: 'Your password or login email was changed. Log in again.',
          }),
        ),
      ).toEqual({ kind: 'credentials', message: null });
    });

    it.each([
      ['UNAUTHORIZED', 'Unauthorized'],
      ['JWT_EXPIRED', 'Unauthorized'],
      ['FORBIDDEN', 'Invalid refresh token'],
      ['account_deactivated', 'lower case is not the code'],
    ])('any other code (%s) gives no notice', (code, message) => {
      expect(noticeForRefusal(refusal({ code, message }))).toBeNull();
    });

    it('the code decides, never the message: the deactivated words under another code give no notice', () => {
      expect(
        noticeForRefusal(
          refusal({ code: 'UNAUTHORIZED', message: DEACTIVATED_SENTENCE }),
        ),
      ).toBeNull();
    });

    it('a refusal with no readable body gives no notice', () => {
      expect(noticeForRefusal({ response: { status: 401 } })).toBeNull();
      expect(noticeForRefusal(new Error('Network Error'))).toBeNull();
      expect(noticeForRefusal(undefined)).toBeNull();
    });
  });

  describe('the notice store', () => {
    it('starts with no notice, holds the one set, and is cleared with null', () => {
      expect(getSessionEndNotice()).toBeNull();

      const notice = {
        kind: 'deactivated' as const,
        message: DEACTIVATED_SENTENCE,
      };
      setSessionEndNotice(notice);
      expect(getSessionEndNotice()).toEqual(notice);

      setSessionEndNotice(null);
      expect(getSessionEndNotice()).toBeNull();
    });

    it('tells its listeners on every change, and stops after they unsubscribe', () => {
      const listener = jest.fn();
      const unsubscribe = subscribeSessionEndNotice(listener);

      setSessionEndNotice({ kind: 'credentials', message: null });
      setSessionEndNotice(null);
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      setSessionEndNotice({ kind: 'credentials', message: null });
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});
