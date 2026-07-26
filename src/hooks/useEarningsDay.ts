import { useQuery } from '@tanstack/react-query';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { EarningsDay } from '@app/types/types';
import { deviceTimezone } from '@app/utilities/dates';

/**
 * The individual deliveries behind one day of the earnings summary.
 *
 * The same timezone the summary used has to be sent here too: the backend decides which
 * deliveries belong to `date` by that timezone, so asking with a different one would list
 * a different set of deliveries than the day row the courier tapped.
 */
export const useEarningsDay = (date: string) => {
  const timezone = deviceTimezone();

  const { data, isLoading, isError, refetch, isRefetching } =
    useQuery<EarningsDay>({
      queryFn: () =>
        services.earningsService.getEarningsDay({ date, timezone }),
      queryKey: [QueryKeys.earningsDay, date, timezone],
    });

  return {
    deliveries: data?.deliveries ?? [],
    deliveryCount: data?.deliveryCount ?? 0,
    compensation: data?.compensation ?? 0,
    tips: data?.tips ?? 0,
    total: data?.total ?? 0,
    currency: data?.currency,
    isLoading,
    isError,
    isRefetching,
    refetch,
  };
};

export default useEarningsDay;
