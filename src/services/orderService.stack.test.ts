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
        result: [{ code: 'STACK_CHANGED', message }],
      });

      expect(serverSentenceOf(error)).toBe(message);
    });

    it('falls back to the server message when the code is unknown', () => {
      const message = 'Some custom refusal from newer backend';
      const error = makeAxiosError(409, {
        error: true,
        result: [{ code: 'UNKNOWN_NEW_CODE', message }],
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
      expect(
        serverSentenceOf(makeAxiosError(409, { result: 'invalid' })),
      ).toBeNull();
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

      expect(mockPost).toHaveBeenNthCalledWith(1, 'deliveries/order-1/accept', {
        automatic: true,
      });
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

    it('when marking partner as dispatched fails, catches the error, logs a warning, and still marks primary order as dispatched', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const mockPost = jest.fn().mockImplementation((url: string) => {
        if (url === 'deliveries/order-2/mark-as-dispatched') {
          return Promise.reject(new Error('Network error on partner dispatch'));
        }
        return Promise.resolve({ data: { result: 'ok' } });
      });
      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      // acceptOrder should resolve successfully without throwing
      await expect(
        service.acceptOrder({
          id: 'order-1',
          partnerId: 'order-2',
          automatic: false,
        }),
      ).resolves.toEqual({ data: { result: 'ok' } });

      // 1. Accepts order-1
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        'deliveries/order-1/accept',
        {},
      );

      // 2. Attempted to mark partner order-2 as dispatched (which rejected)
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        'deliveries/order-2/mark-as-dispatched',
        {},
      );

      // 3. Warning was logged for the partner dispatch failure
      expect(warnSpy).toHaveBeenCalledWith(
        'Could not mark the other order order-2 as dispatched',
        expect.any(Error),
      );

      // 4. Primary order-1 was still marked as dispatched!
      expect(mockPost).toHaveBeenNthCalledWith(
        3,
        'deliveries/order-1/mark-as-dispatched',
        {},
      );

      warnSpy.mockRestore();
    });

    it('when marking primary order as dispatched fails, acceptOrder resolves and logs a warning (row 80 review)', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const dispatchError = new Error('Primary dispatch failed');
      const mockPost = jest.fn().mockImplementation((url: string) => {
        if (url === 'deliveries/order-1/mark-as-dispatched') {
          return Promise.reject(dispatchError);
        }
        return Promise.resolve({ data: { result: 'ok' } });
      });
      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      await expect(
        service.acceptOrder({
          id: 'order-1',
          partnerId: 'order-2',
          automatic: false,
        }),
      ).resolves.toEqual({ data: null, error: null });

      expect(warnSpy).toHaveBeenCalledWith(
        'Could not mark order order-1 as dispatched',
        dispatchError,
      );
      warnSpy.mockRestore();
    });

    it('when both partner and primary dispatch fail, acceptOrder still resolves and logs both warnings', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const partnerError = new Error('Partner dispatch failed');
      const primaryError = new Error('Primary dispatch failed');
      const mockPost = jest.fn().mockImplementation((url: string) => {
        if (url === 'deliveries/order-2/mark-as-dispatched') {
          return Promise.reject(partnerError);
        }
        if (url === 'deliveries/order-1/mark-as-dispatched') {
          return Promise.reject(primaryError);
        }
        return Promise.resolve({ data: { result: 'ok' } });
      });
      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      await expect(
        service.acceptOrder({
          id: 'order-1',
          partnerId: 'order-2',
          automatic: false,
        }),
      ).resolves.toEqual({ data: null, error: null });

      expect(warnSpy).toHaveBeenCalledWith(
        'Could not mark the other order order-2 as dispatched',
        partnerError,
      );
      expect(warnSpy).toHaveBeenCalledWith(
        'Could not mark order order-1 as dispatched',
        primaryError,
      );
      warnSpy.mockRestore();
    });
  });
});
