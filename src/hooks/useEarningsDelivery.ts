import { useQuery } from '@tanstack/react-query';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { EarningsDeliveryDetail } from '@app/types/types';

/**
 * One completed delivery's full breakdown.
 *
 * Fetched fresh rather than carried over from the day list: this is the screen a courier
 * opens to check a specific payment, so it should show what the ledger says now, not a
 * copy made when the list was loaded.
 */
export const useEarningsDelivery = (deliveryId: string) => {
  const { data, isLoading, isError, refetch, isRefetching } =
    useQuery<EarningsDeliveryDetail>({
      queryFn: () =>
        services.earningsService.getEarningsDeliveryDetail(deliveryId),
      queryKey: [QueryKeys.earningsDelivery, deliveryId],
    });

  return {
    delivery: data,
    isLoading,
    isError,
    isRefetching,
    refetch,
  };
};

export default useEarningsDelivery;
