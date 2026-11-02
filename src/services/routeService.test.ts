import routeService from './routeService';
import { RouteLeg, RouteLegKind } from '@app/types/route';

describe('routeService (spec 0018, AC-1, AC-4)', () => {
  const mockGet = jest.fn();
  const mockClient: any = { get: mockGet };
  const service = routeService(mockClient);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDeliveryRoute (AC-1)', () => {
    it('calls deliveries/:id/route and returns result.legs', async () => {
      const mockLegs: RouteLeg[] = [
        {
          kind: RouteLegKind.PickupToDropoff,
          distanceMetres: 1200,
          durationSeconds: 240,
          points: [{ latitude: 39.36, longitude: 22.94 }],
        },
      ];
      mockGet.mockResolvedValueOnce({ data: { result: { legs: mockLegs } } });

      const legs = await service.getDeliveryRoute('deliv-123');
      expect(mockGet).toHaveBeenCalledWith('deliveries/deliv-123/route');
      expect(legs).toEqual(mockLegs);
    });
  });

  describe('getPickupPoints (AC-4)', () => {
    it('calls partners/pickup-points and returns result', async () => {
      const mockPoints = [
        { id: 'p1', name: 'Souvlaki Bar', latitude: 39.362, longitude: 22.942 },
      ];
      mockGet.mockResolvedValueOnce({ data: { result: mockPoints } });

      const points = await service.getPickupPoints();
      expect(mockGet).toHaveBeenCalledWith('partners/pickup-points');
      expect(points).toEqual(mockPoints);
    });
  });
});
