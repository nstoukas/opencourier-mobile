import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { endExpiredSession, onResponseError } from './session';
import { queryClient } from './queryClient';
import {
  getSessionEndNotice,
  setSessionEndNotice,
} from './account/sessionEndNotice';
import i18n from '@app/localization/i18n';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, post: jest.fn() };
});
jest.mock('./offerPush/offerAlert', () => ({
  cancelAllOfferAlerts: jest.fn().mockResolvedValue(undefined),
}));

// Spec 0051 (AC-9): when a renewal is refused with ACCOUNT_DEACTIVATED or CREDENTIALS_CHANGED, the app
// ends the session and shows the full screen notice with the reason, instead of the generic alert. Any
// other refused renewal keeps the generic alert.
describe('session: a renewal refused with a named reason (spec 0051, AC-9)', () => {
  let mockHttp: any;
  let alertSpy: jest.SpyInstance;
  let resetQueriesSpy: jest.SpyInstance;

  const DEACTIVATED_SENTENCE =
    'Your account was deactivated by the co-op. If you think this is a mistake, call the co-op on +30 24210 12345.';

  // A request the server answered 401, sent with the rider's token.
  const refusedRequest = (): AxiosError => {
    const headers = new AxiosHeaders();
    headers.set('Authorization', 'Bearer current-token');
    const config = {
      url: 'courier/orders',
      headers,
    } as InternalAxiosRequestConfig;
    const error = new Error('Request failed with status 401') as AxiosError;
    error.config = config;
    error.response = {
      status: 401,
      data: {},
      statusText: 'Unauthorized',
      headers: {},
      config,
    };
    return error;
  };

  // The renewal's own refusal, as the backend words it.
  const refusedRenewal = (status: number, code?: string, message?: string) => {
    const error = new Error(`Refresh ${status}`) as AxiosError;
    error.response = {
      status,
      data: code
        ? { error: true, result: [{ code, message, statusCode: status }] }
        : {},
    } as any;
    return error;
  };

  const renewalRefusedWith = async (refusal: AxiosError) => {
    await AsyncStorage.setItem('token', 'stale-token');
    await AsyncStorage.setItem('refreshToken', 'stale-refresh');
    mockHttp.defaults.headers.common.Authorization = 'Bearer stale-token';
    (axios.post as jest.Mock).mockRejectedValueOnce(refusal);
    const request = refusedRequest();
    await expect(onResponseError(mockHttp)(request)).rejects.toBe(request);
  };

  const expectSessionEnded = async () => {
    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(await AsyncStorage.getItem('refreshToken')).toBeNull();
    expect(mockHttp.defaults.headers.common.Authorization).toBeUndefined();
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    setSessionEndNotice(null);
    mockHttp = jest.fn() as any;
    mockHttp.defaults = {
      baseURL: 'http://localhost:3000/api/courier/v1/',
      headers: { common: {} as Record<string, string | undefined> },
    };
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    resetQueriesSpy = jest
      .spyOn(queryClient, 'resetQueries')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    alertSpy.mockRestore();
    resetQueriesSpy.mockRestore();
    setSessionEndNotice(null);
  });

  it("ACCOUNT_DEACTIVATED: ends the session and sets the deactivated notice with the server's sentence, with no alert", async () => {
    await renewalRefusedWith(
      refusedRenewal(401, 'ACCOUNT_DEACTIVATED', DEACTIVATED_SENTENCE),
    );

    expect(getSessionEndNotice()).toEqual({
      kind: 'deactivated',
      message: DEACTIVATED_SENTENCE,
    });
    expect(alertSpy).not.toHaveBeenCalled();
    await expectSessionEnded();
    // The request is not sent again.
    expect(mockHttp).not.toHaveBeenCalled();
  });

  it('CREDENTIALS_CHANGED: ends the session and sets the credentials notice, with no alert', async () => {
    await renewalRefusedWith(
      refusedRenewal(
        401,
        'CREDENTIALS_CHANGED',
        'Your password or login email was changed. Log in again.',
      ),
    );

    expect(getSessionEndNotice()).toEqual({
      kind: 'credentials',
      message: null,
    });
    expect(alertSpy).not.toHaveBeenCalled();
    await expectSessionEnded();
  });

  it.each([
    [
      '401 with code UNAUTHORIZED',
      refusedRenewal(401, 'UNAUTHORIZED', 'Unauthorized'),
    ],
    [
      '401 with code JWT_EXPIRED',
      refusedRenewal(401, 'JWT_EXPIRED', 'Unauthorized'),
    ],
    [
      '403 with code FORBIDDEN',
      refusedRenewal(403, 'FORBIDDEN', 'Invalid refresh token'),
    ],
    ['401 with no body', refusedRenewal(401)],
  ])(
    'any other refusal (%s) keeps the generic alert and sets no notice',
    async (_name, refusal) => {
      await renewalRefusedWith(refusal);

      expect(getSessionEndNotice()).toBeNull();
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:session_ended_title'),
        i18n.t('translations:session_ended_body'),
      );
      await expectSessionEnded();
    },
  );

  it('a renewal that failed without being refused (500, no answer) ends nothing and shows nothing', async () => {
    for (const refusal of [
      refusedRenewal(500, 'ACCOUNT_DEACTIVATED', DEACTIVATED_SENTENCE),
      new Error('Network Error') as AxiosError,
    ]) {
      await AsyncStorage.setItem('token', 'kept-token');
      await AsyncStorage.setItem('refreshToken', 'kept-refresh');
      (axios.post as jest.Mock).mockRejectedValueOnce(refusal);
      const request = refusedRequest();

      await expect(onResponseError(mockHttp)(request)).rejects.toBe(request);

      expect(getSessionEndNotice()).toBeNull();
      expect(alertSpy).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem('refreshToken')).toBe('kept-refresh');
    }
  });

  it('a rider with no refresh token saved gets the generic alert, not a notice', async () => {
    const request = refusedRequest();

    await expect(onResponseError(mockHttp)(request)).rejects.toBe(request);

    expect(getSessionEndNotice()).toBeNull();
    expect(alertSpy).toHaveBeenCalledWith(
      i18n.t('translations:session_ended_title'),
      i18n.t('translations:session_ended_body'),
    );
  });

  describe('endExpiredSession', () => {
    it('given a notice, sets it and shows no alert; the rider data on the phone is still cleared', async () => {
      await AsyncStorage.setItem('token', 'stale-token');
      await AsyncStorage.setItem('refreshToken', 'stale-refresh');

      await endExpiredSession(mockHttp, {
        kind: 'deactivated',
        message: DEACTIVATED_SENTENCE,
      });

      expect(getSessionEndNotice()).toEqual({
        kind: 'deactivated',
        message: DEACTIVATED_SENTENCE,
      });
      expect(alertSpy).not.toHaveBeenCalled();
      expect(resetQueriesSpy).toHaveBeenCalledTimes(1);
      await expectSessionEnded();
    });

    it('given no notice, shows the generic alert and sets none', async () => {
      await endExpiredSession(mockHttp);

      expect(getSessionEndNotice()).toBeNull();
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:session_ended_title'),
        i18n.t('translations:session_ended_body'),
      );
    });
  });
});
