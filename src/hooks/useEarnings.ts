import { useQueries, useQuery } from '@tanstack/react-query';
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

// One delivery's breakdown and timeline (AC-10, AC-11), fetched fresh each time it is opened.
export const useEarningsDelivery = (deliveryId: string) =>
  useQuery({
    queryKey: [QueryKeys.earningsDelivery, deliveryId],
    queryFn: () => services.earningsService.getDelivery(deliveryId),
    staleTime: 0,
  });
