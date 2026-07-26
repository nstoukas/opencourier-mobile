import { useMemo } from 'react';
import moment from 'moment';
import { useQuery } from '@tanstack/react-query';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { EarningsSummary, EarningsTabItem } from '@app/types/types';
import { deviceTimezone, formatApiDate } from '@app/utilities/dates';

/**
 * How far back the "All" tab reaches. The backend caps a single request at 366 days —
 * DeliveryEvent has no index on createdAt, so an open-ended window would scan the whole
 * table. "All" therefore means the last 12 months, and the UI says so.
 */
export const EARNINGS_ALL_WINDOW_DAYS = 365;

type WeekRange = {
  start: string; // 'YYYY-MM-DD'
  end: string; // 'YYYY-MM-DD'
};

/**
 * Fetches the courier's earnings for whichever tab is showing.
 *
 * The window is computed here and sent to the backend rather than fetching everything
 * and filtering on the phone: the backend owns the day boundaries, the de-duplication of
 * repeated DROPPED_OFF events, and the currency — so the numbers a courier reads here
 * are the same ones an audit of the DeliveryEvent ledger would produce.
 */
export const useEarnings = (tab: EarningsTabItem, week: WeekRange) => {
  const timezone = deviceTimezone();

  // Date strings (not Moment objects) so the memo and the query key stay stable across
  // renders — a fresh Moment every render would refetch on every render.
  const { from, to } = useMemo((): { from: string; to: string } => {
    const today = moment().format(formatApiDate);

    switch (tab) {
      case EarningsTabItem.Today:
        return { from: today, to: today };
      case EarningsTabItem.Weekly:
        return { from: week.start, to: week.end };
      case EarningsTabItem.All:
        return {
          from: moment()
            .subtract(EARNINGS_ALL_WINDOW_DAYS, 'days')
            .format(formatApiDate),
          to: today,
        };
    }
  }, [tab, week.start, week.end]);

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useQuery<EarningsSummary>({
      queryFn: () =>
        services.earningsService.getEarningsSummary({ from, to, timezone }),
      queryKey: [QueryKeys.earningsSummary, from, to, timezone],
    });

  // The backend returns days oldest-first; couriers want their most recent day on top.
  const days = useMemo(() => [...(data?.days ?? [])].reverse(), [data]);

  return {
    days,
    // Fall back to zero rather than to a stale figure: showing nothing is honest,
    // showing last week's total as if it were this week's is not.
    totalEarnings: data?.totalEarnings ?? 0,
    totalCompensation: data?.totalCompensation ?? 0,
    totalTips: data?.totalTips ?? 0,
    deliveryCount: data?.totalDeliveryCount ?? 0,
    currency: data?.currency,
    isLoading,
    isError,
    error,
    isRefetching,
    refetch,
  };
};

export default useEarnings;
