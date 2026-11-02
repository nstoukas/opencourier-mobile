import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import notifee from '@notifee/react-native';
import {
  CANT_UPDATE_DELIVERY_STATUS_CODE,
  OFFER_HAS_ENDED_CODE,
} from '@app/services/orderService';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import '@app/localization/i18n';
import { answerOffer } from './answerOffer';
import { loadAnsweredOffers, offerKeyOf } from './answeredOffers';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('answerOffer (spec 0003, AC-5)', () => {
  const mockPost = jest.fn();
  let invalidateSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();

    mockPost.mockReset();
    mockedAxios.isAxiosError.mockImplementation(
      (payload: any): payload is any => true,
    );

    let responseErrorHandler: ((error: any) => Promise<any>) | undefined;

    const fakeClient: any = jest.fn(async (config: any) => {
      // Retrying a request calls http(config)
      return mockPost(config.url, config.data, config);
    });

    fakeClient.defaults = {
      baseURL: 'https://coop.example.com/api/courier/v1',
      headers: {
        common: {
          Accept: 'application/json',
          Authorization: 'Bearer courier-auth-token-xyz',
        },
      },
    };

    fakeClient.interceptors = {
      response: {
        use: jest.fn((_onFulfilled, onRejected) => {
          responseErrorHandler = onRejected;
        }),
      },
    };

    fakeClient.post = jest.fn(async (url: string, data: any, config?: any) => {
      const mergedConfig = {
        url,
        data,
        headers: {
          Authorization:
            fakeClient.defaults.headers.common.Authorization ??
            'Bearer courier-auth-token-xyz',
          ...config?.headers,
        },
        ...config,
      };
      try {
        return config !== undefined
          ? await mockPost(url, data, config)
          : await mockPost(url, data);
      } catch (err: any) {
        if (responseErrorHandler) {
          if (!err.config) {
            err.config = mergedConfig;
          }
          return await responseErrorHandler(err);
        }
        throw err;
      }
    });

    mockedAxios.create.mockImplementation((opts?: any) => {
      if (opts?.baseURL) {
        fakeClient.defaults.baseURL = opts.baseURL;
      }
      if (opts?.headers) {
        fakeClient.defaults.headers.common = {
          ...fakeClient.defaults.headers.common,
          ...opts.headers,
        };
      }
      return fakeClient;
    });

    mockPost.mockResolvedValue({ status: 200, data: {} });
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    await AsyncStorage.setItem(
      'BASE_URL',
      'https://coop.example.com/api/courier/v1',
    );
    await AsyncStorage.setItem('token', 'courier-auth-token-xyz');
  });

  it('headless answer reads BASE_URL and token from AsyncStorage itself, sends accept and mark-as-dispatched, and cancels the alert', async () => {
    const offer = {
      deliveryId: 'del-headless-1',
      offeredAt: '2026-10-26T10:00:00.000Z',
    };

    const outcome = await answerOffer(offer, 'accept');

    expect(outcome).toBe('sent');
    // Cancels the alert so ring stops immediately
    expect(notifee.cancelNotification).toHaveBeenCalledWith('del-headless-1');

    // Axios client configured directly from AsyncStorage
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://coop.example.com/api/courier/v1',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer courier-auth-token-xyz',
        },
      }),
    );

    // Accept sends accept then mark-as-dispatched
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      'deliveries/del-headless-1/accept',
      {},
    );
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      'deliveries/del-headless-1/mark-as-dispatched',
      {},
    );

    // Refreshes open app queries
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.newOrders],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
  });

  it('when accept answers 401 and refresh token is saved, renews through auth/refresh-tokens and sends accept again with new bearer, outcome sent', async () => {
    await AsyncStorage.setItem('refreshToken', 'courier-refresh-token-123');

    // 1. Initial accept call gets 401 Unauthorized
    const unauthError: any = new Error('Request failed with status code 401');
    unauthError.response = { status: 401, data: {} };
    mockPost.mockRejectedValueOnce(unauthError);

    // 2. Refresh tokens endpoint succeeds
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        result: {
          session: {
            accessToken: 'renewed-courier-token-abc',
            refreshToken: 'renewed-refresh-token-def',
          },
        },
      },
    });

    // 3. Retried accept call and subsequent mark-as-dispatched call succeed
    mockPost.mockResolvedValueOnce({ status: 200, data: {} });
    mockPost.mockResolvedValueOnce({ status: 200, data: {} });

    const offer = {
      deliveryId: 'del-headless-401-refresh',
      offeredAt: '2026-10-26T10:30:00.000Z',
    };

    const outcome = await answerOffer(offer, 'accept');

    expect(outcome).toBe('sent');

    // axios.post was called to renew token
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://coop.example.com/api/courier/v1/auth/refresh-tokens',
      undefined,
      {
        headers: { 'x-refresh-token': 'courier-refresh-token-123' },
        timeout: 10000,
      },
    );

    // mockPost was called 3 times: failed accept, retried accept, mark-as-dispatched
    expect(mockPost).toHaveBeenCalledTimes(3);
    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      'deliveries/del-headless-401-refresh/accept',
      {},
    );
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      'deliveries/del-headless-401-refresh/accept',
      {},
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer renewed-courier-token-abc',
        }),
      }),
    );
    expect(mockPost).toHaveBeenNthCalledWith(
      3,
      'deliveries/del-headless-401-refresh/mark-as-dispatched',
      {},
    );

    // Tokens were renewed and saved to AsyncStorage
    expect(await AsyncStorage.getItem('token')).toBe(
      'renewed-courier-token-abc',
    );
    expect(await AsyncStorage.getItem('refreshToken')).toBe(
      'renewed-refresh-token-def',
    );
  });

  it('headless decline sends reject and cancels the alert', async () => {
    const offer = {
      deliveryId: 'del-headless-decline',
      offeredAt: '2026-10-26T10:05:00.000Z',
    };

    const outcome = await answerOffer(offer, 'decline');

    expect(outcome).toBe('sent');
    expect(notifee.cancelNotification).toHaveBeenCalledWith(
      'del-headless-decline',
    );

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      'deliveries/del-headless-decline/reject',
      {},
    );
  });

  it('second call for the same offer sends nothing, even after in-memory state is reloaded from storage', async () => {
    const offer = {
      deliveryId: 'del-headless-dup',
      offeredAt: '2026-10-26T10:10:00.000Z',
    };

    const firstOutcome = await answerOffer(offer, 'accept');
    expect(firstOutcome).toBe('sent');
    expect(mockPost).toHaveBeenCalledTimes(2);

    mockPost.mockClear();

    // Second call for same offer
    const secondOutcome = await answerOffer(offer, 'accept');
    expect(secondOutcome).toBe('already-answered');
    expect(mockPost).not.toHaveBeenCalled();

    // Verify persisted list in AsyncStorage
    const stored = await AsyncStorage.getItem('answered_offer_ids');
    expect(stored).not.toBeNull();
    const key = offerKeyOf(offer.deliveryId, offer.offeredAt);
    expect(JSON.parse(stored!)).toContain(key);

    // Re-verify that loadAnsweredOffers keeps it answered even when called again
    await loadAnsweredOffers();
    const thirdOutcome = await answerOffer(offer, 'decline');
    expect(thirdOutcome).toBe('already-answered');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('a 409 cancels the alert, shows a short notice, and sends nothing more', async () => {
    const offer = {
      deliveryId: 'del-headless-409',
      offeredAt: '2026-10-26T10:15:00.000Z',
    };

    const conflictError: any = new Error('Request failed with status code 409');
    conflictError.response = {
      status: 409,
      data: {
        error: true,
        result: [
          { code: OFFER_HAS_ENDED_CODE, message: 'This offer has ended' },
        ],
      },
    };
    mockPost.mockRejectedValueOnce(conflictError);

    const outcome = await answerOffer(offer, 'accept');

    expect(outcome).toBe('ended');
    // Alert is cancelled
    expect(notifee.cancelNotification).toHaveBeenCalledWith('del-headless-409');

    // Only the first call (/accept) was made; /mark-as-dispatched was NOT called
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      'deliveries/del-headless-409/accept',
      {},
    );

    // Shows short notice on offer-notices channel
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'offer-notice-del-headless-409',
        title: 'This offer has ended',
        android: expect.objectContaining({
          channelId: 'offer-notices',
        }),
      }),
    );
  });

  it('network failure unmarks the offer so the rider can retry, and shows a failure notice', async () => {
    const offer = {
      deliveryId: 'del-headless-fail',
      offeredAt: '2026-10-26T10:20:00.000Z',
    };

    mockPost.mockRejectedValueOnce(new Error('Network Error'));

    const outcome = await answerOffer(offer, 'accept');
    expect(outcome).toBe('failed');

    // Displayed failure notice
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'offer-notice-del-headless-fail',
        title: 'Could not send your answer. Open the app to try again.',
      }),
    );

    // Offer was un-marked from answered list so retry is possible
    const key = offerKeyOf(offer.deliveryId, offer.offeredAt);
    const stored = await AsyncStorage.getItem('answered_offer_ids');
    const parsed = stored ? JSON.parse(stored) : [];
    expect(parsed).not.toContain(key);
  });

  it('returns failed without sending if token or BASE_URL are missing from storage', async () => {
    await AsyncStorage.clear();
    const offer = {
      deliveryId: 'del-headless-no-auth',
      offeredAt: '2026-10-26T10:25:00.000Z',
    };

    const outcome = await answerOffer(offer, 'accept');
    expect(outcome).toBe('failed');
    expect(mockPost).not.toHaveBeenCalled();
    expect(notifee.cancelNotification).toHaveBeenCalledWith(
      'del-headless-no-auth',
    );
  });

  describe('mark-as-dispatched error handling in answerOffer (spec 0020, AC-10)', () => {
    it('resolves as sent when mark-as-dispatched answers 409 CANT_UPDATE_DELIVERY_STATUS', async () => {
      const offer = {
        deliveryId: 'del-dispatch-409',
        offeredAt: '2026-10-26T10:40:00.000Z',
      };

      const error409: any = new Error('Request failed with status code 409');
      error409.response = {
        status: 409,
        data: {
          error: true,
          result: [{ code: CANT_UPDATE_DELIVERY_STATUS_CODE }],
        },
      };

      // 1. Accept succeeds
      mockPost.mockResolvedValueOnce({ status: 200, data: {} });
      // 2. Mark as dispatched fails with 409 CANT_UPDATE_DELIVERY_STATUS
      mockPost.mockRejectedValueOnce(error409);

      const outcome = await answerOffer(offer, 'accept');

      expect(outcome).toBe('sent');
      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        'deliveries/del-dispatch-409/accept',
        {},
      );
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        'deliveries/del-dispatch-409/mark-as-dispatched',
        {},
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
    });

    it('resolves as sent when mark-as-dispatched answers 404', async () => {
      const offer = {
        deliveryId: 'del-dispatch-404',
        offeredAt: '2026-10-26T10:41:00.000Z',
      };

      const error404: any = new Error('Request failed with status code 404');
      error404.response = {
        status: 404,
        data: { error: true, message: 'Delivery not found' },
      };

      mockPost.mockResolvedValueOnce({ status: 200, data: {} });
      mockPost.mockRejectedValueOnce(error404);

      const outcome = await answerOffer(offer, 'accept');

      expect(outcome).toBe('sent');
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('fails when mark-as-dispatched answers 500 or 409 with other code', async () => {
      const offer500 = {
        deliveryId: 'del-dispatch-500',
        offeredAt: '2026-10-26T10:42:00.000Z',
      };

      const error500: any = new Error('Request failed with status code 500');
      error500.response = { status: 500, data: { message: 'Crash' } };

      mockPost.mockResolvedValueOnce({ status: 200, data: {} });
      mockPost.mockRejectedValueOnce(error500);

      const outcome500 = await answerOffer(offer500, 'accept');
      expect(outcome500).toBe('failed');

      const offer409Other = {
        deliveryId: 'del-dispatch-409-other',
        offeredAt: '2026-10-26T10:43:00.000Z',
      };

      const error409Other: any = new Error('Request failed with status code 409');
      error409Other.response = {
        status: 409,
        data: { error: true, result: [{ code: 'SOME_OTHER_ERROR' }] },
      };

      mockPost.mockResolvedValueOnce({ status: 200, data: {} });
      mockPost.mockRejectedValueOnce(error409Other);

      const outcome409 = await answerOffer(offer409Other, 'accept');
      expect(outcome409).toBe('failed');
    });
  });
});
