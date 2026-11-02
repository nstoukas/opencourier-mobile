import axios from 'axios';
import sosService, { SOS_NOT_ACTIVE_CODE } from './sosService';
import { UClient } from './Client';

describe('sosService (spec 0022, Courier API routes)', () => {
  let mockClient: jest.Mocked<UClient>;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      defaults: { headers: { common: {} } },
    } as unknown as jest.Mocked<UClient>;
  });

  describe('start', () => {
    it('POSTs to "sos" with clientId, tapAgeMs, and deliveryId when provided, returning ok answer', async () => {
      const incident = {
        id: 'inc-1',
        state: 'ACTIVE' as const,
        deliveryId: 'del-123',
        startedAt: '2026-11-03T00:00:00.000Z',
      };
      mockClient.post.mockResolvedValueOnce({ data: { result: incident } });

      const service = sosService(mockClient);
      const answer = await service.start({
        clientId: 'client-1',
        tapAgeMs: 50,
        deliveryId: 'del-123',
      });

      expect(mockClient.post).toHaveBeenCalledWith('sos', {
        clientId: 'client-1',
        tapAgeMs: 50,
        deliveryId: 'del-123',
      });
      expect(answer).toEqual({ kind: 'ok', result: incident });
    });

    it('returns error answer with status and code on axios error response', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { result: [{ code: 'DELIVERY_NOT_FOUND' }] },
        },
      };
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      mockClient.post.mockRejectedValueOnce(axiosError);

      const service = sosService(mockClient);
      const answer = await service.start({
        clientId: 'client-1',
        tapAgeMs: 0,
      });

      expect(answer).toEqual({
        kind: 'error',
        httpStatus: 404,
        code: 'DELIVERY_NOT_FOUND',
      });
      (axios.isAxiosError as unknown as jest.SpyInstance).mockRestore();
    });

    it('returns none answer on network/timeout error (no response)', async () => {
      const networkError = new Error('Network error');
      mockClient.post.mockRejectedValueOnce(networkError);

      const service = sosService(mockClient);
      const answer = await service.start({
        clientId: 'client-1',
        tapAgeMs: 0,
      });

      expect(answer).toEqual({ kind: 'none' });
    });
  });

  describe('getActive', () => {
    it('GETs "sos/active" and returns result or null', async () => {
      const incident = {
        id: 'inc-active',
        state: 'ACTIVE' as const,
        deliveryId: null,
        startedAt: '2026-11-03T00:00:00.000Z',
      };
      mockClient.get.mockResolvedValueOnce({ data: { result: incident } });

      const service = sosService(mockClient);
      const result = await service.getActive();
      expect(mockClient.get).toHaveBeenCalledWith('sos/active');
      expect(result).toEqual(incident);

      // Null case
      mockClient.get.mockResolvedValueOnce({ data: { result: null } });
      const resultNull = await service.getActive();
      expect(resultNull).toBeNull();
    });
  });

  describe('sendPoints', () => {
    it('POSTs points array to "sos/:id/points"', async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { result: { accepted: 2 } },
      });

      const service = sosService(mockClient);
      const points = [
        { latitude: 39.1, longitude: 22.1, accuracyMetres: 4, ageMs: 100 },
        { latitude: 39.2, longitude: 22.2, ageMs: 200 },
      ];
      const answer = await service.sendPoints('inc-1', points);

      expect(mockClient.post).toHaveBeenCalledWith('sos/inc-1/points', {
        points,
      });
      expect(answer).toEqual({ kind: 'ok', result: { accepted: 2 } });
    });

    it('returns error with SOS_NOT_ACTIVE_CODE on 409', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 409,
          data: { result: [{ code: SOS_NOT_ACTIVE_CODE }] },
        },
      };
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      mockClient.post.mockRejectedValueOnce(axiosError);

      const service = sosService(mockClient);
      const answer = await service.sendPoints('inc-1', []);

      expect(answer).toEqual({
        kind: 'error',
        httpStatus: 409,
        code: SOS_NOT_ACTIVE_CODE,
      });
      (axios.isAxiosError as unknown as jest.SpyInstance).mockRestore();
    });
  });

  describe('end', () => {
    it('POSTs tapAgeMs to "sos/:id/safe" for safe kind', async () => {
      const incident = {
        id: 'inc-1',
        state: 'AWAITING_CLOSE' as const,
        deliveryId: null,
        startedAt: '2026-11-03T00:00:00.000Z',
      };
      mockClient.post.mockResolvedValueOnce({ data: { result: incident } });

      const service = sosService(mockClient);
      const answer = await service.end('inc-1', 'safe', 150);

      expect(mockClient.post).toHaveBeenCalledWith('sos/inc-1/safe', {
        tapAgeMs: 150,
      });
      expect(answer).toEqual({ kind: 'ok', result: incident });
    });

    it('POSTs tapAgeMs to "sos/:id/false-alarm" for falseAlarm kind', async () => {
      const incident = {
        id: 'inc-1',
        state: 'AWAITING_CLOSE' as const,
        deliveryId: null,
        startedAt: '2026-11-03T00:00:00.000Z',
      };
      mockClient.post.mockResolvedValueOnce({ data: { result: incident } });

      const service = sosService(mockClient);
      const answer = await service.end('inc-1', 'falseAlarm', 250);

      expect(mockClient.post).toHaveBeenCalledWith('sos/inc-1/false-alarm', {
        tapAgeMs: 250,
      });
      expect(answer).toEqual({ kind: 'ok', result: incident });
    });
  });
});
