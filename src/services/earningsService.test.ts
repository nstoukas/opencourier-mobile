import earningsService, { EarningsService } from './earningsService';
import type { UClient } from './Client';
import { services } from './service';
import { EarningsDeliveryDetail, EarningsMonth } from '@app/types/earnings';

describe('earningsService (spec 0042, AC-1, AC-6, AC-10, AC-17)', () => {
  let mockClient: jest.Mocked<UClient>;
  let service: EarningsService;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    } as unknown as jest.Mocked<UClient>;

    service = earningsService(mockClient);
  });

  describe('getMonth (AC-1, AC-6, AC-17)', () => {
    it("calls GET 'earnings' with { params: { month } }, unwraps data.result, and takes no rider id", async () => {
      const mockResult: Partial<EarningsMonth> = {
        month: '2026-11',
        from: '2026-11-01',
        to: '2026-11-20',
        reachFrom: '2026-09-20',
        recordedFrom: '2026-09-01T00:00:00.000Z',
        currencyCode: 'EUR',
        days: [],
        weeks: [],
        shifts: [],
        jobsInNoShift: [],
      };

      mockClient.get.mockResolvedValueOnce({
        data: { error: null, result: mockResult },
      } as any);

      const result = await service.getMonth('2026-11');

      expect(mockClient.get).toHaveBeenCalledTimes(1);
      expect(mockClient.get).toHaveBeenCalledWith('earnings', {
        params: { month: '2026-11' },
      });
      expect(service.getMonth.length).toBe(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getDelivery (AC-10, AC-11, AC-17)', () => {
    it("calls GET 'earnings/deliveries/:id' with encoded deliveryId, unwraps data.result, and takes no rider id", async () => {
      const mockResult: Partial<EarningsDeliveryDetail> = {
        deliveryId: 'del/123 special',
        currencyCode: 'EUR',
        pickupName: 'Taverna',
        dropoffArea: 'Center',
        paidKm: 2.5,
        jobs: [],
        breakdown: {
          baseFeeCents: 200,
          distanceFeeCents: 150,
          deliveryPayCents: 350,
          tipsCents: 50,
          compensations: [],
          totalCents: 400,
        },
        timeline: [],
      };

      mockClient.get.mockResolvedValueOnce({
        data: { error: null, result: mockResult },
      } as any);

      const result = await service.getDelivery('del/123 special');

      expect(mockClient.get).toHaveBeenCalledTimes(1);
      expect(mockClient.get).toHaveBeenCalledWith(
        'earnings/deliveries/del%2F123%20special',
      );
      expect(service.getDelivery.length).toBe(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe('Services wiring', () => {
    it('services.earningsService is exposed with getMonth and getDelivery', () => {
      expect(services.earningsService).toBeDefined();
      expect(typeof services.earningsService.getMonth).toBe('function');
      expect(typeof services.earningsService.getDelivery).toBe('function');
    });
  });
});
