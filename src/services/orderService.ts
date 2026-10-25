import axios from 'axios';
import { UClient } from './Client';
import { OrderServiceReponse } from './types';
import { Order } from '@app/types/types';
import { offerTimesOnPhone } from '@app/utilities/offerClock';

// The error code the server sends (with a 409) when an accept or decline
// arrives after the offer already ended on the server (spec 0002, AC-5).
export const OFFER_HAS_ENDED_CODE = 'OFFER_HAS_ENDED';

// True when an accept or decline failed because the offer had already ended:
// it expired, the rider went Offline, or an admin gave it to someone else.
// The server's error body looks like
// { error: true, result: [{ code, message, statusCode }] }.
export const isOfferEndedError = (error: unknown): boolean => {
  // `axios.isAxiosError` tells TypeScript that `error` has `response` below.
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return false;
  }
  const result = error.response.data?.result;
  return (
    Array.isArray(result) &&
    result.some(
      (item: { code?: string }) => item?.code === OFFER_HAS_ENDED_CODE,
    )
  );
};

export interface OrderService {
  // The list of offers (the `data` array of the paginated response), each
  // with its offer times moved onto the phone's clock (`phoneClock`).
  getNewOrders: () => Promise<Order[]>;
  // Both return `data.result.data`, the same orders array as getNewOrders.
  getInProgressOrders: () => Promise<Order[]>;
  getOrdersHistory: () => Promise<Order[]>;
  acceptOrder: (id: string) => Promise<OrderServiceReponse>;
  declineOrder: (id: string) => Promise<OrderServiceReponse>;
  confirmItems: (params: {
    id: string;
    isDispatched: boolean;
  }) => Promise<OrderServiceReponse>;
  arrivedAtPickup: (id: string) => Promise<OrderServiceReponse>;
  arrivedAtDropoff: (id: string) => Promise<OrderServiceReponse>;
  markAsDelivered: (params: {
    id: string;
    note: string;
  }) => Promise<OrderServiceReponse>;
}

const orderService = (client: UClient): OrderService => {
  const getNewOrders = async (): Promise<Order[]> => {
    const { data } = await client.get('deliveries/new?page=1&perPage=10');
    // Read the phone's clock as soon as the answer is here, so the time the
    // request took is not counted twice.
    const phoneNow = Date.now();
    const offers: Order[] = data.result.data;
    return offers.map(offer => ({
      ...offer,
      phoneClock: offerTimesOnPhone(offer, data.result.serverNow, phoneNow),
    }));
  };

  const getInProgressOrders = async (): Promise<Order[]> => {
    const { data } = await client.get(
      'deliveries/in-progress?page=0&perPage=10',
    );
    return data.result.data;
  };

  const getOrdersHistory = async (): Promise<Order[]> => {
    const { data } = await client.get('deliveries/done?page=0&perPage=50');
    return data.result.data;
  };

  const acceptOrder = async (id: string): Promise<OrderServiceReponse> => {
    await client.post(`deliveries/${id}/accept`, {});
    return client.post(`deliveries/${id}/mark-as-dispatched`, {});
  };

  const declineOrder = async (id: string): Promise<OrderServiceReponse> => {
    return client.post(`deliveries/${id}/reject`, {});
  };

  const confirmItems = async (params: {
    id: string;
    isDispatched: boolean;
  }): Promise<OrderServiceReponse> => {
    const { id, isDispatched } = params;
    if (!isDispatched) {
      await client.post(`deliveries/${id}/mark-as-dispatched`, {});
    }
    return client.post(`deliveries/${id}/mark-as-picked-up`);
  };

  const arrivedAtPickup = async (id: string): Promise<OrderServiceReponse> => {
    return client.post(`deliveries/${id}/arrived-at-pickup`, {});
  };

  const arrivedAtDropoff = async (
    id: string,
  ): Promise<OrderServiceReponse> => {
    return client.post(`deliveries/${id}/arrived-at-dropoff`, {});
  };

  const markAsDelivered = async (params: {
    id: string;
    note: string;
  }): Promise<OrderServiceReponse> => {
    const { id, note } = params;
    return client.post(`deliveries/${id}/mark-as-delivered`, {
      note: note,
      imageName: 'imageName',
      imageType: 'JPEG',
    });
  };

  return {
    getNewOrders,
    getOrdersHistory,
    getInProgressOrders,
    acceptOrder,
    confirmItems,
    arrivedAtPickup,
    arrivedAtDropoff,
    markAsDelivered,
    declineOrder,
  };
};

export default orderService;
