import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { client } from '@app/services/Client';
import { QueryKeys } from '@app/utilities/queryKeys';

// Spec 0014. What the backend says about a dispatch stop: the one on now, and the next one when it
// starts within 12 hours, each with the sentence to show (built on the server, in Athens time).
export type DispatchStopView = {
  reason: 'HEAT' | 'STORM' | 'OTHER';
  startsAt: string;
  endsAt: string | null;
  message: string;
};
export type DispatchState = {
  current: DispatchStopView | null;
  next: DispatchStopView | null;
};

const EVERY_MINUTE = 60_000;

// Read when Home opens, every 60 s while Home is in front and the app is in the foreground, and when
// the app comes back to the foreground (AC-7). The phone cannot hear of a stop any other way: there
// is no push for it yet. `inFront` is Home's own useIsFocused, passed in so the hook needs no
// navigator (row 29 review: it polled behind other screens and in the background).
export const useDispatchState = (inFront: boolean = true) => {
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const query = useQuery({
    queryKey: [QueryKeys.dispatchState],
    queryFn: async (): Promise<DispatchState> => {
      const { data } = await client.get('dispatch-state');
      // Every response is wrapped by the backend as { error, result }.
      return data.result;
    },
    // false stops the timer; it starts again when both come back.
    refetchInterval: inFront && appActive ? EVERY_MINUTE : false,
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
