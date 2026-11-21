// Spec 0047 (row 11): a rider at the restaurant finds an order does not fit one
// box, and tells dispatch how many boxes it needs. Dispatch splits it (the rider
// keeps box 1) or says it fits. These are the rules the job card follows; the
// server checks each one again.
import { Order, SplitBoxSize } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';

export const SPLIT_MIN_BOXES = 2;
export const SPLIT_MAX_BOXES = 4;
export const SPLIT_SIZES: SplitBoxSize[] = ['SMALL', 'MEDIUM', 'LARGE'];

// AC-1: only at the restaurant, before pickup, with no request waiting and no
// step of this job still waiting to be sent.
export const canRequestSplit = (order: Order): boolean =>
  !order.waitingToSend &&
  order.status === OrderStatus.courier_arrived_at_pickup_location &&
  order.splitRequest?.status !== 'OPEN';

export const isSplitOpen = (order: Order): boolean =>
  order.splitRequest?.status === 'OPEN';

// AC-2, AC-8: once the server's leave time has come, on the phone's clock.
export const canLeaveSplit = (order: Order, now: number): boolean => {
  const leaveFrom = order.splitLeaveFromOnPhone;
  if (order.waitingToSend || !isSplitOpen(order) || leaveFrom == null) {
    return false;
  }
  return now >= leaveFrom;
};

// The boxes a rider proposes: the count, then a size for each. Changing the
// count keeps the sizes already picked; a new box starts with none.
export const resizeBoxes = (
  sizes: (SplitBoxSize | null)[],
  count: number,
): (SplitBoxSize | null)[] =>
  Array.from({ length: count }, (_, index) => sizes[index] ?? null);

export const allBoxesSized = (
  sizes: (SplitBoxSize | null)[],
): sizes is SplitBoxSize[] =>
  sizes.length >= SPLIT_MIN_BOXES && sizes.every(size => size !== null);
