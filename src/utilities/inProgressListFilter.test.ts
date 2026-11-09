import {
  filterInProgressOrdersForDisplay,
  hideInProgressOrderAfterDelivery,
  waitingDeliveryIds,
  inProgressOrdersAsShown,
} from './inProgressListFilter';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { OutboxItem } from '@app/services/jobStepOutbox';
import { isWaitingAtPickup, canLeaveWait } from './waitClock';

describe('filterInProgressOrdersForDisplay (decision 65.10)', () => {
  it('returns empty array when input is undefined or empty', () => {
    expect(filterInProgressOrdersForDisplay(undefined)).toEqual([]);
    expect(filterInProgressOrdersForDisplay([])).toEqual([]);
  });

  it('keeps only DISPATCHED and PICKED_UP orders from DISPATCHED, PICKED_UP, DROPPED_OFF, and CANCELED', () => {
    const orders: Partial<Order>[] = [
      { id: 'order-dispatched', status: OrderStatus.dispatched },
      { id: 'order-picked-up', status: OrderStatus.picked_up },
      { id: 'order-dropped-off', status: OrderStatus.dropped_off },
      { id: 'order-canceled', status: OrderStatus.canceled },
    ];

    const result = filterInProgressOrdersForDisplay(orders as Order[]);
    expect(result.map(o => o.id)).toEqual([
      'order-dispatched',
      'order-picked-up',
    ]);
  });

  it('drops an order whose id is in the hidden after delivery set whatever its status', () => {
    hideInProgressOrderAfterDelivery('order-hidden');

    const orders: Partial<Order>[] = [
      { id: 'order-hidden', status: OrderStatus.picked_up },
      { id: 'order-visible', status: OrderStatus.dispatched },
    ];

    const result = filterInProgressOrdersForDisplay(orders as Order[]);
    expect(result.map(o => o.id)).toEqual(['order-visible']);
  });

  it('drops hidden order even if its status is DISPATCHED', () => {
    hideInProgressOrderAfterDelivery('order-hidden-dispatched');

    const orders: Partial<Order>[] = [
      { id: 'order-hidden-dispatched', status: OrderStatus.dispatched },
      { id: 'order-visible-pickup', status: OrderStatus.picked_up },
    ];

    const result = filterInProgressOrdersForDisplay(orders as Order[]);
    expect(result.map(o => o.id)).toEqual(['order-visible-pickup']);
  });
});

describe('waitingDeliveryIds (spec 0009, AC-2, AC-8)', () => {
  it('returns delivery IDs with waiting items for this courier only, ignoring refused and other couriers', () => {
    const items: OutboxItem[] = [
      {
        id: '1',
        courierId: 'c1',
        deliveryId: 'd1',
        step: 'dispatched',
        tappedAt: 1000,
        state: 'waiting',
        restaurantName: 'R1',
      },
      {
        id: '2',
        courierId: 'c1',
        deliveryId: 'd2',
        step: 'delivered',
        tappedAt: 1000,
        state: 'refused', // Refused items do not count as waiting
        restaurantName: 'R2',
      },
      {
        id: '3',
        courierId: 'c2', // Other courier
        deliveryId: 'd3',
        step: 'picked_up',
        tappedAt: 1000,
        state: 'waiting',
        restaurantName: 'R3',
      },
    ];

    const result = waitingDeliveryIds(items, 'c1');
    expect(result).toEqual(new Set(['d1']));
  });
});

describe('inProgressOrdersAsShown (spec 0009, AC-2)', () => {
  it('keeps a delivery whose server or shown status is DROPPED_OFF while a waiting step exists, marks it waitingToSend, and updates shown status', () => {
    const orders: Partial<Order>[] = [
      {
        id: 'del-dropped-off-server',
        status: OrderStatus.dropped_off,
      },
      {
        id: 'del-delivered-locally',
        status: OrderStatus.picked_up,
      },
      {
        id: 'del-normal-active',
        status: OrderStatus.dispatched,
      },
    ];

    const outboxItems: OutboxItem[] = [
      {
        id: '1',
        courierId: 'c1',
        deliveryId: 'del-dropped-off-server',
        step: 'delivered',
        tappedAt: 1000,
        state: 'waiting',
        restaurantName: 'R1',
      },
      {
        id: '2',
        courierId: 'c1',
        deliveryId: 'del-delivered-locally',
        step: 'delivered',
        tappedAt: 1010,
        state: 'waiting',
        restaurantName: 'R2',
      },
    ];

    const result = inProgressOrdersAsShown(
      orders as Order[],
      outboxItems,
      'c1',
    );

    expect(result).toHaveLength(3);

    // del-dropped-off-server is kept despite being dropped_off because it has a waiting step
    const del1 = result.find(o => o.id === 'del-dropped-off-server');
    expect(del1).toBeDefined();
    expect(del1?.status).toBe(OrderStatus.dropped_off);
    expect(del1?.waitingToSend).toBe(true);

    // del-delivered-locally has shown status updated to dropped_off and waitingToSend true
    const del2 = result.find(o => o.id === 'del-delivered-locally');
    expect(del2).toBeDefined();
    expect(del2?.status).toBe(OrderStatus.dropped_off);
    expect(del2?.waitingToSend).toBe(true);

    // del-normal-active has no waiting steps: remains dispatched, waitingToSend is undefined
    const del3 = result.find(o => o.id === 'del-normal-active');
    expect(del3).toBeDefined();
    expect(del3?.status).toBe(OrderStatus.dispatched);
    expect(del3?.waitingToSend).toBeUndefined();
  });

  it('drops a dropped_off delivery once nothing waits for it', () => {
    const orders: Partial<Order>[] = [
      {
        id: 'del-dropped-off-server',
        status: OrderStatus.dropped_off,
      },
      {
        id: 'del-active',
        status: OrderStatus.dispatched,
      },
    ];

    // Outbox is empty: nothing waits
    const result = inProgressOrdersAsShown(orders as Order[], [], 'c1');

    expect(result.map(o => o.id)).toEqual(['del-active']);
  });

  it('refused items do not count as waiting (dropped_off delivery is dropped if its item is refused)', () => {
    const orders: Partial<Order>[] = [
      {
        id: 'del-dropped-off-server',
        status: OrderStatus.dropped_off,
      },
      {
        id: 'del-active',
        status: OrderStatus.dispatched,
      },
    ];

    const outboxItems: OutboxItem[] = [
      {
        id: '1',
        courierId: 'c1',
        deliveryId: 'del-dropped-off-server',
        step: 'delivered',
        tappedAt: 1000,
        state: 'refused', // Refused: not waiting!
        restaurantName: 'R1',
      },
    ];

    const result = inProgressOrdersAsShown(
      orders as Order[],
      outboxItems,
      'c1',
    );

    expect(result.map(o => o.id)).toEqual(['del-active']);
  });

  describe('provisional arrival at pickup (spec 0033, AC-5, AC-6)', () => {
    const baseOrder: Partial<Order> = {
      id: 'del-wait',
      status: OrderStatus.dispatched,
    };

    it("gives arrivedAtOnPhone from the arrived_at_pickup step's tappedAt when the server has none", () => {
      const tappedAt = 50_000;
      const outboxItems: OutboxItem[] = [
        {
          id: 'step-1',
          courierId: 'c1',
          deliveryId: 'del-wait',
          step: 'arrived_at_pickup',
          tappedAt,
          state: 'waiting',
          restaurantName: 'Test Tavern',
        },
      ];

      const result = inProgressOrdersAsShown(
        [baseOrder as Order],
        outboxItems,
        'c1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].arrivedAtOnPhone).toBe(tappedAt);
      expect(result[0].status).toBe(
        OrderStatus.courier_arrived_at_pickup_location,
      );
      expect(result[0].waitingToSend).toBe(true);
    });

    it('never overrides an existing server arrival timestamp', () => {
      const serverArrival = 99_000;
      const orderWithServerArrival: Partial<Order> = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        arrivedAtOnPhone: serverArrival,
      };

      const outboxItems: OutboxItem[] = [
        {
          id: 'step-1',
          courierId: 'c1',
          deliveryId: 'del-wait',
          step: 'arrived_at_pickup',
          tappedAt: 50_000,
          state: 'waiting',
          restaurantName: 'Test Tavern',
        },
      ];

      const result = inProgressOrdersAsShown(
        [orderWithServerArrival as Order],
        outboxItems,
        'c1',
      );

      expect(result).toHaveLength(1);
      // Preserves server arrival, not the outbox tap
      expect(result[0].arrivedAtOnPhone).toBe(serverArrival);
    });

    it("ignores another rider's arrived_at_pickup step", () => {
      const outboxItems: OutboxItem[] = [
        {
          id: 'step-other-courier',
          courierId: 'c2', // Different courier
          deliveryId: 'del-wait',
          step: 'arrived_at_pickup',
          tappedAt: 50_000,
          state: 'waiting',
          restaurantName: 'Test Tavern',
        },
      ];

      const result = inProgressOrdersAsShown(
        [baseOrder as Order],
        outboxItems,
        'c1', // Current courier is c1
      );

      expect(result).toHaveLength(1);
      expect(result[0].arrivedAtOnPhone).toBeUndefined();
      expect(result[0].waitingToSend).toBeUndefined();
    });

    it('ignores a sent step (removed from outbox) or non-waiting step', () => {
      // Once sent, the step is removed from the outbox
      const resultSent = inProgressOrdersAsShown(
        [baseOrder as Order],
        [],
        'c1',
      );
      expect(resultSent).toHaveLength(1);
      expect(resultSent[0].arrivedAtOnPhone).toBeUndefined();
      expect(resultSent[0].waitingToSend).toBeUndefined();

      // A refused step does not count as waiting
      const refusedItems: OutboxItem[] = [
        {
          id: 'step-refused',
          courierId: 'c1',
          deliveryId: 'del-wait',
          step: 'arrived_at_pickup',
          tappedAt: 50_000,
          state: 'refused',
          restaurantName: 'Test Tavern',
        },
      ];

      const resultRefused = inProgressOrdersAsShown(
        [baseOrder as Order],
        refusedItems,
        'c1',
      );
      expect(resultRefused).toHaveLength(1);
      expect(resultRefused[0].arrivedAtOnPhone).toBeUndefined();
      expect(resultRefused[0].waitingToSend).toBeUndefined();
    });

    it("with a queued dispatched step ahead of the arrival step, counts from the arrival step's tappedAt, not the first step's", () => {
      const dispatchedTappedAt = 10_000;
      const arrivalTappedAt = 25_000;
      const outboxItems: OutboxItem[] = [
        {
          id: 'step-dispatched',
          courierId: 'c1',
          deliveryId: 'del-wait',
          step: 'dispatched',
          tappedAt: dispatchedTappedAt,
          state: 'waiting',
          restaurantName: 'Test Tavern',
        },
        {
          id: 'step-arrival',
          courierId: 'c1',
          deliveryId: 'del-wait',
          step: 'arrived_at_pickup',
          tappedAt: arrivalTappedAt,
          state: 'waiting',
          restaurantName: 'Test Tavern',
        },
      ];

      const result = inProgressOrdersAsShown(
        [baseOrder as Order],
        outboxItems,
        'c1',
      );

      expect(result).toHaveLength(1);
      // Clock must count from the arrival step's tappedAt, not the first step's
      expect(result[0].arrivedAtOnPhone).toBe(arrivalTappedAt);
      expect(result[0].status).toBe(
        OrderStatus.courier_arrived_at_pickup_location,
      );
      expect(result[0].waitingToSend).toBe(true);
    });

    it('clock shows with that provisional time and Leave stays hidden', () => {
      const tappedAt = 50_000;
      const leaveFromOnPhone = 100_000;

      const outboxItems: OutboxItem[] = [
        {
          id: 'step-1',
          courierId: 'c1',
          deliveryId: 'del-wait',
          step: 'arrived_at_pickup',
          tappedAt,
          state: 'waiting',
          restaurantName: 'Test Tavern',
        },
      ];

      const result = inProgressOrdersAsShown(
        [
          {
            ...baseOrder,
            leaveFromOnPhone,
          } as Order,
        ],
        outboxItems,
        'c1',
      );

      const shownOrder = result[0];
      // Clock shows because isWaitingAtPickup is true with the provisional arrivedAtOnPhone
      expect(isWaitingAtPickup(shownOrder)).toBe(true);

      // Leave stays hidden because waitingToSend is true, even well past leaveFromOnPhone
      const wellPastLimitTime = leaveFromOnPhone + 30_000;
      expect(canLeaveWait(shownOrder, wellPastLimitTime)).toBe(false);
    });
  });
});
