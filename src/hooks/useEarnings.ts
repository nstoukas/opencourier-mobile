import { useQueries, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';

// Spec 0042: the Earnings screen reads by calendar month (decision 75.15). Both keys are saved to disk
// for 24 hours (`queryPersistence.ts`), so a month or a delivery the rider opened stays readable with no
// signal (AC-13). `staleTime: 0` asks the server again each time one is shown.

// One or two months: a week that crosses a month's end needs both to list all its jobs.
export const useEarningsMonths = (months: string[]) =>
  useQueries({
    queries: months.map(month => ({
      queryKey: [QueryKeys.earningsMonth, month],
      queryFn: () => services.earningsService.getMonth(month),
      staleTime: 0,
    })),
  });

// The calendar's own month, for its dots; read only while the calendar is open.
export const useEarningsMonth = (month: string, enabled: boolean = true) =>
  useQuery({
    queryKey: [QueryKeys.earningsMonth, month],
    queryFn: () => services.earningsService.getMonth(month),
    staleTime: 0,
    enabled,
  });

// Why a job detail could not be shown (AC-13): the server never answered (no signal), the server
// answered 404 (not one of this rider's jobs, or older than the reach), or it answered something else.
// The service lets the axios error through untouched, so its `response` tells the first two apart, as
// `useHandBack.ts` does.
export type DetailFailure = 'noConnection' | 'notFound' | 'other';

export const detailFailureOf = (error: unknown): DetailFailure => {
  if (axios.isAxiosError(error) && !error.response) {
    return 'noConnection';
  }
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    return 'notFound';
  }
  return 'other';
};

// One delivery's breakdown and timeline (AC-10, AC-11), fetched fresh each time it is opened.
export const useEarningsDelivery = (deliveryId: string) =>
  useQuery({
    queryKey: [QueryKeys.earningsDelivery, deliveryId],
    queryFn: () => services.earningsService.getDelivery(deliveryId),
    staleTime: 0,
    // React Query asks again up to 3 times after a failure. A 404 is the server's answer and asking
    // again changes nothing, so it is shown at once; anything else keeps the usual 3 tries.
    retry: (failureCount, error) =>
      detailFailureOf(error) !== 'notFound' && failureCount < 3,
  });
