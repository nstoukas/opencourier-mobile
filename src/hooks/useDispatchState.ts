import { useEffect } from 'react';
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

// Read when Home opens, every 60 s while it is shown, and when the app comes back to the
// foreground (AC-7). The phone cannot hear of a stop any other way: there is no push for it yet.
export const useDispatchState = () => {
  const query = useQuery({
    queryKey: [QueryKeys.dispatchState],
    queryFn: async (): Promise<DispatchState> => {
      const { data } = await client.get('dispatch-state');
      // Every response is wrapped by the backend as { error, result }.
      return data.result;
    },
    refetchInterval: EVERY_MINUTE,
  });

  const { refetch } = query;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refetch();
      }
    });
    return () => subscription.remove();
  }, [refetch]);

  return query;
};
