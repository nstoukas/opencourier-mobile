import { DeliveryIssueReason } from '@app/types/enums';
import axios from 'axios';
import { UClient } from './Client';
import { OrderServiceReponse } from './types';
import { Order } from '@app/types/types';
import { offerTimesOnPhone } from '@app/utilities/offerClock';
import { handBackUntilOnPhone } from '@app/utilities/handBackWindow';
import { JOB_STEP_ROUTE, JobStep } from '@app/utilities/jobSteps';
import { StepAnswer } from './jobStepOutbox';

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

// The error code Mark as dispatched answers (with a 409) for any status but
// ACCEPTED: the delivery is already dispatched, or it is no longer this
// rider's to dispatch (a hand back landed in between, spec 0020, AC-10).
export const CANT_UPDATE_DELIVERY_STATUS_CODE = 'CANT_UPDATE_DELIVERY_STATUS';

// True for that 409. After an accept that went through, it means there is
// nothing left to do: the outbox counts it as sent for the same reason.
export const isCantUpdateStatusError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return false;
  }
  const result = error.response.data?.result;
  return (
    Array.isArray(result) &&
    result.some(
      (item: { code?: string }) =>
        item?.code === CANT_UPDATE_DELIVERY_STATUS_CODE,
    )
  );
};

// True when the Mark as dispatched call right after an accept has nothing
// left to do (spec 0020, AC-10): a 409 CANT_UPDATE_DELIVERY_STATUS (already
// past ACCEPTED), or a 404, which the server answers once the delivery is no
// longer this rider's (a hand back or an admin's reassign landed in between;
// row 71 review). The accept itself went through either way.
export const isDispatchNoLongerNeeded = (error: unknown): boolean =>
  isCantUpdateStatusError(error) ||
  (axios.isAxiosError(error) && error.response?.status === 404);

// What the app sends with an accept (spec 0020, AC-11). `automatic` is true
// only when the phone accepted by itself (the rider's auto accept setting);
// a rider's own tap leaves it out.
export type AcceptOrderParams = { id: string; automatic?: boolean };

export interface OrderService {
  // The list of offers (the `data` array of the paginated response), each
  // with its offer times moved onto the phone's clock (`phoneClock`).
  getNewOrders: () => Promise<Order[]>;
  // The jobs (`data.result.data`); a job with a free hand back window gets
  // its end moved onto the phone's clock (`handBackUntilOnPhone`, spec 0020).
  getInProgressOrders: () => Promise<Order[]>;
  // Returns `data.result.data`, the same orders array as getNewOrders.
  getOrdersHistory: () => Promise<Order[]>;
  // Accepts, then marks as dispatched. A 409 CANT_UPDATE_DELIVERY_STATUS on
  // the second call counts as done (spec 0020, AC-10).
  acceptOrder: (params: AcceptOrderParams) => Promise<OrderServiceReponse>;
  // Spec 0020 (AC-9): gives an accepted order back inside the free window.
  // Online only; throws the axios error on a refusal (404, 409) or no signal.
  handBack: (id: string) => Promise<{ status: string }>;
  declineOrder: (id: string) => Promise<OrderServiceReponse>;
  // Sends one job step from the outbox (spec 0009) and reports the answer;
  // it never throws. `tapAgeMs` is how long ago the rider tapped.
  sendJobStep: (
    item: { deliveryId: string; step: JobStep; note?: string },
    tapAgeMs: number,
  ) => Promise<StepAnswer>;
  // Sends a rider's report about a delivery to the admin (decision 66.11).
  // `note` goes with OTHER (decision 66.16); the other reasons send none.
  reportIssue: (params: {
    id: string;
    reason: DeliveryIssueReason;
    note?: string;
  }) => Promise<OrderServiceReponse>;
  // Spec 0016: moves the customer's drop off pin to where the rider stands.
  // Online only; throws the axios error on a refusal or no signal.
  moveDropoffPin: (params: {
    id: string;
    latitude: number;
    longitude: number;
  }) => Promise<MoveDropoffPinAnswer>;
}

// The server's answer to a pin move: how far it moved, and whether the
// restaurant's saved customer moved too (spec 0016, AC-9).
export interface MoveDropoffPinAnswer {
  savedCustomerUpdated: boolean;
  distanceMetres: number;
}

const orderService = (client: UClient): OrderService => {
  const getNewOrders = async (): Promise<Order[]> => {
    // Read the phone's clock on both sides of the request. The server read
    // its clock (`serverNow`) somewhere in between, most likely near the
    // middle, so the midpoint is the phone time that best matches it. Using
    // the time the answer arrived instead would push every deadline late by
    // the whole round trip; the midpoint is off by at most half of it.
    const sentAt = Date.now();
    const { data } = await client.get('deliveries/new?page=1&perPage=10');
    const receivedAt = Date.now();
    const phoneNow = sentAt + (receivedAt - sentAt) / 2;
    const offers: Order[] = data.result.data;
    return offers.map(offer => ({
      ...offer,
      phoneClock: offerTimesOnPhone(offer, data.result.serverNow, phoneNow),
    }));
  };

  const getInProgressOrders = async (): Promise<Order[]> => {
    // The phone's clock on both sides of the request, as in getNewOrders: the
    // midpoint is the phone time that best matches the server's `serverNow`.
    const sentAt = Date.now();
    const { data } = await client.get(
      'deliveries/in-progress?page=0&perPage=10',
    );
    const receivedAt = Date.now();
    const phoneNow = sentAt + (receivedAt - sentAt) / 2;
    const orders: Order[] = data.result.data;
    // A job inside its free hand back window has its end moved onto the
    // phone's clock, and a job with a ready time (spec 0023) its ready time;
    // the same sum for both (`handBackUntilOnPhone` turns any server time into
    // phone time). The others are returned as they came.
    return orders.map(order => {
      let shown = order;
      if (order.handBackUntil) {
        shown = {
          ...shown,
          handBackUntilOnPhone: handBackUntilOnPhone(
            order.handBackUntil,
            data.result.serverNow,
            phoneNow,
          ),
        };
      }
      if (order.readyAt) {
        shown = {
          ...shown,
          readyAtOnPhone: handBackUntilOnPhone(
            order.readyAt,
            data.result.serverNow,
            phoneNow,
          ),
        };
      }
      return shown;
    });
  };

  const getOrdersHistory = async (): Promise<Order[]> => {
    const { data } = await client.get('deliveries/done?page=0&perPage=50');
    return data.result.data;
  };

  const acceptOrder = async ({
    id,
    automatic = false,
  }: AcceptOrderParams): Promise<OrderServiceReponse> => {
    // The server writes "accepted automatically" on the delivery's timeline
    // when told (spec 0020, AC-1); a tap sends an empty body, as before.
    await client.post(
      `deliveries/${id}/accept`,
      automatic ? { automatic: true } : {},
    );
    try {
      return await client.post(`deliveries/${id}/mark-as-dispatched`, {});
    } catch (error) {
      // The accept went through. A 409 or 404 here means the delivery is
      // already past ACCEPTED or no longer this rider's (a hand back in
      // between): nothing is left to do, so it is not an "Error accepting order".
      if (isDispatchNoLongerNeeded(error)) {
        return { data: null, error: null };
      }
      throw error;
    }
  };

  const handBack = async (id: string): Promise<{ status: string }> => {
    // No body: the server knows the rider from the login.
    const { data } = await client.post(`deliveries/${id}/hand-back`);
    return data.result;
  };

  const declineOrder = async (id: string): Promise<OrderServiceReponse> => {
    return client.post(`deliveries/${id}/reject`, {});
  };

  const sendJobStep = async (
    item: {
      deliveryId: string;
      step: JobStep;
      note?: string;
      detected?: boolean;
    },
    tapAgeMs: number,
  ): Promise<StepAnswer> => {
    const body: Record<string, unknown> = { tapAgeMs };
    if (item.note) {
      body.note = item.note;
    }
    // Spec 0021: only the two arrived routes take `detected`, and only `true`
    // is ever sent (left out, the server counts the arrival as tapped).
    if (
      item.detected === true &&
      (item.step === 'arrived_at_pickup' || item.step === 'arrived_at_dropoff')
    ) {
      body.detected = true;
    }
    try {
      const { data } = await client.post(
        `deliveries/${item.deliveryId}/${JOB_STEP_ROUTE[item.step]}`,
        body,
      );
      // The server answers the delivery as it is after the step.
      return { kind: 'delivery', status: data?.result?.status };
    } catch (error) {
      // `axios.isAxiosError` tells TypeScript that `error` has `response`.
      if (axios.isAxiosError(error) && error.response) {
        const result = error.response.data?.result;
        const code = Array.isArray(result) ? result[0]?.code : undefined;
        return { kind: 'error', httpStatus: error.response.status, code };
      }
      // No answer: no signal, or the 10 s timeout.
      return { kind: 'none' };
    }
  };

  const reportIssue = async (params: {
    id: string;
    reason: DeliveryIssueReason;
    note?: string;
  }): Promise<OrderServiceReponse> =>
    client.post(
      `deliveries/${params.id}/issues`,
      params.note
        ? { reason: params.reason, note: params.note }
        : { reason: params.reason },
    );

  const moveDropoffPin = async (params: {
    id: string;
    latitude: number;
    longitude: number;
  }): Promise<MoveDropoffPinAnswer> => {
    const { data } = await client.post(
      `deliveries/${params.id}/dropoff-point`,
      { latitude: params.latitude, longitude: params.longitude },
    );
    return data.result;
  };

  return {
    getNewOrders,
    getOrdersHistory,
    getInProgressOrders,
    acceptOrder,
    handBack,
    sendJobStep,
    reportIssue,
    moveDropoffPin,
    declineOrder,
  };
};

export default orderService;
