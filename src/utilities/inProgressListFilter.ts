import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { OutboxItem } from '@app/services/jobStepOutbox';
import { JobStep, shownStatus } from '@app/utilities/jobSteps';

/** IDs hidden until the in-progress feed no longer includes them (stale API / slow index). */
const hiddenAfterDeliveryIds = new Set<string>();

/** Call after a successful mark-as-delivered so the row does not reappear on stale refetches. */
export function hideInProgressOrderAfterDelivery(orderId: string): void {
  hiddenAfterDeliveryIds.add(orderId);
}

function pruneHiddenIds(raw: Order[]): void {
  for (const id of [...hiddenAfterDeliveryIds]) {
    if (!raw.some(o => o.id === id)) {
      hiddenAfterDeliveryIds.delete(id);
    }
  }
}

/**
 * In-progress tab should never list completed or canceled deliveries, or IDs we
 * just delivered, except a delivery with a job step still waiting in the
 * outbox (`keepIds`): the rider sees it until the step is sent (spec 0009).
 */
export function filterInProgressOrdersForDisplay(
  orders: Order[] | undefined,
  keepIds: ReadonlySet<string> = new Set(),
): Order[] {
  if (!orders?.length) {
    return [];
  }
  pruneHiddenIds(orders);
  return orders.filter(
    o =>
      keepIds.has(o.id) ||
      (!hiddenAfterDeliveryIds.has(o.id) &&
        o.status !== OrderStatus.dropped_off &&
        o.status !== OrderStatus.canceled),
  );
}

/** The ids of the deliveries with a step of this rider waiting to be sent. */
export function waitingDeliveryIds(
  items: OutboxItem[],
  courierId: string | undefined,
): Set<string> {
  return new Set(
    items
      .filter(i => i.courierId === courierId && i.state === 'waiting')
      .map(i => i.deliveryId),
  );
}

/**
 * The in-progress list as the screen shows it (spec 0009, AC-2): each order's
 * status moved on by its steps still waiting, and marked `waitingToSend`.
 * The cached server data is never edited, so a refetch cannot undo a tap.
 */
export function inProgressOrdersAsShown(
  orders: Order[] | undefined,
  items: OutboxItem[],
  courierId: string | undefined,
): Order[] {
  const keep = waitingDeliveryIds(items, courierId);
  return filterInProgressOrdersForDisplay(orders, keep).map(order => {
    const steps: JobStep[] = items
      .filter(
        i =>
          i.deliveryId === order.id &&
          i.courierId === courierId &&
          i.state === 'waiting',
      )
      .map(i => i.step);
    if (steps.length === 0) {
      return order;
    }
    return {
      ...order,
      status: shownStatus(order.status, steps),
      waitingToSend: true,
    };
  });
}
