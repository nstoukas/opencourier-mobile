import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  saveSession,
  refreshSession,
  endExpiredSession,
  onResponseError,
  installSessionRefresh,
} from './session';
import { queryClient } from './queryClient';
import { navigationRef } from '@app/navigation/navigationRef';
import { RootScreen } from '@app/navigation/types';
import { cancelAllOfferAlerts } from './offerPush/offerAlert';
import i18n from '@app/localization/i18n';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    post: jest.fn(),
  };
});
jest.mock('./offerPush/offerAlert', () => ({
  cancelAllOfferAlerts: jest.fn().mockResolvedValue(undefined),
}));

describe('session service (Row 66, Clause 3)', () => {
  let mockHttp: any;
  let alertSpy: jest.SpyInstance;
  let resetQueriesSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();

    mockHttp = jest.fn() as any;
    mockHttp.defaults = {
      baseURL: 'http://localhost:3000/api/courier/v1/',
      headers: {
        common: {} as Record<string, string | undefined>,
      },
    };
    mockHttp.interceptors = {
      response: {
        use: jest.fn(),
      },
    };

    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    resetQueriesSpy = jest
      .spyOn(queryClient, 'resetQueries')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    alertSpy.mockRestore();
    resetQueriesSpy.mockRestore();
  });

  describe('saveSession', () => {
    it('saves both accessToken and refreshToken to AsyncStorage and sets Authorization header', async () => {
      await saveSession('new-access-token', 'new-refresh-token', mockHttp);

      expect(mockHttp.defaults.headers.common.Authorization).toBe(
        'Bearer new-access-token',
      );

      const savedToken = await AsyncStorage.getItem('token');
      const savedRefreshToken = await AsyncStorage.getItem('refreshToken');
      expect(savedToken).toBe('new-access-token');
      expect(savedRefreshToken).toBe('new-refresh-token');
    });
  });

  describe('refreshSession', () => {
    it('throws when no refresh token is saved in AsyncStorage', async () => {
      await expect(refreshSession(mockHttp)).rejects.toThrow(
        'No refresh token saved',
      );
    });

    it('makes exactly one POST to <baseURL>/auth/refresh-tokens with x-refresh-token header and saves new session', async () => {
      await AsyncStorage.setItem('refreshToken', 'old-refresh-token');

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          result: {
            session: {
              accessToken: 'renewed-access-token',
              refreshToken: 'renewed-refresh-token',
            },
          },
        },
      });

      const token = await refreshSession(mockHttp);

      expect(token).toBe('renewed-access-token');
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/courier/v1/auth/refresh-tokens',
        undefined,
        {
          headers: { 'x-refresh-token': 'old-refresh-token' },
          timeout: 10000,
        },
      );

      // Verify new tokens saved
      expect(mockHttp.defaults.headers.common.Authorization).toBe(
        'Bearer renewed-access-token',
      );
      expect(await AsyncStorage.getItem('token')).toBe('renewed-access-token');
      expect(await AsyncStorage.getItem('refreshToken')).toBe(
        'renewed-refresh-token',
      );
    });

    it('two requests failing together share ONE refresh call', async () => {
      await AsyncStorage.setItem('refreshToken', 'shared-refresh-token');

      let resolveRefresh: (val: any) => void;
      const refreshPromise = new Promise(resolve => {
        resolveRefresh = resolve;
      });

      (axios.post as jest.Mock).mockReturnValueOnce(refreshPromise);

      // Trigger two refreshSession calls concurrently
      const call1 = refreshSession(mockHttp);
      const call2 = refreshSession(mockHttp);

      resolveRefresh!({
        data: {
          result: {
            session: {
              accessToken: 'shared-new-token',
              refreshToken: 'shared-new-refresh',
            },
          },
        },
      });

      const [res1, res2] = await Promise.all([call1, call2]);

      expect(res1).toBe('shared-new-token');
      expect(res2).toBe('shared-new-token');
      // Exactly ONE post to refresh-tokens was made
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('endExpiredSession', () => {
    it('removes token and refreshToken, clears Authorization, cancels alerts, resets queries, and shows Alert', async () => {
      await AsyncStorage.setItem('token', 'stale-token');
      await AsyncStorage.setItem('refreshToken', 'stale-refresh');
      mockHttp.defaults.headers.common.Authorization = 'Bearer stale-token';

      await endExpiredSession(mockHttp);

      expect(await AsyncStorage.getItem('token')).toBeNull();
      expect(await AsyncStorage.getItem('refreshToken')).toBeNull();
      expect(mockHttp.defaults.headers.common.Authorization).toBeUndefined();
      expect(cancelAllOfferAlerts).toHaveBeenCalledTimes(1);
      expect(resetQueriesSpy).toHaveBeenCalledTimes(1);

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:session_ended_title'),
        i18n.t('translations:session_ended_body'),
      );
    });

    it('navigates to Onboarding when current route is Loading', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      jest.spyOn(navigationRef, 'getCurrentRoute').mockReturnValue({
        name: RootScreen.Loading,
        key: 'loading-key',
      });
      const navigateSpy = jest
        .spyOn(navigationRef, 'navigate')
        .mockImplementation(() => {});

      await endExpiredSession(mockHttp);

      expect(navigateSpy).toHaveBeenCalledWith(RootScreen.Onboarding);
    });

    it('does not navigate away when current route is not Loading', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      jest.spyOn(navigationRef, 'getCurrentRoute').mockReturnValue({
        name: RootScreen.Main,
        key: 'main-key',
      });
      const navigateSpy = jest
        .spyOn(navigationRef, 'navigate')
        .mockImplementation(() => {});

      await endExpiredSession(mockHttp);

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('onResponseError', () => {
    const makeError = (
      status: number,
      url: string,
      hasAuth = true,
      retried = false,
    ): AxiosError => {
      const headers = new AxiosHeaders();
      if (hasAuth) {
        headers.set('Authorization', 'Bearer current-token');
      }
      const config: InternalAxiosRequestConfig & { sessionRetried?: boolean } =
        {
          url,
          headers,
          sessionRetried: retried,
        } as any;

      const error = new Error(
        'Request failed with status ' + status,
      ) as AxiosError;
      error.config = config;
      error.response = {
        status,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config,
      };
      return error;
    };

    it('retries original request once with new token when 401 occurs with Authorization', async () => {
      await AsyncStorage.setItem('refreshToken', 'valid-refresh');

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          result: {
            session: {
              accessToken: 'fresh-token',
              refreshToken: 'fresh-refresh',
            },
          },
        },
      });

      mockHttp.mockResolvedValueOnce({ data: { success: true } });

      const err = makeError(401, 'courier/orders');
      const errorHandler = onResponseError(mockHttp);

      const response = await errorHandler(err);

      expect(response).toEqual({ data: { success: true } });
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(mockHttp).toHaveBeenCalledTimes(1);
      const retriedConfig = mockHttp.mock.calls[0][0];
      expect(retriedConfig.headers.Authorization).toBe('Bearer fresh-token');
      expect(retriedConfig.sessionRetried).toBe(true);
    });

    it('does NOT refresh and rejects immediately when request url is auth/login, auth/register, or auth/refresh-tokens', async () => {
      await AsyncStorage.setItem('refreshToken', 'existing-refresh-token');
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          result: {
            session: {
              accessToken: 'new-token',
              refreshToken: 'new-refresh-token',
            },
          },
        },
      });

      const errorHandler = onResponseError(mockHttp);

      for (const path of [
        'auth/login',
        'auth/register',
        'auth/refresh-tokens',
      ]) {
        const err = makeError(401, path);
        await expect(errorHandler(err)).rejects.toBe(err);
      }
      expect(axios.post).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('does NOT refresh and rejects immediately when request had no Authorization header', async () => {
      await AsyncStorage.setItem('refreshToken', 'existing-refresh');
      const err = makeError(401, 'courier/profile', false);
      const errorHandler = onResponseError(mockHttp);

      await expect(errorHandler(err)).rejects.toBe(err);
      expect(axios.post).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('does NOT retry more than once when sessionRetried is true', async () => {
      const err = makeError(401, 'courier/orders', true, true);
      const errorHandler = onResponseError(mockHttp);

      await expect(errorHandler(err)).rejects.toBe(err);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('ends session when refresh token is missing or refused with 401 or 403', async () => {
      // Case A: No refresh token saved
      const errA = makeError(401, 'courier/orders');
      const errorHandlerA = onResponseError(mockHttp);
      await expect(errorHandlerA(errA)).rejects.toBe(errA);
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:session_ended_title'),
        i18n.t('translations:session_ended_body'),
      );

      jest.clearAllMocks();

      // Case B: Refresh token answered 401 (refused)
      await AsyncStorage.setItem('refreshToken', 'bad-refresh');
      const refresh401 = new Error('Refresh 401') as AxiosError;
      refresh401.response = { status: 401 } as any;
      (axios.post as jest.Mock).mockRejectedValueOnce(refresh401);

      const errB = makeError(401, 'courier/orders');
      await expect(errorHandlerA(errB)).rejects.toBe(errB);
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:session_ended_title'),
        i18n.t('translations:session_ended_body'),
      );

      jest.clearAllMocks();

      // Case C: Refresh token answered 403 (refused)
      await AsyncStorage.setItem('refreshToken', 'forbidden-refresh');
      const refresh403 = new Error('Refresh 403') as AxiosError;
      refresh403.response = { status: 403 } as any;
      (axios.post as jest.Mock).mockRejectedValueOnce(refresh403);

      const errC = makeError(401, 'courier/orders');
      await expect(errorHandlerA(errC)).rejects.toBe(errC);
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:session_ended_title'),
        i18n.t('translations:session_ended_body'),
      );
    });

    it('does NOT end session when refresh fails due to network error (no answer from server)', async () => {
      await AsyncStorage.setItem('refreshToken', 'valid-refresh');

      // Network error has no response / no status 401/403
      const networkError = new Error('Network Error');
      (axios.post as jest.Mock).mockRejectedValueOnce(networkError);

      const err = makeError(401, 'courier/orders');
      const errorHandler = onResponseError(mockHttp);

      await expect(errorHandler(err)).rejects.toBe(err);

      // Rider stays logged in; session is NOT ended
      expect(alertSpy).not.toHaveBeenCalled();
      expect(resetQueriesSpy).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem('refreshToken')).toBe('valid-refresh');
    });
  });

  describe('installSessionRefresh', () => {
    it('registers interceptor on the http client', () => {
      installSessionRefresh(mockHttp);
      expect(mockHttp.interceptors.response.use).toHaveBeenCalledTimes(1);
    });
  });
});
