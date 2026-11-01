import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  alertNewCancelledJobs,
  CancelledJob,
  fetchCancelledJobs,
} from '@app/services/cancelledJobs/cancelledJobs';

const EVERY_MINUTE = 60_000;

// Spec 0015. The rider's jobs cancelled in the last 24 hours after they accepted them. Read when
// Home opens, when a status update arrives over the live connection (socket.tsx), every minute
// while Home is in front and the app is active, and on return to the foreground; the timer is
// scoped by hand as in useDispatchState (no focus manager is wired to AppState here). Saved on the
// phone with the deliveries (queryPersistence.ts), so the card survives a restart with no signal.
export const useCancelledJobs = (inFront: boolean = true) => {
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const query = useQuery({
    queryKey: [QueryKeys.cancelledJobs],
    queryFn: fetchCancelledJobs,
    // false stops the timer; it starts again when both come back.
    refetchInterval: inFront && appActive ? EVERY_MINUTE : false,
  });

  const { refetch, data } = query;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
      if (state === 'active') {
        void refetch();
      }
    });
    return () => subscription.remove();
  }, [refetch]);

  // A job seen for the first time raises the alert, once (AC-7). A failure to alert never hides
  // the card, which reads the same data.
  useEffect(() => {
    if (data && data.length > 0) {
      alertNewCancelledJobs(data).catch(error =>
        console.log('Could not raise the cancelled job alert', error),
      );
    }
  }, [data]);

  return query as typeof query & { data: CancelledJob[] | undefined };
};
