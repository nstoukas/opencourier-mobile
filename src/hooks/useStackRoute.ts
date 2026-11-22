import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { StackRoute } from '@app/types/route';

const EVERY_MINUTE = 60 * 1000;

type Options = {
  // The order of the stack the card shows, or nothing when the card shows no
  // stack (the query then sleeps).
  deliveryId?: string;
  // The two orders' statuses as the SERVER has them, joined: the stops behind
  // the rider change with them, so they are part of the key.
  serverStatuses?: string;
  // True for a stacked job; a stacked offer is fetched once.
  isJob: boolean;
  // A step of this job is waiting in the outbox: keep the last line.
  waitingToSend: boolean;
  // Home is the screen in front.
  inFront: boolean;
};

// Spec 0048 (AC-10): the route of a stack, two orders offered or carried
// together, with its numbered stops, from the co-op's backend. The same rules
// as useDeliveryRoute (spec 0018): asked again when a server status changes
// and every minute while a stacked job is shown and the app is in use; a
// failed refetch keeps the last line.
export const useStackRoute = ({
  deliveryId,
  serverStatuses,
  isJob,
  waitingToSend,
  inFront,
}: Options) => {
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setAppActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  return useQuery<StackRoute>({
    queryKey: [QueryKeys.stackRoute, deliveryId, serverStatuses],
    queryFn: () => services.routeService.getStackRoute(deliveryId!),
    enabled:
      deliveryId !== undefined &&
      serverStatuses !== undefined &&
      !waitingToSend,
    refetchInterval: isJob && inFront && appActive ? EVERY_MINUTE : false,
    staleTime: isJob ? 0 : Infinity,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === deliveryId ? previous : undefined,
    retry: 1,
  });
};
