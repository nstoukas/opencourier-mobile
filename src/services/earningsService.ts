import { EarningsDeliveryDetail, EarningsMonth } from '@app/types/earnings';
import { UClient } from './Client';

// Spec 0042: the Earnings screen's two reads. No call takes a rider id: the server reads the rider from
// the session, so asking for a delivery this rider never held answers 404.
export interface EarningsService {
  // `month` is YYYY-MM; the server clamps it to the rider's 2 month reach and to today.
  getMonth: (month: string) => Promise<EarningsMonth>;
  getDelivery: (deliveryId: string) => Promise<EarningsDeliveryDetail>;
}

const earningsService = (client: UClient): EarningsService => {
  // Every response is wrapped by the backend as { error, result }.
  const getMonth = async (month: string): Promise<EarningsMonth> => {
    const { data } = await client.get('earnings', { params: { month } });
    return data.result;
  };

  const getDelivery = async (
    deliveryId: string,
  ): Promise<EarningsDeliveryDetail> => {
    const { data } = await client.get(
      `earnings/deliveries/${encodeURIComponent(deliveryId)}`,
    );
    return data.result;
  };

  return { getMonth, getDelivery };
};

export default earningsService;
