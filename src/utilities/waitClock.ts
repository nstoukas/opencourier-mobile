// The rider's clock at the restaurant (spec 0033, AC-5, AC-6). The server says
// when they arrived, on its own clock; that time is moved onto the phone's
// clock once, when the job list arrives (see `handBackWindow.ts`), so a phone
// clock that is minutes wrong cannot stretch or cut the wait.

import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';

// Whole seconds since the arrival, never below 0.
export const waitSeconds = (arrivedOnPhone: number, now: number): number =>
  Math.max(0, Math.floor((now - arrivedOnPhone) / 1000));

// "6:12": minutes (past 59 if it comes to that), then two digit seconds.
export const waitClockText = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

// True while the rider is waiting at the restaurant and the server told us when
// they arrived. A step still queued on the phone has no arrival time yet.
export const isWaitingAtPickup = (order: Order): boolean =>
  order.status === OrderStatus.courier_arrived_at_pickup_location &&
  order.arrivedAtOnPhone !== null &&
  order.arrivedAtOnPhone !== undefined;

// True once the time the server gave has come. The server checks again.
export const canLeaveWait = (order: Order, now: number): boolean => {
  const leaveFrom = order.leaveFromOnPhone;
  // As `canHandBack`: not while a step of this delivery still waits to be sent.
  if (
    order.waitingToSend ||
    order.status !== OrderStatus.courier_arrived_at_pickup_location ||
    leaveFrom === null ||
    leaveFrom === undefined
  ) {
    return false;
  }
  return now >= leaveFrom;
};
