import { AxiosError } from 'axios';
import orderService, {
  isOfferEndedError,
  OFFER_HAS_ENDED_CODE,
} from './orderService';
import { UClient } from './Client';

describe('orderService & isOfferEndedError (spec 0002, AC-5)', () => {
  describe('isOfferEndedError', () => {
    const makeAxiosError = (status: number, data: unknown): AxiosError => {
      const err = new AxiosError('Request failed');
      err.response = {
        status,
        statusText: 'Error',
        headers: {},
        config: {} as any,
        data,
      };
      return err;
    };

    it('returns true for 409 with result containing OFFER_HAS_ENDED code', () => {
      const error = makeAxiosError(409, {
        error: true,
        result: [
          { code: OFFER_HAS_ENDED_CODE, message: 'This offer has ended' },
        ],
      });

      expect(isOfferEndedError(error)).toBe(true);
    });

    it('returns false for 409 with another server error code (e.g. CANT_UPDATE_DELIVERY_STATUS)', () => {
      const error = makeAxiosError(409, {
        error: true,
        result: [
          { code: 'CANT_UPDATE_DELIVERY_STATUS', message: 'Status conflict' },
        ],
      });

      expect(isOfferEndedError(error)).toBe(false);
    });

    it('returns false when status is not 409 even if OFFER_HAS_ENDED is present', () => {
      const error500 = makeAxiosError(500, {
        error: true,
        result: [{ code: OFFER_HAS_ENDED_CODE }],
      });
      const error400 = makeAxiosError(400, {
        error: true,
        result: [{ code: OFFER_HAS_ENDED_CODE }],
      });

      expect(isOfferEndedError(error500)).toBe(false);
      expect(isOfferEndedError(error400)).toBe(false);
    });

    it('returns false when response.data.result is missing or not an array', () => {
      const errorNoResult = makeAxiosError(409, { message: 'Some error' });
      const errorResultNotArray = makeAxiosError(409, {
        result: 'not-an-array',
      });

      expect(isOfferEndedError(errorNoResult)).toBe(false);
      expect(isOfferEndedError(errorResultNotArray)).toBe(false);
    });

    it('returns false for non-Axios error or non-error objects', () => {
      expect(isOfferEndedError(new Error('Generic failure'))).toBe(false);
      expect(isOfferEndedError({ message: 'Fake error' })).toBe(false);
      expect(isOfferEndedError(null)).toBe(false);
      expect(isOfferEndedError(undefined)).toBe(false);
      expect(isOfferEndedError('string error')).toBe(false);
    });
  });

  describe('getNewOrders attaches phoneClock', () => {
    it('corrects phoneClock using request midpoint for a 2s network round-trip (M4)', async () => {
      let currentTime = 1_000_000;
      const dateNowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => currentTime);

      const serverNow = '2026-10-26T12:00:00.000Z';
      const offeredAt = '2026-10-26T11:59:40.000Z';
      const offerExpiresAt = '2026-10-26T12:00:40.000Z';

      const mockGet = jest.fn().mockImplementation(async () => {
        // Simulate a 2s network round-trip
        currentTime += 2000;
        return {
          data: {
            result: {
              serverNow,
              data: [
                {
                  id: 'order-1',
                  offeredAt,
                  offerExpiresAt,
                },
              ],
            },
          },
        };
      });

      const client = {
        get: mockGet,
      } as unknown as UClient;

      const service = orderService(client);

      try {
        const orders = await service.getNewOrders();

        expect(mockGet).toHaveBeenCalledWith(
          'deliveries/new?page=1&perPage=10',
        );
        expect(orders).toHaveLength(1);
        expect(orders[0].id).toBe('order-1');
        expect(orders[0].phoneClock).toBeDefined();

        // sentAt = 1,000,000; receivedAt = 1,002,000; midpoint phoneNow = 1,001,000.
        // serverExpiresAt - serverNow = +40,000 ms.
        // Midpoint phone deadline = 1,001,000 + 40,000 = 1,041,000.
        // If phoneNow were read only after the response (post-response bug), it would be
        // 1,002,000 + 40,000 = 1,042,000 (1 s later than true server deadline).
        expect(orders[0].phoneClock?.expiresAt).toBe(1041000);
        expect(orders[0].phoneClock?.offeredAt).toBe(981000);
      } finally {
        dateNowSpy.mockRestore();
      }
    });
  });
});
