import {
  CoopTotals,
  CurrentTimeWorked,
  TimeWorkedRange,
} from '@app/types/timeWorked';
import { UClient } from './Client';

// Spec 0040: the rider's own time worked and the co-op totals. No call takes a rider id: the server
// reads the rider from the session.
export interface TimeWorkedService {
  getCurrent: () => Promise<CurrentTimeWorked>;
  // `from` and `to` are YYYY-MM-DD days in the co-op's timezone, at most 31 days apart.
  getRange: (from: string, to: string) => Promise<TimeWorkedRange>;
  getCoopTotals: () => Promise<CoopTotals>;
}

const timeWorkedService = (client: UClient): TimeWorkedService => {
  // Every response is wrapped by the backend as { error, result }.
  const getCurrent = async (): Promise<CurrentTimeWorked> => {
    const { data } = await client.get('time-worked/current');
    return data.result;
  };

  const getRange = async (
    from: string,
    to: string,
  ): Promise<TimeWorkedRange> => {
    const { data } = await client.get('time-worked', { params: { from, to } });
    return data.result;
  };

  const getCoopTotals = async (): Promise<CoopTotals> => {
    const { data } = await client.get('time-worked/coop-totals');
    return data.result;
  };

  return { getCurrent, getRange, getCoopTotals };
};

export default timeWorkedService;
