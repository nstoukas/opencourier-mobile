import { AxiosError } from 'axios';
import orderService, { serverSentenceOf } from './orderService';
import { UClient } from './Client';

describe('orderService.stack & serverSentenceOf (spec 0048, AC-5)', () => {
  describe('serverSentenceOf', () => {
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

    it('extracts the server message on 409 when result has a message', () => {
      const message =
        'One order of this pair changed before your answer arrived, so nothing was accepted. Check your offers again.';
      const error = makeAxiosError(409, {
        error: true,
        result: [{ code: 'ORDER_CHANGED', message }],
      });

      expect(serverSentenceOf(error)).toBe(message);
    });

    it('returns null if error is not 409', () => {
      const error500 = makeAxiosError(500, {
        result: [{ message: 'Internal error' }],
      });
      const error404 = makeAxiosError(404, {
        result: [{ message: 'Not found' }],
      });

      expect(serverSentenceOf(error500)).toBeNull();
      expect(serverSentenceOf(error404)).toBeNull();
    });

    it('returns null if result is missing, not an array, or empty', () => {
      expect(serverSentenceOf(makeAxiosError(409, {}))).toBeNull();
      expect(serverSentenceOf(makeAxiosError(409, { result: [] }))).toBeNull();
      expect(serverSentenceOf(makeAxiosError(409, { result: 'invalid' }))).toBeNull();
      expect(
        serverSentenceOf(makeAxiosError(409, { result: [{ message: '' }] })),
      ).toBeNull();
    });

    it('returns null for generic Error or non-Axios objects', () => {
      expect(serverSentenceOf(new Error('Network error'))).toBeNull();
      expect(serverSentenceOf(null)).toBeNull();
      expect(serverSentenceOf(undefined)).toBeNull();
    });
  });

  describe('acceptOrder for a stack (partnerId provided)', () => {
    it('calls accept on the primary id, then marks BOTH orders as dispatched', async () => {
      const mockPost = jest.fn().mockResolvedValue({ data: { result: 'ok' } });
      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      await service.acceptOrder({
        id: 'order-1',
        partnerId: 'order-2',
        automatic: false,
      });

      // 1. Accepts order-1 with empty body (since automatic is false)
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        'deliveries/order-1/accept',
        {},
      );

      // 2. Marks partner order-2 as dispatched
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        'deliveries/order-2/mark-as-dispatched',
        {},
      );

      // 3. Marks primary order-1 as dispatched
      expect(mockPost).toHaveBeenNthCalledWith(
        3,
        'deliveries/order-1/mark-as-dispatched',
        {},
      );

      expect(mockPost).toHaveBeenCalledTimes(3);
    });

    it('passes automatic: true to the accept endpoint if specified', async () => {
      const mockPost = jest.fn().mockResolvedValue({ data: { result: 'ok' } });
      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      await service.acceptOrder({
        id: 'order-1',
        partnerId: 'order-2',
        automatic: true,
      });

      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        'deliveries/order-1/accept',
        { automatic: true },
      );
    });

    it('for single order without partnerId: only marks id as dispatched', async () => {
      const mockPost = jest.fn().mockResolvedValue({ data: { result: 'ok' } });
      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      await service.acceptOrder({
        id: 'order-single',
      });

      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        'deliveries/order-single/accept',
        {},
      );
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        'deliveries/order-single/mark-as-dispatched',
        {},
      );
    });
  });
});
