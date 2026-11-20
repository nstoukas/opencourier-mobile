import timeWorkedService, { TimeWorkedService } from './timeWorkedService';
import type { UClient } from './Client';
import { services } from './service';
import { CurrentTimeWorked } from '@app/types/timeWorked';

describe('timeWorkedService (spec 0040, AC-10, AC-11, AC-12, AC-18)', () => {
  let mockClient: jest.Mocked<UClient>;
  let service: TimeWorkedService;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    } as unknown as jest.Mocked<UClient>;

    service = timeWorkedService(mockClient);
  });

  describe('getCurrent (AC-10)', () => {
    it("calls bare GET 'time-worked/current', unwraps data.result, and takes no rider id", async () => {
      const mockResult: CurrentTimeWorked = {
        asOf: '2026-11-20T10:00:00.000Z',
        shiftBreakMinutes: 30,
        shift: {
          startedAt: '2026-11-20T07:00:00.000Z',
          onBreakSince: null,
          workSeconds: 10800,
          jobSeconds: 7200,
          paidWaitSeconds: 600,
          unpaidSeconds: 3000,
          moneyCents: 3850,
          centsPerHour: 1283,
          currencyCode: 'EUR',
        },
      };

      mockClient.get.mockResolvedValueOnce({
        data: { error: null, result: mockResult },
      } as any);

      const result = await service.getCurrent();

      expect(mockClient.get).toHaveBeenCalledTimes(1);
      expect(mockClient.get).toHaveBeenCalledWith('time-worked/current');
      // Takes no argument / rider id
      expect(service.getCurrent.length).toBe(0);
      expect(result).toEqual(mockResult);
    });
  });

  describe('Services wiring', () => {
    it('services.timeWorkedService is exposed with both methods', () => {
      expect(services.timeWorkedService).toBeDefined();
      expect(typeof services.timeWorkedService.getCurrent).toBe('function');
      expect(typeof services.timeWorkedService.getCoopTotals).toBe('function');
    });
  });
});
