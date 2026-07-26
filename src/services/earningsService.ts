import {
  EarningsDay,
  EarningsDeliveryDetail,
  EarningsSummary,
} from '@app/types/types';
import { UClient } from './Client';
import { EarningsDayParams, EarningsSummaryParams } from './types';

export interface EarningsService {
  getEarningsSummary: (
    params: EarningsSummaryParams,
  ) => Promise<EarningsSummary>;
  getEarningsDay: (params: EarningsDayParams) => Promise<EarningsDay>;
  getEarningsDeliveryDetail: (
    deliveryId: string,
  ) => Promise<EarningsDeliveryDetail>;
}

const earningsService = (client: UClient): EarningsService => {
  /**
   * The one authoritative source for what a courier was paid. The backend derives it
   * from the DeliveryEvent ledger, so what shows here is what an auditor would find.
   */
  const getEarningsSummary = async (
    params: EarningsSummaryParams,
  ): Promise<EarningsSummary> => {
    // axios omits params whose value is undefined, so the backend applies its own
    // defaults for anything we leave out.
    const { data } = await client.get('courier/earnings-summary', { params });
    // Every response is wrapped by the backend as { error, result }.
    return data.result;
  };

  /** The individual deliveries behind one day of the summary. */
  const getEarningsDay = async (
    params: EarningsDayParams,
  ): Promise<EarningsDay> => {
    const { data } = await client.get('courier/earnings/day', { params });
    return data.result;
  };

  /**
   * One delivery's full breakdown. The courier id comes from the auth token, so asking
   * for someone else's delivery id returns 404 rather than another courier's earnings.
   */
  const getEarningsDeliveryDetail = async (
    deliveryId: string,
  ): Promise<EarningsDeliveryDetail> => {
    const { data } = await client.get(
      `courier/earnings/delivery/${deliveryId}`,
    );
    return data.result;
  };

  return { getEarningsSummary, getEarningsDay, getEarningsDeliveryDetail };
};

export default earningsService;
