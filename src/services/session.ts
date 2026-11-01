import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Alert } from 'react-native';
import { clearSavedQueries } from './queryPersistence';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@app/localization/i18n';
// `import type` brings in only the type, never the module itself, so this file
// does not build the shared HTTP client just by being imported (the offer
// alert's own client uses it too).
import type { UClient } from './Client';
import { queryClient } from './queryClient';
import { cancelAllOfferAlerts } from './offerPush/offerAlert';
import { navigationRef } from '@app/navigation/navigationRef';
import { RootScreen } from '@app/navigation/types';

// Keeps a rider's login alive (row 66). The backend answers 401 when the access
// token has expired; the app then asks for a new one with the refresh token it
// saved at login and sends the request again. When the backend refuses the
// refresh token too, the session is over: the app logs the rider out and says why.

// The requests the session itself is made of. A 401 from these means a wrong
// password or a refused refresh token, never an access token to renew.
const SESSION_PATHS = ['auth/login', 'auth/refresh-tokens'];

// True for a request to one of those paths. The end of the path must match, so
// a later `auth/login-history` would not count as `auth/login`.
const isSessionPath = (url: string | undefined): boolean => {
  const path = (url ?? '').split('?')[0];
  return SESSION_PATHS.some(sessionPath => path.endsWith(sessionPath));
};

// The request's own settings, plus a mark so each request is retried once only.
type RetriableConfig = InternalAxiosRequestConfig & {
  sessionRetried?: boolean;
};

type RefreshResponse = {
  result: { session: { accessToken: string; refreshToken: string } };
};

let refreshing: Promise<string> | null = null;
let ending: Promise<void> | null = null;

// Saves both tokens of a fresh session and puts the access token on every
// request from now on.
export const saveSession = async (
  accessToken: string,
  refreshToken: string,
  http: UClient,
): Promise<void> => {
  http.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  await AsyncStorage.multiSet([
    ['token', accessToken],
    ['refreshToken', refreshToken],
  ]);
};

// Asks the backend for a new access token. Requests that fail together share
// one refresh, so the refresh token is spent once.
export const refreshSession = (http: UClient): Promise<string> => {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token saved');
      }
      const base = (http.defaults.baseURL ?? '').replace(/\/$/, '');
      // A plain axios call, not `http`, so this request never comes back
      // through the interceptor below. Only the session is read from the
      // answer, nothing else the backend sends with it.
      const { data } = await axios.post<RefreshResponse>(
        `${base}/auth/refresh-tokens`,
        undefined,
        { headers: { 'x-refresh-token': refreshToken }, timeout: 10000 },
      );
      const { accessToken, refreshToken: nextRefreshToken } =
        data.result.session;
      await saveSession(accessToken, nextRefreshToken, http);
      return accessToken;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
};

// The backend answered and said no (the refresh token is expired, wrong or
// missing: any 4xx), as opposed to no answer at all (no signal, a timeout, a
// server error, or 408 and 429, which mean "try again later").
const isRefused = (error: unknown): boolean => {
  if (error instanceof Error && error.message === 'No refresh token saved') {
    return true;
  }
  const status = (error as AxiosError)?.response?.status;
  return (
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  );
};

// Logs the rider out on this phone after the backend refused to renew the
// session, and tells them why. The server calls that logging out normally
// makes (going Offline, removing this phone from push) cannot work without a
// session; an offer left with this rider still ends at its deadline.
export const endExpiredSession = (http: UClient): Promise<void> => {
  if (!ending) {
    ending = (async () => {
      await AsyncStorage.multiRemove(['token', 'refreshToken']);
      http.defaults.headers.common.Authorization = undefined;
      // Nothing may keep ringing on a phone nobody is logged in on.
      await cancelAllOfferAlerts().catch(() => undefined);
      // With no user the app shows its logged out screens again.
      queryClient.resetQueries();
      // No other rider may see these deliveries (spec 0009, AC-11). The rider's
      // waiting job steps stay: they are sent at their next login (AC-8).
      await clearSavedQueries();
      // Opening the app with an expired session leaves it on the splash screen,
      // which only looks for a token when it first appears: move on from it.
      if (
        navigationRef.isReady() &&
        navigationRef.getCurrentRoute()?.name === RootScreen.Loading
      ) {
        // The ref is not typed with the app's screens, so `as never` lets this
        // call name a screen it cannot check.
        navigationRef.navigate(RootScreen.Onboarding as never);
      }
      Alert.alert(
        i18n.t('translations:session_ended_title'),
        i18n.t('translations:session_ended_body'),
      );
    })().finally(() => {
      ending = null;
    });
  }
  return ending;
};

// What the client does with a failed request: renew and retry it once on a
// 401, end the session if renewing is refused, and pass every other error on.
export const onResponseError =
  (http: UClient) =>
  async (error: AxiosError): Promise<unknown> => {
    const config = error.config as RetriableConfig | undefined;
    if (
      error.response?.status !== 401 ||
      !config ||
      config.sessionRetried ||
      isSessionPath(config.url) ||
      // Sent with no token: nobody was logged in, so there is nothing to renew.
      !config.headers?.Authorization
    ) {
      return Promise.reject(error);
    }
    config.sessionRetried = true;
    try {
      const accessToken = await refreshSession(http);
      config.headers.Authorization = `Bearer ${accessToken}`;
      return http(config);
    } catch (refreshError) {
      if (isRefused(refreshError)) {
        await endExpiredSession(http);
      }
      return Promise.reject(error);
    }
  };

// Called once when the app starts (App.tsx).
export const installSessionRefresh = (http: UClient): number =>
  http.interceptors.response.use(response => response, onResponseError(http));
