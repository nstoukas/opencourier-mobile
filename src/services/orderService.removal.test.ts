import orderService from './orderService';
import { UClient } from './Client';
import { RemovalReason, RemovalRequest } from '@app/types/types';

describe('orderService removal endpoints (spec 0035, AC-3, AC-4, AC-5, AC-22)', () => {
  describe('getRemovalReasons (AC-3)', () => {
    it("GETs 'removal-reasons' and returns data.result", async () => {
      const mockReasons: RemovalReason[] = [
        {
          id: 'reason-1',
          label: 'Moped breakdown or accident',
          paid: true,
          needsNote: false,
        },
        {
          id: 'reason-2',
          label: 'Other',
          paid: true,
          needsNote: true,
        },
      ];

      const mockGet = jest.fn().mockResolvedValue({
        data: {
          error: false,
          result: mockReasons,
        },
      });

      const client = { get: mockGet } as unknown as UClient;
      const service = orderService(client);

      const result = await service.getRemovalReasons();

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledWith('removal-reasons');
      expect(result).toEqual(mockReasons);
    });
  });

  describe('sendRemovalRequest (AC-4, AC-22)', () => {
    it('POSTs deliveries/:id/removal-request with exactly { reasonId, note } when note is given', async () => {
      const mockCreatedRequest: RemovalRequest = {
        id: 'req-1',
        status: 'OPEN',
        label: 'Other',
        paid: true,
        decisionNote: null,
        createdAt: '2026-11-09T10:00:00Z',
      };

      const mockPost = jest.fn().mockResolvedValue({
        data: {
          error: false,
          result: mockCreatedRequest,
        },
      });

      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      const result = await service.sendRemovalRequest({
        id: 'del-send-1',
        reasonId: 'reason-2',
        note: 'Customer address is blocked by police',
      });

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        'deliveries/del-send-1/removal-request',
        expect.anything(),
      );

      // toEqual on the whole body: anything extra (such as position/lat/lng) fails
      const [, body] = mockPost.mock.calls[0];
      expect(body).toEqual({
        reasonId: 'reason-2',
        note: 'Customer address is blocked by police',
      });
      expect(result).toEqual(mockCreatedRequest);
    });

    it('POSTs deliveries/:id/removal-request with exactly { reasonId } when note is not given or undefined', async () => {
      const mockCreatedRequest: RemovalRequest = {
        id: 'req-2',
        status: 'OPEN',
        label: 'Moped breakdown',
        paid: true,
        decisionNote: null,
        createdAt: '2026-11-09T10:00:00Z',
      };

      const mockPost = jest.fn().mockResolvedValue({
        data: {
          error: false,
          result: mockCreatedRequest,
        },
      });

      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      const result = await service.sendRemovalRequest({
        id: 'del-send-2',
        reasonId: 'reason-1',
      });

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        'deliveries/del-send-2/removal-request',
        expect.anything(),
      );

      // toEqual on the whole body: exactly { reasonId }, nothing else
      const [, body] = mockPost.mock.calls[0];
      expect(body).toEqual({
        reasonId: 'reason-1',
      });
      expect(result).toEqual(mockCreatedRequest);
    });
  });

  describe('withdrawRemovalRequest (AC-5)', () => {
    it("POSTs 'deliveries/:id/removal-request/withdraw' and returns data.result", async () => {
      const mockAnswer = { status: 'WITHDRAWN' };
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          error: false,
          result: mockAnswer,
        },
      });

      const client = { post: mockPost } as unknown as UClient;
      const service = orderService(client);

      const result = await service.withdrawRemovalRequest('del-withdraw-1');

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        'deliveries/del-withdraw-1/removal-request/withdraw',
      );
      expect(result).toEqual(mockAnswer);
    });
  });
});
