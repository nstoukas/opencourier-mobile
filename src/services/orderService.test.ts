import { AxiosError } from 'axios';
import orderService, {
  isOfferEndedError,
  OFFER_HAS_ENDED_CODE,
  isCantUpdateStatusError,
  isDispatchNoLongerNeeded,
  CANT_UPDATE_DELIVERY_STATUS_CODE,
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

    it('sends detected: true only on arrived routes and only when detected is true (spec 0021, AC-4, AC-13)', async () => {
      const arrivedSteps: JobStep[] = [
        'arrived_at_pickup',
        'arrived_at_dropoff',
      ];

      for (const step of arrivedSteps) {
        const mockPost = jest.fn().mockResolvedValue({
          data: { result: { status: 'ANY' } },
        });
        const client = { post: mockPost } as unknown as UClient;
        const service = orderService(client);

        await (service.sendJobStep as any)(
          { deliveryId: 'del-123', step, detected: true },
          200,
        );

        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost.mock.calls[0][1]).toEqual({
          tapAgeMs: 200,
          detected: true,
        });
      }

      // When detected is false or undefined on arrived step: detected is NOT sent
      for (const detectedVal of [false, undefined]) {
        const mockPost = jest.fn().mockResolvedValue({
          data: { result: { status: 'ANY' } },
        });
        const client = { post: mockPost } as unknown as UClient;
        const service = orderService(client);

        await (service.sendJobStep as any)(
          {
            deliveryId: 'del-123',
            step: 'arrived_at_pickup',
            detected: detectedVal,
          },
          200,
        );

        expect(mockPost.mock.calls[0][1]).toEqual({ tapAgeMs: 200 });
        expect('detected' in mockPost.mock.calls[0][1]).toBe(false);
      }

      // Non-arrived steps never send detected even if set to true
      const otherSteps: JobStep[] = ['dispatched', 'picked_up', 'delivered'];
      for (const step of otherSteps) {
        const mockPost = jest.fn().mockResolvedValue({
          data: { result: { status: 'ANY' } },
        });
        const client = { post: mockPost } as unknown as UClient;
        const service = orderService(client);

        await (service.sendJobStep as any)(
          { deliveryId: 'del-123', step, detected: true },
          200,
        );

        expect(mockPost.mock.calls[0][1]).toEqual({ tapAgeMs: 200 });
        expect('detected' in mockPost.mock.calls[0][1]).toBe(false);
      }
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

  describe('moveDropoffPin (spec 0016, AC-9)', () => {
    it('posts to deliveries/:id/dropoff-point with latitude and longitude as numbers', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          error: false,
          result: { savedCustomerUpdated: true, distanceMetres: 141 },
        },
      });
      const service = orderService({ post: mockPost } as unknown as UClient);

      await service.moveDropoffPin({
        id: 'del-456',
        latitude: 39.3622,
        longitude: 22.9425,
      });

      expect(mockPost).toHaveBeenCalledWith(
        'deliveries/del-456/dropoff-point',
        {
          latitude: 39.3622,
          longitude: 22.9425,
        },
      );
      const payload = mockPost.mock.calls[0][1];
      expect(typeof payload.latitude).toBe('number');
      expect(typeof payload.longitude).toBe('number');
    });

    it('returns data.result from the server answer', async () => {
      const serverResult = {
        savedCustomerUpdated: false,
        distanceMetres: 30,
      };
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          error: false,
          result: serverResult,
        },
      });
      const service = orderService({ post: mockPost } as unknown as UClient);

      const result = await service.moveDropoffPin({
        id: 'del-789',
        latitude: 39.37,
        longitude: 22.95,
      });

      expect(result).toEqual(serverResult);
    });

    it('throws when client.post rejects', async () => {
      const networkError = new AxiosError('Network error');
      const mockPost = jest.fn().mockRejectedValue(networkError);
      const service = orderService({ post: mockPost } as unknown as UClient);

      await expect(
        service.moveDropoffPin({
          id: 'del-789',
          latitude: 39.37,
          longitude: 22.95,
        }),
      ).rejects.toThrow(networkError);
    });
  });

  describe('isCantUpdateStatusError & isDispatchNoLongerNeeded (spec 0020, AC-10)', () => {
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

    it('isCantUpdateStatusError returns true for 409 with CANT_UPDATE_DELIVERY_STATUS code', () => {
      const error = makeAxiosError(409, {
        error: true,
        result: [
          {
            code: CANT_UPDATE_DELIVERY_STATUS_CODE,
            message: 'Status cannot be updated',
          },
        ],
      });
      expect(isCantUpdateStatusError(error)).toBe(true);
    });

    it('isCantUpdateStatusError returns false for 409 with another code', () => {
      const error = makeAxiosError(409, {
        error: true,
        result: [{ code: 'OTHER_CODE' }],
      });
      expect(isCantUpdateStatusError(error)).toBe(false);
    });

    it('isCantUpdateStatusError returns false for non-409 errors and non-Axios errors', () => {
      const error500 = makeAxiosError(500, {
        result: [{ code: CANT_UPDATE_DELIVERY_STATUS_CODE }],
      });
      expect(isCantUpdateStatusError(error500)).toBe(false);
      expect(isCantUpdateStatusError(new Error('fail'))).toBe(false);
      expect(isCantUpdateStatusError(null)).toBe(false);
    });

    it('isDispatchNoLongerNeeded returns true for 409 CANT_UPDATE_DELIVERY_STATUS and 404', () => {
      const error409 = makeAxiosError(409, {
        error: true,
        result: [{ code: CANT_UPDATE_DELIVERY_STATUS_CODE }],
      });
      const error404 = makeAxiosError(404, {
        error: true,
        message: 'Delivery not found',
      });

      expect(isDispatchNoLongerNeeded(error409)).toBe(true);
      expect(isDispatchNoLongerNeeded(error404)).toBe(true);
    });

    it('isDispatchNoLongerNeeded returns false for 500 or 409 with other code', () => {
      const error409Other = makeAxiosError(409, {
        result: [{ code: 'SOME_OTHER_CODE' }],
      });
      const error500 = makeAxiosError(500, {
        message: 'Internal server error',
      });

      expect(isDispatchNoLongerNeeded(error409Other)).toBe(false);
      expect(isDispatchNoLongerNeeded(error500)).toBe(false);
      expect(isDispatchNoLongerNeeded(new Error('plain error'))).toBe(false);
    });
  });

  describe('acceptOrder (spec 0020, AC-1, AC-10, AC-11)', () => {
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

    it('sends { automatic: true } on accept call when automatic is true, and marks dispatched', async () => {
      const mockPost = jest
        .fn()
        .mockResolvedValueOnce({ data: { result: { id: 'del-101' } } })
        .mockResolvedValueOnce({
          data: { result: { status: OrderStatus.dispatched } },
        });

      const service = orderService({ post: mockPost } as unknown as UClient);
      const res = await service.acceptOrder({ id: 'del-101', automatic: true });

      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPost).toHaveBeenNthCalledWith(1, 'deliveries/del-101/accept', {
        automatic: true,
      });
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        'deliveries/del-101/mark-as-dispatched',
        {},
      );
      expect(res).toEqual({
        data: { result: { status: OrderStatus.dispatched } },
      });
    });

    it('sends empty body {} on accept call when automatic is false or omitted (AC-11)', async () => {
      const mockPost = jest.fn().mockResolvedValue({ data: { result: {} } });

      const service = orderService({ post: mockPost } as unknown as UClient);

      // automatic: false
      await service.acceptOrder({ id: 'del-102', automatic: false });
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        'deliveries/del-102/accept',
        {},
      );

      // automatic omitted
      await service.acceptOrder({ id: 'del-103' });
      expect(mockPost).toHaveBeenNthCalledWith(
        3,
        'deliveries/del-103/accept',
        {},
      );
    });

    it('resolves { data: null, error: null } without throwing when mark-as-dispatched answers 409 CANT_UPDATE_DELIVERY_STATUS (AC-10)', async () => {
      const error409 = makeAxiosError(409, {
        error: true,
        result: [{ code: CANT_UPDATE_DELIVERY_STATUS_CODE }],
      });
      const mockPost = jest
        .fn()
        .mockResolvedValueOnce({ data: { result: 'accepted' } })
        .mockRejectedValueOnce(error409);

      const service = orderService({ post: mockPost } as unknown as UClient);
      const res = await service.acceptOrder({ id: 'del-104', automatic: true });

      expect(res).toEqual({ data: null, error: null });
    });

    it('resolves { data: null, error: null } without throwing when mark-as-dispatched answers 404 (AC-10)', async () => {
      const error404 = makeAxiosError(404, {
        error: true,
        message: 'Delivery not found',
      });
      const mockPost = jest
        .fn()
        .mockResolvedValueOnce({ data: { result: 'accepted' } })
        .mockRejectedValueOnce(error404);

      const service = orderService({ post: mockPost } as unknown as UClient);
      const res = await service.acceptOrder({
        id: 'del-105',
        automatic: false,
      });

      expect(res).toEqual({ data: null, error: null });
    });

    it('throws when mark-as-dispatched answers 500 or 409 with other code', async () => {
      const error500 = makeAxiosError(500, { message: 'Server crashed' });
      const mockPost500 = jest
        .fn()
        .mockResolvedValueOnce({ data: {} })
        .mockRejectedValueOnce(error500);

      const service500 = orderService({
        post: mockPost500,
      } as unknown as UClient);
      await expect(service500.acceptOrder({ id: 'del-106' })).rejects.toThrow(
        error500,
      );

      const error409Other = makeAxiosError(409, {
        result: [{ code: 'DIFFERENT_CODE' }],
      });
      const mockPost409 = jest
        .fn()
        .mockResolvedValueOnce({ data: {} })
        .mockRejectedValueOnce(error409Other);

      const service409 = orderService({
        post: mockPost409,
      } as unknown as UClient);
      await expect(service409.acceptOrder({ id: 'del-107' })).rejects.toThrow(
        error409Other,
      );
    });

    it('throws when the initial accept call fails', async () => {
      const errorAccept = makeAxiosError(409, {
        result: [{ code: 'ALREADY_ASSIGNED' }],
      });
      const mockPost = jest.fn().mockRejectedValue(errorAccept);

      const service = orderService({ post: mockPost } as unknown as UClient);
      await expect(service.acceptOrder({ id: 'del-108' })).rejects.toThrow(
        errorAccept,
      );
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('handBack (spec 0020, AC-9)', () => {
    it('posts to deliveries/<id>/hand-back with no body and returns data.result', async () => {
      const mockResult = { status: 'ASSIGNING_COURIER' };
      const mockPost = jest.fn().mockResolvedValue({
        data: { result: mockResult },
      });

      const service = orderService({ post: mockPost } as unknown as UClient);
      const res = await service.handBack('del-handback-1');

      expect(mockPost).toHaveBeenCalledWith(
        'deliveries/del-handback-1/hand-back',
      );
      expect(res).toEqual(mockResult);
    });

    it('throws when client.post rejects on handBack', async () => {
      const err = new AxiosError('Hand back refused');
      const mockPost = jest.fn().mockRejectedValue(err);

      const service = orderService({ post: mockPost } as unknown as UClient);
      await expect(service.handBack('del-handback-2')).rejects.toThrow(err);
    });
  });

  describe('getInProgressOrders attaches handBackUntilOnPhone (spec 0020, AC-3)', () => {
    it('corrects handBackUntil using midpoint, giving identical seconds left even with phone clock 5 minutes off', async () => {
      const serverNow = '2026-11-02T12:00:00.000Z';
      const handBackUntil = '2026-11-02T12:01:00.000Z'; // 60s window on server

      // Scenario A: Phone clock is accurate (phoneNow matches serverNow)
      let phoneTimeAccurate = new Date(serverNow).getTime(); // 12:00:00.000Z
      const dateSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => phoneTimeAccurate);

      const mockGet = jest.fn().mockImplementation(async () => {
        phoneTimeAccurate += 2000; // 2s round trip
        return {
          data: {
            result: {
              serverNow,
              data: [
                { id: 'del-hb-1', handBackUntil },
                { id: 'del-no-hb', handBackUntil: null },
              ],
            },
          },
        };
      });

      const service = orderService({ get: mockGet } as unknown as UClient);

      try {
        const ordersAccurate = await service.getInProgressOrders();
        expect(ordersAccurate).toHaveLength(2);

        // sentAt = 12:00:00, receivedAt = 12:00:02 -> midpoint = 12:00:01
        // serverExpiresAt - serverNow = +60,000 ms
        // handBackUntilOnPhone = midpoint + 60,000
        const midpointAccurate = new Date(serverNow).getTime() + 1000;
        expect(ordersAccurate[0].handBackUntilOnPhone).toBe(
          midpointAccurate + 60000,
        );
        const secondsLeftAccurate =
          (ordersAccurate[0].handBackUntilOnPhone! - midpointAccurate) / 1000;
        expect(secondsLeftAccurate).toBe(60);

        // Job without handBackUntil is returned unchanged (no handBackUntilOnPhone property added)
        expect(ordersAccurate[1].handBackUntil).toBeNull();
        expect(ordersAccurate[1].handBackUntilOnPhone).toBeUndefined();

        // Scenario B: Phone clock is 5 minutes in the past
        let phoneTimeFast = new Date(serverNow).getTime() - 5 * 60 * 1000; // 11:55:00
        dateSpy.mockImplementation(() => phoneTimeFast);

        mockGet.mockImplementation(async () => {
          phoneTimeFast += 2000;
          return {
            data: {
              result: {
                serverNow,
                data: [{ id: 'del-hb-1', handBackUntil }],
              },
            },
          };
        });

        const ordersFast = await service.getInProgressOrders();
        const midpointFast =
          new Date(serverNow).getTime() - 5 * 60 * 1000 + 1000;
        expect(ordersFast[0].handBackUntilOnPhone).toBe(midpointFast + 60000);

        // Crucial: seconds left from the phone's now at the midpoint is STILL exactly 60 seconds!
        const secondsLeftFast =
          (ordersFast[0].handBackUntilOnPhone! - midpointFast) / 1000;
        expect(secondsLeftFast).toBe(60);
      } finally {
        dateSpy.mockRestore();
      }
    });

    it('returns jobs without handBackUntil unchanged', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        data: {
          result: {
            serverNow: '2026-11-02T12:00:00.000Z',
            data: [
              { id: 'del-plain-1' },
              { id: 'del-plain-2', handBackUntil: null },
            ],
          },
        },
      });

      const service = orderService({ get: mockGet } as unknown as UClient);
      const orders = await service.getInProgressOrders();

      expect(orders[0].handBackUntilOnPhone).toBeUndefined();
      expect(orders[1].handBackUntilOnPhone).toBeUndefined();
    });
  });
});
