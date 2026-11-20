import { CoopTotals, CurrentTimeWorked } from '@app/types/timeWorked';
import { UClient } from './Client';

// Spec 0040: the rider's own time worked and the co-op totals. No call takes a rider id: the server
// reads the rider from the session.
export interface TimeWorkedService {
  getCurrent: () => Promise<CurrentTimeWorked>;
  getCoopTotals: () => Promise<CoopTotals>;
}

const timeWorkedService = (client: UClient): TimeWorkedService => {
  // Every response is wrapped by the backend as { error, result }.
  const getCurrent = async (): Promise<CurrentTimeWorked> => {
    const { data } = await client.get('time-worked/current');
    return data.result;
  };

  const getCoopTotals = async (): Promise<CoopTotals> => {
    const { data } = await client.get('time-worked/coop-totals');
    return data.result;
  };

  return { getCurrent, getCoopTotals };
};

export default timeWorkedService;
