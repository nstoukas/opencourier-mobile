import { Order, StackStop } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';

// Spec 0048 (row 80): stacks, two orders offered together to one rider and
// carried together. The rules the screens need, kept apart so each can be
// tested on its own. The server decides every stack; the phone only groups
// what it is sent.

// One card on home: a single offer or job, or a stack (`partner` set).
// For a stacked job, `order` is the order whose stop comes next, so the card,
// its swipe and its small actions act on that order as they would on a
// single job (the rider UI direction: one stop at a time).
export type CardOrders = { order: Order; partner?: Order };

// The stack's stops when they are usable: four stops of exactly the two
// orders given. Anything else (missing, the other order gone, a stop list
// for another pair) reads as a single order.
export const stackStopsOf = (
  order: Order,
  partner: Order | undefined,
): StackStop[] | null => {
  const stops = order.stackStops;
  if (!partner || !Array.isArray(stops) || stops.length !== 4) {
    return null;
  }
  const ids = new Set(stops.map(stop => stop.deliveryId));
  return ids.size === 2 && ids.has(order.id) && ids.has(partner.id)
    ? stops
    : null;
};

// Picked up, or past it.
const PAST_PICKUP: string[] = [
  OrderStatus.picked_up,
  OrderStatus.on_the_way,
  OrderStatus.courier_arrived_at_dropoff_location,
  OrderStatus.dropped_off,
];

// Whether a stop is behind the rider, from its order's status (the server's
// own rule, `isStopDone` in the backend's stack.ts).
export const isStopDone = (stop: StackStop, status: string): boolean =>
  stop.stop === 'PICKUP'
    ? PAST_PICKUP.includes(status)
    : status === OrderStatus.dropped_off || status === OrderStatus.canceled;

// The number (0 based) of the first stop still ahead, or -1 when all are done.
export const nextStopIndex = (
  stops: StackStop[],
  statusOf: (deliveryId: string) => string | undefined,
): number =>
  stops.findIndex(stop => !isStopDone(stop, statusOf(stop.deliveryId) ?? ''));

// Offers in the order the server listed them, a stack's two offers as one
// card (the first listed holds the card). An offer whose partner is missing
// from the list shows on its own: the list will catch up on the next fetch.
export const groupOffers = (offers: Order[]): CardOrders[] => {
  const cards: CardOrders[] = [];
  const used = new Set<string>();
  for (const offer of offers) {
    if (used.has(offer.id)) {
      continue;
    }
    const partner = offer.offerGroupId
      ? offers.find(
          other =>
            other.id !== offer.id &&
            other.offerGroupId === offer.offerGroupId &&
            !used.has(other.id),
        )
      : undefined;
    used.add(offer.id);
    if (partner) {
      used.add(partner.id);
      cards.push({ order: offer, partner });
    } else {
      cards.push({ order: offer });
    }
  }
  return cards;
};

// Jobs in the server's order, a stacked pair as one card whose `order` is the
// one with the next stop. Only while both orders are still this rider's jobs
// and the stop list names both (the server clears it once one of them ends).
export const groupJobs = (jobs: Order[]): CardOrders[] => {
  const cards: CardOrders[] = [];
  const used = new Set<string>();
  for (const job of jobs) {
    if (used.has(job.id)) {
      continue;
    }
    const partnerId = job.stackStops?.find(
      stop => stop.deliveryId !== job.id,
    )?.deliveryId;
    const partner = jobs.find(
      other => other.id === partnerId && !used.has(other.id),
    );
    const stops = stackStopsOf(job, partner);
    used.add(job.id);
    if (!partner || !stops) {
      cards.push({ order: job });
      continue;
    }
    used.add(partner.id);
    const byId = new Map([
      [job.id, job],
      [partner.id, partner],
    ]);
    const next = nextStopIndex(stops, id => byId.get(id)?.status);
    const nextId = next >= 0 ? stops[next].deliveryId : job.id;
    cards.push(
      nextId === job.id
        ? { order: job, partner }
        : { order: partner, partner: job },
    );
  }
  return cards;
};

// True for a card holding two orders. `card is Required<CardOrders>` tells
// TypeScript that, when this returns true, `card.partner` is set.
export const isStack = (card: CardOrders): card is Required<CardOrders> =>
  card.partner !== undefined;
