import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  COUNTER_TICK_MS,
  CURRENT_REFETCH_MS,
  CounterView,
  counterView,
} from '@app/utilities/timeWorked';

// Spec 0040: the rider's time worked. None of these queries is saved to disk: `queryPersistence.ts`
// keeps only the keys it lists, and these are not among them (AC-10).

// Any of these queries finishing a fetch means the rider's work may have changed: their status (the
// switch refetches the user), a job step, the socket's DELIVERY_STATUS_UPDATED or the outbox replay
// (each refetches the jobs in progress).
const TRIGGER_KEYS: ReadonlySet<string> = new Set([
  QueryKeys.user,
  QueryKeys.inProgressOrders,
]);

// The home counter (AC-10): the server's snapshot of the open shift, fetched again on every trigger
// above, when the app comes back to the foreground, and every 5 minutes while a shift is open; between
// fetches the minutes are added on the phone. With no signal it keeps the last snapshot.
export const useCurrentTimeWorked = (inFront: boolean = true) => {
  const queryClient = useQueryClient();
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const query = useQuery({
    queryKey: [QueryKeys.timeWorkedCurrent],
    queryFn: () => services.timeWorkedService.getCurrent(),
    // A function, so the 5 minute fetch runs only while a shift is open and the home map is in front.
    refetchInterval: q =>
      inFront && appActive && q.state.data?.shift ? CURRENT_REFETCH_MS : false,
  });
  const { refetch, data, dataUpdatedAt } = query;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
      if (state === 'active') {
        refetch();
      }
    });
    return () => subscription.remove();
  }, [refetch]);

  // `getQueryCache().subscribe` calls back on every change to any query; only a successful fetch of a
  // trigger key starts a new read here. This query's own key is not a trigger, so it cannot loop.
  // `setQueryData` also sends a 'success' update, marked `manual`, and every location fix writes the
  // user that way, so manual updates are skipped: only a real fetch from the server counts (review
  // 2026-11-20, major). Nothing is read while the app is in the background either: coming back to the
  // foreground fetches anyway (the AppState listener above).
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (
        event.type === 'updated' &&
        event.action.type === 'success' &&
        !event.action.manual &&
        AppState.currentState === 'active' &&
        TRIGGER_KEYS.has(String(event.query.queryKey[0]))
      ) {
        refetch();
      }
    });
    return unsubscribe;
  }, [queryClient, refetch]);

  // The 5 minute fetch pauses while another screen is in front, so read again when Home comes back,
  // and an admin's Offline shows at once (review nit). Not on the first render: mounting fetches.
  const wasInFront = useRef(inFront);
  useEffect(() => {
    if (inFront && !wasInFront.current) {
      refetch();
    }
    wasInFront.current = inFront;
  }, [inFront, refetch]);

  // The local tick: redraw while there is something to count and the home map is in front.
  const [now, setNow] = useState(Date.now());
  const view: CounterView = counterView(data, dataUpdatedAt, now);
  const counting = view.kind !== 'none' && inFront;
  useEffect(() => {
    if (!counting) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), COUNTER_TICK_MS);
    return () => clearInterval(timer);
  }, [counting, dataUpdatedAt]);

  return { view, query };
};

// The Co-op this week card (AC-12).
export const useCoopTotals = () =>
  useQuery({
    queryKey: [QueryKeys.coopTotals],
    queryFn: () => services.timeWorkedService.getCoopTotals(),
    staleTime: 0,
  });
