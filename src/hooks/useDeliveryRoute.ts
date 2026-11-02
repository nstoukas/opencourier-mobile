import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { OrderStatus } from '@app/types/enums';
import { RouteLeg } from '@app/types/route';

const EVERY_MINUTE = 60 * 1000;

type Options = {
  // The delivery shown in the card, or nothing.
  deliveryId?: string;
  // Its status as the SERVER has it (the in progress list, not the outbox's
  // shown status), because the server answers the legs for its own status.
  serverStatus?: string;
  // True for a job the rider holds; an offer is fetched once.
  isJob: boolean;
  // A step of this job is waiting in the outbox: keep the last line (AC-6).
  waitingToSend: boolean;
  // Home is the screen in front.
  inFront: boolean;
};

// Spec 0018 (AC-6): the road route of the offer or job in the home card, from
// the co-op's backend. Fetched again when the server's status changes (it is
// part of the key) and every minute while a job is shown and the app is in
// use. A failed refetch keeps the last line, and the same delivery's last line
// stays while its next status's route loads (never another delivery's line).
export const useDeliveryRoute = ({
  deliveryId,
  serverStatus,
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

  return useQuery<RouteLeg[]>({
    queryKey: [QueryKeys.deliveryRoute, deliveryId, serverStatus],
    queryFn: () => services.routeService.getDeliveryRoute(deliveryId!),
    // A delivered job has no route (the server answers 404 once it is over).
    // No server status yet means the server's list no longer has this job (it
    // just finished): asking would only get a 404 (Fable's review).
    enabled:
      deliveryId !== undefined &&
      serverStatus !== undefined &&
      !waitingToSend &&
      serverStatus !== OrderStatus.dropped_off,
    refetchInterval: isJob && inFront && appActive ? EVERY_MINUTE : false,
    // An offer's route does not change while it is shown.
    staleTime: isJob ? 0 : Infinity,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === deliveryId ? previous : undefined,
    retry: 1,
  });
};
