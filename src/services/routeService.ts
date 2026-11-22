import { UClient } from './Client';
import { PickupPoint, RouteLeg, StackRoute } from '@app/types/route';

// Spec 0018. Both come from the co-op's own backend; the app never asks a
// routing server itself (AC-7).
export interface RouteService {
  // The road route of an offer made to this rider or a job they hold, by leg.
  // Throws the axios error on a 503 (OSRM could not answer), a 404, or no signal.
  getDeliveryRoute: (deliveryId: string) => Promise<RouteLeg[]>;
  // Spec 0048 (AC-10): the same route for an order of a stack, with its
  // numbered stops; the legs go from the rider through every stop still ahead.
  getStackRoute: (deliveryId: string) => Promise<StackRoute>;
  // Every restaurant's name and pickup point, for the restaurant layer.
  getPickupPoints: () => Promise<PickupPoint[]>;
}

const routeService = (client: UClient): RouteService => {
  const getDeliveryRoute = async (deliveryId: string): Promise<RouteLeg[]> => {
    const { data } = await client.get(`deliveries/${deliveryId}/route`);
    return data.result.legs;
  };

  const getStackRoute = async (deliveryId: string): Promise<StackRoute> => {
    const { data } = await client.get(`deliveries/${deliveryId}/route`);
    return { legs: data.result.legs, stops: data.result.stops ?? [] };
  };

  const getPickupPoints = async (): Promise<PickupPoint[]> => {
    const { data } = await client.get('partners/pickup-points');
    return data.result;
  };

  return { getDeliveryRoute, getStackRoute, getPickupPoints };
};

export default routeService;
