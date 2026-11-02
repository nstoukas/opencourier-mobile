// The free hand back (spec 0020, AC-9): for a short time after accepting, a
// rider can give an order back at no cost. The server decides the end
// (`handBackUntil`, on its own clock); the phone only counts down to it.
//
// The end is moved onto the phone's clock once, when the job list arrives,
// the same way an offer's deadline is (`offerClock.ts`): a phone clock that is
// minutes wrong cannot stretch or cut the window.

import { Location, Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { offerTimesOnPhone } from './offerClock';

// Only before the rider reaches the restaurant (decision 71.6): once there,
// the food is waiting for them.
// Typed as plain strings so `includes(order.status)` accepts any status text.
const HAND_BACK_STATUSES: string[] = [
  OrderStatus.accepted,
  OrderStatus.dispatched,
];

// The server's `handBackUntil` on the phone's clock, in milliseconds (like
// Date.now()), or null when there is no window. `serverNow` and `phoneNow` are
// the job list's server clock and the phone's clock at the same moment (the
// middle of the request). The offer clock already does exactly this sum for
// an offer's end, so it is reused here for the window's end.
export const handBackUntilOnPhone = (
  handBackUntil: string | null | undefined,
  serverNow: string | null | undefined,
  phoneNow: number,
): number | null =>
  offerTimesOnPhone({ offerExpiresAt: handBackUntil }, serverNow, phoneNow)
    .expiresAt;

// Whole seconds left, rounded up so the button reads "1 s" in the last
// second and goes at 0. Never below 0; 0 when there is no window.
export const handBackSecondsLeft = (
  untilOnPhone: number | null | undefined,
  now: number,
): number => {
  if (untilOnPhone === null || untilOnPhone === undefined) {
    return 0;
  }
  return Math.max(0, Math.ceil((untilOnPhone - now) / 1000));
};

// True while the window is still ahead. During it the job card shows the drop
// off area, not the customer's name and address (decision 71.10).
export const isHandBackWindowOpen = (order: Order, now: number): boolean =>
  handBackSecondsLeft(order.handBackUntilOnPhone, now) > 0;

// True while the card must show the area instead of the customer: the window
// is open AND the status the screen shows is still before the restaurant. A
// rider who swiped "Arrived at pickup" inside the minute (the step may still
// wait in the outbox) sees the customer's name again, which the restaurant
// asks for (row 71 review).
export const hidesCustomerDetails = (order: Order, now: number): boolean =>
  isHandBackWindowOpen(order, now) && HAND_BACK_STATUSES.includes(order.status);

// The Hand back button shows when the window is ahead, the status the screen
// SHOWS (moved on by steps waiting in the outbox) is still before the
// restaurant, and no step of this delivery waits to be sent.
export const canHandBack = (order: Order, now: number): boolean =>
  isHandBackWindowOpen(order, now) &&
  HAND_BACK_STATUSES.includes(order.status) &&
  !order.waitingToSend;

// The drop off street, or the town when the street would give the house away;
// never a house number. The same rule as the backend's `dropoffAreaOf`, which
// fills the offer card's `dropoffArea` (spec 0019): the job list does not send
// that field, so the phone works it out from the drop off location.
export const dropoffAreaOf = (
  location: Pick<Location, 'street' | 'houseNumber' | 'city'> | undefined,
): string => {
  if (!location) {
    return '';
  }
  const houseNumber = location.houseNumber?.trim() ?? '';
  const street = location.street?.trim() ?? '';
  const city = location.city?.trim() ?? '';
  if (street && houseNumber && !street.includes(houseNumber)) {
    return street;
  }
  if (houseNumber && city.includes(houseNumber)) {
    return '';
  }
  return city;
};
