import { AxiosError } from 'axios';
import orderService, {
  isOfferEndedError,
  OFFER_HAS_ENDED_CODE,
} from './orderService';
import { UClient } from './Client';
import { DeliveryIssueReason, OrderStatus } from '@app/types/enums';
import { JobStep } from '@app/utilities/jobSteps';

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

  describe('reportIssue (decision 66.11, Clause 1)', () => {
    it('posts to deliveries/<id>/issues with the body { reason } exactly', async () => {
      const mockPost = jest.fn().mockResolvedValue({ data: { result: 'ok' } });
      const client = {
        post: mockPost,
      } as unknown as UClient;

      const service = orderService(client);
      const response = await service.reportIssue({
        id: 'delivery-abc-123',
        reason: DeliveryIssueReason.WrongAddress,
      });

      expect(mockPost).toHaveBeenCalledTimes(1);
      // Pin literal wire spelling: compare to 'WRONG_ADDRESS', not the enum member
      expect(mockPost).toHaveBeenCalledWith(
        'deliveries/delivery-abc-123/issues',
        { reason: 'WRONG_ADDRESS' },
      );
      // Ensure the request body contains only reason and nothing else
      expect(mockPost.mock.calls[0][1]).toEqual({
        reason: 'WRONG_ADDRESS',
      });
      expect(response).toEqual({ data: { result: 'ok' } });
    });
  });

  describe('reportIssue with note (decision 66.16, Clauses 5 and 6)', () => {
    it('Clause 5: posts { reason: OTHER, note } when a note is provided', async () => {
      const mockPost = jest.fn().mockResolvedValue({ data: { result: 'ok' } });
      const client = {
        post: mockPost,
      } as unknown as UClient;

      const service = orderService(client);
      const response = await service.reportIssue({
        id: 'delivery-other-456',
        reason: DeliveryIssueReason.Other,
        note: 'Customer asked to leave at back door',
      });

      expect(mockPost).toHaveBeenCalledTimes(1);
      // Pin literal wire spelling: compare to 'OTHER', not the enum member
      expect(mockPost).toHaveBeenCalledWith(
        'deliveries/delivery-other-456/issues',
        {
          reason: 'OTHER',
          note: 'Customer asked to leave at back door',
        },
      );
      expect(mockPost.mock.calls[0][1].reason).toBe('OTHER');
      expect(response).toEqual({ data: { result: 'ok' } });
    });

    it('Clause 6: posts { reason } alone without a note key when note is undefined or empty', async () => {
      const mockPost = jest.fn().mockResolvedValue({ data: { result: 'ok' } });
      const client = {
        post: mockPost,
      } as unknown as UClient;

      const service = orderService(client);

      // Call with note: undefined
      await service.reportIssue({
        id: 'delivery-789',
        reason: DeliveryIssueReason.NoSignal,
        note: undefined,
      });

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenLastCalledWith(
        'deliveries/delivery-789/issues',
        {
          reason: 'NO_SIGNAL',
        },
      );
      expect('note' in mockPost.mock.calls[0][1]).toBe(false);
      expect(Object.keys(mockPost.mock.calls[0][1])).toEqual(['reason']);

      // Call with note: '' (empty string)
      await service.reportIssue({
        id: 'delivery-789',
        reason: DeliveryIssueReason.OrderHanded,
        note: '',
      });

      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPost).toHaveBeenLastCalledWith(
        'deliveries/delivery-789/issues',
        {
          reason: 'ORDER_HANDED',
        },
      );
      expect('note' in mockPost.mock.calls[1][1]).toBe(false);
      expect(Object.keys(mockPost.mock.calls[1][1])).toEqual(['reason']);
    });
  });

  describe('sendJobStep (spec 0009, AC-2, AC-4, AC-6)', () => {
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

    it('posts to deliveries/<id>/<route> for each of the five job steps', async () => {
      const stepsAndRoutes: [JobStep, string][] = [
        ['dispatched', 'mark-as-dispatched'],
        ['arrived_at_pickup', 'arrived-at-pickup'],
        ['picked_up', 'mark-as-picked-up'],
        ['arrived_at_dropoff', 'arrived-at-dropoff'],
        ['delivered', 'mark-as-delivered'],
      ];

      for (const [step, route] of stepsAndRoutes) {
        const mockPost = jest
          .fn()
          .mockResolvedValue({ data: { result: { status: 'ANY' } } });
        const client = { post: mockPost } as unknown as UClient;
        const service = orderService(client);

        await service.sendJobStep({ deliveryId: `del-${step}`, step }, 500);

        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost).toHaveBeenCalledWith(
          `deliveries/del-${step}/${route}`,
          { tapAgeMs: 500 },
        );
      }
    });

    it('sends { tapAgeMs } alone when note is not provided or empty', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: { result: { status: OrderStatus.dispatched } },
      });
      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      await service.sendJobStep(
        { deliveryId: 'del-123', step: 'dispatched' },
        350,
      );

      expect(mockPost).toHaveBeenCalledTimes(1);
      const payload = mockPost.mock.calls[0][1];
      expect(payload).toEqual({ tapAgeMs: 350 });
      expect('note' in payload).toBe(false);
      expect(Object.keys(payload)).toEqual(['tapAgeMs']);
    });

    it('sends { tapAgeMs, note } only when note is given', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: { result: { status: OrderStatus.dropped_off } },
      });
      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      await service.sendJobStep(
        {
          deliveryId: 'del-123',
          step: 'delivered',
          note: 'Left package at side door',
        },
        1250,
      );

      expect(mockPost).toHaveBeenCalledTimes(1);
      const payload = mockPost.mock.calls[0][1];
      expect(payload).toEqual({
        tapAgeMs: 1250,
        note: 'Left package at side door',
      });
      expect(payload.note).toBe('Left package at side door');
    });

    it('returns { kind: "delivery", status: data.result.status } on 2xx answer', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          result: {
            id: 'del-123',
            status: OrderStatus.picked_up,
          },
        },
      });
      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      const answer = await service.sendJobStep(
        { deliveryId: 'del-123', step: 'picked_up' },
        800,
      );

      expect(answer).toEqual({
        kind: 'delivery',
        status: OrderStatus.picked_up,
      });
    });

    it('returns { kind: "error", httpStatus, code } for an axios error with a response', async () => {
      const axiosError409 = makeAxiosError(409, {
        error: true,
        result: [{ code: 'CANT_UPDATE_DELIVERY_STATUS', message: 'Conflict' }],
      });
      const mockPost409 = jest.fn().mockRejectedValue(axiosError409);
      const service409 = orderService({
        post: mockPost409,
      } as unknown as UClient);

      const answer409 = await service409.sendJobStep(
        { deliveryId: 'del-123', step: 'arrived_at_pickup' },
        400,
      );

      expect(answer409).toEqual({
        kind: 'error',
        httpStatus: 409,
        code: 'CANT_UPDATE_DELIVERY_STATUS',
      });

      const axiosError404 = makeAxiosError(404, {
        error: true,
        result: [],
      });
      const mockPost404 = jest.fn().mockRejectedValue(axiosError404);
      const service404 = orderService({
        post: mockPost404,
      } as unknown as UClient);

      const answer404 = await service404.sendJobStep(
        { deliveryId: 'del-123', step: 'arrived_at_pickup' },
        400,
      );

      expect(answer404).toEqual({
        kind: 'error',
        httpStatus: 404,
        code: undefined,
      });
    });

    it('returns { kind: "none" } for an error with no response (network, timeout)', async () => {
      // Axios error without response (e.g. network down, offline)
      const networkError = new AxiosError('Network Error');
      networkError.response = undefined;
      const mockPostNet = jest.fn().mockRejectedValue(networkError);
      const serviceNet = orderService({
        post: mockPostNet,
      } as unknown as UClient);

      const answerNet = await serviceNet.sendJobStep(
        { deliveryId: 'del-123', step: 'dispatched' },
        100,
      );
      expect(answerNet).toEqual({ kind: 'none' });

      // Timeout error (e.g. 10s request timeout)
      const timeoutError = new AxiosError(
        'timeout of 10000ms exceeded',
        'ECONNABORTED',
      );
      timeoutError.response = undefined;
      const mockPostTimeout = jest.fn().mockRejectedValue(timeoutError);
      const serviceTimeout = orderService({
        post: mockPostTimeout,
      } as unknown as UClient);

      const answerTimeout = await serviceTimeout.sendJobStep(
        { deliveryId: 'del-123', step: 'dispatched' },
        100,
      );
      expect(answerTimeout).toEqual({ kind: 'none' });

      // Generic non-Axios error
      const genericError = new Error('Unexpected client exception');
      const mockPostGeneric = jest.fn().mockRejectedValue(genericError);
      const serviceGeneric = orderService({
        post: mockPostGeneric,
      } as unknown as UClient);

      const answerGeneric = await serviceGeneric.sendJobStep(
        { deliveryId: 'del-123', step: 'dispatched' },
        100,
      );
      expect(answerGeneric).toEqual({ kind: 'none' });
    });

    it('never throws even when client.post throws or rejects', async () => {
      const throwingClient = {
        post: jest.fn().mockImplementation(() => {
          throw new Error('Immediate synchronous throw');
        }),
      } as unknown as UClient;
      const service = orderService(throwingClient);

      await expect(
        service.sendJobStep({ deliveryId: 'del-123', step: 'dispatched' }, 100),
      ).resolves.toEqual({ kind: 'none' });
    });
  });
});
