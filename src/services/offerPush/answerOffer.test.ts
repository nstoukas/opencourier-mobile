import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import notifee from '@notifee/react-native';
import { OFFER_HAS_ENDED_CODE } from '@app/services/orderService';
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
    mockedAxios.create.mockReturnValue({
      post: mockPost,
    } as any);

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
});
