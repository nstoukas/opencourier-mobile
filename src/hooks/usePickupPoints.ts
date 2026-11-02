import { useQuery } from '@tanstack/react-query';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { PickupPoint } from '@app/types/route';

const ONE_HOUR = 60 * 60 * 1000;

// Spec 0018 (AC-11): the restaurants for the map's restaurant layer. They move
// rarely, so once an hour is plenty; with no answer the layer simply shows no pins.
export const usePickupPoints = (enabled: boolean) =>
  useQuery<PickupPoint[]>({
    queryKey: [QueryKeys.pickupPoints],
    queryFn: () => services.routeService.getPickupPoints(),
    enabled,
    staleTime: ONE_HOUR,
  });
