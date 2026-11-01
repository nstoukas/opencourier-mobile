import { useQuery } from '@tanstack/react-query';
import { client } from '@app/services/Client';
import { QueryKeys } from '@app/utilities/queryKeys';

// Row 72. The numbers a rider calls from the job screen that are not on the delivery itself:
// today only the co-op's dispatch line, set by a representative on Instance configuration.
export type JobContact = {
  // null when no dispatch number is set: the job screen then shows no dispatch button.
  dispatchPhoneNumber: string | null;
};

const TEN_MINUTES = 10 * 60_000;

// Read when Home opens and every ten minutes, so a number a representative changes reaches riders
// without a restart (a stale time alone never asks again while Home stays open). It is saved on
// the phone with the deliveries (queryPersistence.ts), so a rider with no data signal can still
// call dispatch.
export const useJobContact = () =>
  useQuery({
    queryKey: [QueryKeys.jobContact],
    queryFn: async (): Promise<JobContact> => {
      const { data } = await client.get('config/contact');
      // Every response is wrapped by the backend as { error, result }.
      return data.result;
    },
    refetchInterval: TEN_MINUTES,
  });
