import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { client } from '@app/services/Client';
import { QueryKeys } from '@app/utilities/queryKeys';

// Row 72. The numbers a rider calls from the job screen that are not on the delivery itself:
// today only the co-op's dispatch line, set by a representative on Instance configuration.
export type JobContact = {
  // null when no dispatch number is set: the job screen then shows no dispatch button.
  dispatchPhoneNumber: string | null;
  // Spec 0021: metres from a stop the app counts as arrived; 0 switches detection off.
  // Missing from an answer saved by an older app version: detection is then off.
  arrivalRadiusMetres?: number;
  // Spec 0027: whether the co-op runs shifts, and the hours before a shift's start it may still be
  // dropped. Missing from an answer saved by an older app version: shifts then stay hidden.
  shiftsEnabled?: boolean;
  shiftDropNoticeHours?: number;
};

// The one request for it, shared by every reader of the same query.
export const fetchJobContact = async (): Promise<JobContact> => {
  const { data } = await client.get('config/contact');
  // Every response is wrapped by the backend as { error, result }.
  return data.result;
};

const TEN_MINUTES = 10 * 60_000;

// Read when Home opens, every ten minutes while Home is in front and the app is active, and when
// the app comes back to the foreground, so a number a representative changes reaches riders without
// a restart (a stale time alone never asks again while Home stays open). No TanStack focus manager
// is wired to AppState here, so the timer is scoped by hand, as in useDispatchState (row 72 review).
// It is saved on the phone with the deliveries (queryPersistence.ts), so a rider with no data
// signal can still call dispatch. `inFront` is Home's own useIsFocused.
export const useJobContact = (inFront: boolean = true) => {
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const query = useQuery({
    queryKey: [QueryKeys.jobContact],
    queryFn: fetchJobContact,
    // false stops the timer; it starts again when both come back.
    refetchInterval: inFront && appActive ? TEN_MINUTES : false,
  });

  const { refetch } = query;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
      if (state === 'active') {
        void refetch();
      }
    });
    return () => subscription.remove();
  }, [refetch]);

  return query;
};
