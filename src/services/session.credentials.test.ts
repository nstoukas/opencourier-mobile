import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  getTokensSaved,
  onResponseError,
  saveSession,
  subscribeTokensSaved,
  whileChangingCredentials,
} from './session';
import { queryClient } from './queryClient';
import {
  getSessionEndNotice,
  setSessionEndNotice,
} from './account/sessionEndNotice';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, post: jest.fn() };
});
jest.mock('./offerPush/offerAlert', () => ({
  cancelAllOfferAlerts: jest.fn().mockResolvedValue(undefined),
}));

// Row 108 review, written from its rulings (spec 0051, AC-8). Two of them meet in this module:
// - "The live connection stays closed after a password change": saving new tokens is counted and announced,
//   so the app can reopen its connection with them.
// - "A request in flight during the change logs the rider out": while the rider's own password change
//   runs, a refusal waits for it and retries with the new token instead of ending the session.
describe('session: the rider changes their own password (spec 0051, row 108 review)', () => {
  let mockHttp: any;
  let alertSpy: jest.SpyInstance;
  let resetQueriesSpy: jest.SpyInstance;

  // A request the server answered 401, sent with the token the rider had before the change.
  const refusedRequest = (token = 'old-access'): AxiosError => {
    const headers = new AxiosHeaders();
    headers.set('Authorization', `Bearer ${token}`);
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

  // The server's refusal of a renewal made with tokens the change has ended.
  const credentialsChanged = () => {
    const error = new Error('Refresh 401') as AxiosError;
    error.response = {
      status: 401,
      data: {
        error: true,
        result: [{ code: 'CREDENTIALS_CHANGED', statusCode: 401 }],
      },
    } as any;
    return error;
  };

  // A password change the test finishes by hand.
  const pendingChange = () => {
    let succeed!: () => void;
    let fail!: (error: Error) => void;
    const work = new Promise<void>((resolve, reject) => {
      succeed = resolve;
      fail = reject;
    });
    return { work, succeed, fail };
  };

  // Lets every promise that can run, run.
  const settle = () => new Promise(resolve => setImmediate(resolve));

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await AsyncStorage.setItem('token', 'old-access');
    await AsyncStorage.setItem('refreshToken', 'old-refresh');
    setSessionEndNotice(null);
    mockHttp = jest.fn().mockResolvedValue({ status: 200, data: 'retried' });
    mockHttp.defaults = {
      baseURL: 'http://localhost:3000/api/courier/v1/',
      headers: {
        common: { Authorization: 'Bearer old-access' } as Record<
          string,
          string | undefined
        >,
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
    setSessionEndNotice(null);
  });

  describe('saveSession counts and announces each save of new tokens', () => {
    it('the counter goes up by one for each save', async () => {
      const before = getTokensSaved();

      await saveSession('access-1', 'refresh-1', mockHttp);
      expect(getTokensSaved()).toBe(before + 1);

      await saveSession('access-2', 'refresh-2', mockHttp);
      expect(getTokensSaved()).toBe(before + 2);
    });

    it('every listener is told once per save, after the tokens are stored and the counter has moved', async () => {
      const before = getTokensSaved();
      const seen: Array<{ count: number; token: string | null }> = [];
      const first = jest.fn(() => {
        seen.push({ count: getTokensSaved(), token: null });
      });
      const second = jest.fn();
      const stopFirst = subscribeTokensSaved(first);
      const stopSecond = subscribeTokensSaved(second);

      await saveSession('access-1', 'refresh-1', mockHttp);

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      expect(seen[0].count).toBe(before + 1);
      // By the time a listener hears of it, the new token is what the phone has stored and sends.
      expect(await AsyncStorage.getItem('token')).toBe('access-1');
      expect(await AsyncStorage.getItem('refreshToken')).toBe('refresh-1');
      expect(mockHttp.defaults.headers.common.Authorization).toBe(
        'Bearer access-1',
      );

      stopFirst();
      stopSecond();
    });

    it('a listener told of the save reads the new token from storage, not the old one', async () => {
      let tokenWhenTold: Promise<string | null> | null = null;
      const stop = subscribeTokensSaved(() => {
        tokenWhenTold = AsyncStorage.getItem('token');
      });

      await saveSession(
        'access-after-change',
        'refresh-after-change',
        mockHttp,
      );

      expect(await tokenWhenTold).toBe('access-after-change');
      stop();
    });

    it('a listener that unsubscribed is not told again', async () => {
      const listener = jest.fn();
      const stop = subscribeTokensSaved(listener);
      await saveSession('access-1', 'refresh-1', mockHttp);
      expect(listener).toHaveBeenCalledTimes(1);

      stop();
      await saveSession('access-2', 'refresh-2', mockHttp);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('a save that could not store the tokens is not counted or announced', async () => {
      const before = getTokensSaved();
      const listener = jest.fn();
      const stop = subscribeTokensSaved(listener);
      // The storage mock's own jest.fn, failing for this one call only.
      (AsyncStorage.multiSet as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('disk full')),
      );

      await expect(
        saveSession('access-1', 'refresh-1', mockHttp),
      ).rejects.toThrow('disk full');

      expect(getTokensSaved()).toBe(before);
      expect(listener).not.toHaveBeenCalled();
      stop();
    });

    it('a renewed access token is a save too (the refresh path goes through saveSession)', async () => {
      const before = getTokensSaved();
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          result: {
            session: {
              accessToken: 'renewed',
              refreshToken: 'renewed-refresh',
            },
          },
        },
      });

      await onResponseError(mockHttp)(refusedRequest());

      expect(getTokensSaved()).toBe(before + 1);
    });
  });

  describe('whileChangingCredentials', () => {
    it('answers what the change answers', async () => {
      await expect(
        whileChangingCredentials(Promise.resolve('changed')),
      ).resolves.toBe('changed');
    });

    it('a change that fails reaches its caller as it is', async () => {
      const refusal = new Error('Your current password is not right.');

      await expect(
        whileChangingCredentials(Promise.reject(refusal)),
      ).rejects.toBe(refusal);
    });
  });

  describe('a request refused (401) while the change runs', () => {
    it('waits for the change, then is sent again with the new stored token: no renewal, no session end', async () => {
      const change = pendingChange();
      const held = whileChangingCredentials(
        change.work.then(() =>
          saveSession('new-access', 'new-refresh', mockHttp),
        ),
      );
      const request = refusedRequest('old-access');

      const answered = onResponseError(mockHttp)(request);
      let settled = false;
      answered.then(
        () => (settled = true),
        () => (settled = true),
      );
      await settle();

      // Still waiting: nothing sent again, no renewal tried with the token the server just ended.
      expect(settled).toBe(false);
      expect(mockHttp).not.toHaveBeenCalled();
      expect(axios.post).not.toHaveBeenCalled();

      change.succeed();
      await held;

      await expect(answered).resolves.toEqual({ status: 200, data: 'retried' });
      expect(mockHttp).toHaveBeenCalledTimes(1);
      const retried = mockHttp.mock.calls[0][0];
      expect(retried.url).toBe('courier/orders');
      expect(retried.headers.Authorization).toBe('Bearer new-access');
      // The refresh token the change ended is never spent.
      expect(axios.post).not.toHaveBeenCalled();
      // The rider stays logged in.
      expect(await AsyncStorage.getItem('token')).toBe('new-access');
      expect(await AsyncStorage.getItem('refreshToken')).toBe('new-refresh');
      expect(alertSpy).not.toHaveBeenCalled();
      expect(getSessionEndNotice()).toBeNull();
      expect(resetQueriesSpy).not.toHaveBeenCalled();
    });

    it('without the hold, the same refusal would end the session (what the hold is for)', async () => {
      // No change running: the renewal is refused because the credentials changed, and the session ends.
      (axios.post as jest.Mock).mockRejectedValueOnce(credentialsChanged());
      const request = refusedRequest('old-access');

      await expect(onResponseError(mockHttp)(request)).rejects.toBe(request);

      expect(getSessionEndNotice()).toEqual({
        kind: 'credentials',
        message: null,
      });
      expect(await AsyncStorage.getItem('token')).toBeNull();
    });

    it('several requests refused together all wait and all go again with the new token', async () => {
      const change = pendingChange();
      const held = whileChangingCredentials(
        change.work.then(() =>
          saveSession('new-access', 'new-refresh', mockHttp),
        ),
      );

      const answers = [
        onResponseError(mockHttp)(refusedRequest()),
        onResponseError(mockHttp)(refusedRequest()),
        onResponseError(mockHttp)(refusedRequest()),
      ];
      await settle();
      expect(mockHttp).not.toHaveBeenCalled();

      change.succeed();
      await held;
      await Promise.all(answers);

      expect(mockHttp).toHaveBeenCalledTimes(3);
      for (const call of mockHttp.mock.calls) {
        expect(call[0].headers.Authorization).toBe('Bearer new-access');
      }
      expect(axios.post).not.toHaveBeenCalled();
      expect(getSessionEndNotice()).toBeNull();
    });

    it('the request is sent again once only: a second 401 on the retry is passed on', async () => {
      const change = pendingChange();
      const held = whileChangingCredentials(
        change.work.then(() =>
          saveSession('new-access', 'new-refresh', mockHttp),
        ),
      );
      const request = refusedRequest();
      const answered = onResponseError(mockHttp)(request);
      change.succeed();
      await held;
      await answered;

      // The retry comes back 401 too, carrying the same marked config.
      await expect(onResponseError(mockHttp)(request)).rejects.toBe(request);
      expect(mockHttp).toHaveBeenCalledTimes(1);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('a change that fails (a wrong current password) leaves the old tokens: the request is renewed the usual way, and the failure is not thrown here', async () => {
      const change = pendingChange();
      const held = whileChangingCredentials(change.work);
      held.catch(() => undefined);
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          result: {
            session: {
              accessToken: 'renewed',
              refreshToken: 'renewed-refresh',
            },
          },
        },
      });

      const answered = onResponseError(mockHttp)(refusedRequest('old-access'));
      await settle();
      expect(axios.post).not.toHaveBeenCalled();

      change.fail(new Error('Your current password is not right.'));

      await expect(answered).resolves.toEqual({ status: 200, data: 'retried' });
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(mockHttp.mock.calls[0][0].headers.Authorization).toBe(
        'Bearer renewed',
      );
      expect(getSessionEndNotice()).toBeNull();
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('once the change is over, the hold is released: a later 401 renews as always', async () => {
      await whileChangingCredentials(
        saveSession('new-access', 'new-refresh', mockHttp),
      );
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          result: {
            session: {
              accessToken: 'renewed',
              refreshToken: 'renewed-refresh',
            },
          },
        },
      });

      // Sent before the change and answered after it: it no longer finds a change to wait for, so it is
      // renewed with the refresh token the change saved, not handed whatever token is stored.
      await onResponseError(mockHttp)(refusedRequest('old-access'));

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect((axios.post as jest.Mock).mock.calls[0][2].headers).toEqual({
        'x-refresh-token': 'new-refresh',
      });
      expect(mockHttp.mock.calls[0][0].headers.Authorization).toBe(
        'Bearer renewed',
      );
    });

    it('after a failed change the hold is released too', async () => {
      await whileChangingCredentials(
        Promise.reject(new Error('not right')),
      ).catch(() => undefined);
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          result: {
            session: {
              accessToken: 'renewed',
              refreshToken: 'renewed-refresh',
            },
          },
        },
      });

      await onResponseError(mockHttp)(refusedRequest('old-access'));

      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('the change request itself, refused for a wrong password (400), is passed on untouched', async () => {
      const change = pendingChange();
      const held = whileChangingCredentials(change.work);
      const wrongPassword = refusedRequest();
      wrongPassword.response!.status = 400;

      await expect(onResponseError(mockHttp)(wrongPassword)).rejects.toBe(
        wrongPassword,
      );

      expect(mockHttp).not.toHaveBeenCalled();
      change.succeed();
      await held;
    });
  });
});
