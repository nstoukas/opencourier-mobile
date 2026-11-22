import {
  addOnJobOf,
  attachAddOnJobs,
  groupJobs,
  groupOffers,
  isCalmAddOn,
  isStack,
  isStopDone,
  nextStopIndex,
  stackStopsOf,
} from './stack';
import { Order, StackStop } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';

describe('stack utilities (spec 0048, row 80, AC-2, AC-5, AC-10)', () => {
  const sampleStops: StackStop[] = [
    { deliveryId: 'deliv-1', stop: 'PICKUP' },
    { deliveryId: 'deliv-2', stop: 'PICKUP' },
    { deliveryId: 'deliv-1', stop: 'DROPOFF' },
    { deliveryId: 'deliv-2', stop: 'DROPOFF' },
  ];

  const order1: Order = {
    id: 'deliv-1',
    offerGroupId: 'group-100',
    stackStops: sampleStops,
    status: OrderStatus.dispatched,
    totalCompensation: 500,
  } as Order;

  const order2: Order = {
    id: 'deliv-2',
    offerGroupId: 'group-100',
    stackStops: sampleStops,
    status: OrderStatus.dispatched,
    totalCompensation: 450,
  } as Order;

  describe('stackStopsOf', () => {
    it('returns the 4 stops when both partner and order match the stops list', () => {
      const result = stackStopsOf(order1, order2);
      expect(result).toEqual(sampleStops);
    });

    it('returns null if partner is undefined', () => {
      expect(stackStopsOf(order1, undefined)).toBeNull();
    });

    it('returns null if stackStops is null, undefined, or not an array', () => {
      expect(stackStopsOf({ ...order1, stackStops: null }, order2)).toBeNull();
      expect(
        stackStopsOf({ ...order1, stackStops: undefined }, order2),
      ).toBeNull();
    });

    it('returns null if stackStops length is not exactly 4', () => {
      const twoStops: StackStop[] = [
        { deliveryId: 'deliv-1', stop: 'PICKUP' },
        { deliveryId: 'deliv-2', stop: 'PICKUP' },
      ];
      expect(
        stackStopsOf({ ...order1, stackStops: twoStops }, order2),
      ).toBeNull();
    });

    it('returns null if stops do not reference both order IDs', () => {
      // 4 stops, but all belong to order1
      const wrongStops: StackStop[] = [
        { deliveryId: 'deliv-1', stop: 'PICKUP' },
        { deliveryId: 'deliv-1', stop: 'DROPOFF' },
        { deliveryId: 'deliv-1', stop: 'PICKUP' },
        { deliveryId: 'deliv-1', stop: 'DROPOFF' },
      ];
      expect(
        stackStopsOf({ ...order1, stackStops: wrongStops }, order2),
      ).toBeNull();

      // Or stops refer to an unrelated deliveryId
      const otherStops: StackStop[] = [
        { deliveryId: 'deliv-1', stop: 'PICKUP' },
        { deliveryId: 'deliv-3', stop: 'PICKUP' },
        { deliveryId: 'deliv-1', stop: 'DROPOFF' },
        { deliveryId: 'deliv-3', stop: 'DROPOFF' },
      ];
      expect(
        stackStopsOf({ ...order1, stackStops: otherStops }, order2),
      ).toBeNull();
    });
  });

  describe('isStopDone', () => {
    it('PICKUP stop is done once status is picked_up, on_the_way, courier_arrived_at_dropoff_location, or dropped_off', () => {
      const pickupStop: StackStop = { deliveryId: 'deliv-1', stop: 'PICKUP' };

      expect(isStopDone(pickupStop, OrderStatus.picked_up)).toBe(true);
      expect(isStopDone(pickupStop, OrderStatus.on_the_way)).toBe(true);
      expect(
        isStopDone(pickupStop, OrderStatus.courier_arrived_at_dropoff_location),
      ).toBe(true);
      expect(isStopDone(pickupStop, OrderStatus.dropped_off)).toBe(true);

      // Not done before pickup
      expect(isStopDone(pickupStop, OrderStatus.dispatched)).toBe(false);
      expect(isStopDone(pickupStop, OrderStatus.accepted)).toBe(false);
      expect(
        isStopDone(pickupStop, OrderStatus.courier_arrived_at_pickup_location),
      ).toBe(false);
      expect(isStopDone(pickupStop, OrderStatus.canceled)).toBe(false);
    });

    it('DROPOFF stop is done only once status is dropped_off or canceled', () => {
      const dropoffStop: StackStop = { deliveryId: 'deliv-1', stop: 'DROPOFF' };

      expect(isStopDone(dropoffStop, OrderStatus.dropped_off)).toBe(true);
      expect(isStopDone(dropoffStop, OrderStatus.canceled)).toBe(true);

      expect(isStopDone(dropoffStop, OrderStatus.picked_up)).toBe(false);
      expect(isStopDone(dropoffStop, OrderStatus.on_the_way)).toBe(false);
      expect(
        isStopDone(
          dropoffStop,
          OrderStatus.courier_arrived_at_dropoff_location,
        ),
      ).toBe(false);
    });
  });

  describe('nextStopIndex', () => {
    it('returns 0 when no stop is done yet', () => {
      const statusMap = {
        'deliv-1': OrderStatus.dispatched,
        'deliv-2': OrderStatus.dispatched,
      };
      const nextIndex = nextStopIndex(
        sampleStops,
        id => statusMap[id as keyof typeof statusMap],
      );
      expect(nextIndex).toBe(0);
    });

    it('returns 1 when the first pickup is done', () => {
      const statusMap = {
        'deliv-1': OrderStatus.picked_up,
        'deliv-2': OrderStatus.dispatched,
      };
      const nextIndex = nextStopIndex(
        sampleStops,
        id => statusMap[id as keyof typeof statusMap],
      );
      expect(nextIndex).toBe(1);
    });

    it('returns 2 when both pickups are done', () => {
      const statusMap = {
        'deliv-1': OrderStatus.picked_up,
        'deliv-2': OrderStatus.picked_up,
      };
      const nextIndex = nextStopIndex(
        sampleStops,
        id => statusMap[id as keyof typeof statusMap],
      );
      expect(nextIndex).toBe(2);
    });

    it('returns -1 when all stops are done', () => {
      const statusMap = {
        'deliv-1': OrderStatus.dropped_off,
        'deliv-2': OrderStatus.dropped_off,
      };
      const nextIndex = nextStopIndex(
        sampleStops,
        id => statusMap[id as keyof typeof statusMap],
      );
      expect(nextIndex).toBe(-1);
    });
  });

  describe('groupOffers', () => {
    it('groups two offers with the same offerGroupId into one card', () => {
      const cards = groupOffers([order1, order2]);
      expect(cards).toHaveLength(1);
      expect(cards[0].order.id).toBe('deliv-1');
      expect(cards[0].partner?.id).toBe('deliv-2');
    });

    it('leaves single offers without an offerGroupId on their own cards', () => {
      const singleOrder: Order = {
        id: 'deliv-single',
        status: OrderStatus.dispatched,
      } as Order;

      const cards = groupOffers([singleOrder]);
      expect(cards).toHaveLength(1);
      expect(cards[0].order.id).toBe('deliv-single');
      expect(cards[0].partner).toBeUndefined();
    });

    it('shows a grouped offer alone if its partner is not in the offers list', () => {
      // Only order1 arrived so far; partner order2 is missing
      const cards = groupOffers([order1]);
      expect(cards).toHaveLength(1);
      expect(cards[0].order.id).toBe('deliv-1');
      expect(cards[0].partner).toBeUndefined();
    });

    it('handles a mix of single offers and stacks preserving server order', () => {
      const singleA: Order = { id: 'single-A' } as Order;
      const stackA1: Order = { id: 'stack-A1', offerGroupId: 'grp-A' } as Order;
      const singleB: Order = { id: 'single-B' } as Order;
      const stackA2: Order = { id: 'stack-A2', offerGroupId: 'grp-A' } as Order;

      const cards = groupOffers([singleA, stackA1, singleB, stackA2]);
      expect(cards).toHaveLength(3);
      expect(cards[0].order.id).toBe('single-A');
      expect(cards[0].partner).toBeUndefined();

      expect(cards[1].order.id).toBe('stack-A1');
      expect(cards[1].partner?.id).toBe('stack-A2');

      expect(cards[2].order.id).toBe('single-B');
      expect(cards[2].partner).toBeUndefined();
    });
  });

  describe('groupJobs', () => {
    it('groups two jobs into one card with order set to the one whose stop comes next (stop 1)', () => {
      // Both dispatched: stop 0 is deliv-1 PICKUP, so deliv-1 is next
      const jobs = groupJobs([
        { ...order1, status: OrderStatus.dispatched },
        { ...order2, status: OrderStatus.dispatched },
      ]);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].order.id).toBe('deliv-1');
      expect(jobs[0].partner?.id).toBe('deliv-2');
    });

    it('swaps order and partner when the next stop belongs to the second delivery (stop 2)', () => {
      // deliv-1 is picked up: stop 0 is done. Stop 1 is deliv-2 PICKUP, so deliv-2 is next
      const jobs = groupJobs([
        { ...order1, status: OrderStatus.picked_up },
        { ...order2, status: OrderStatus.dispatched },
      ]);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].order.id).toBe('deliv-2');
      expect(jobs[0].partner?.id).toBe('deliv-1');
    });

    it('swaps back to deliv-1 when both pickups are done and stop 2 is deliv-1 dropoff', () => {
      // Both picked up: stop 2 is deliv-1 DROPOFF
      const jobs = groupJobs([
        { ...order1, status: OrderStatus.picked_up },
        { ...order2, status: OrderStatus.picked_up },
      ]);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].order.id).toBe('deliv-1');
      expect(jobs[0].partner?.id).toBe('deliv-2');
    });

    it('shows job as single if partner is missing from the held jobs list', () => {
      // Order1 has stackStops referencing deliv-2, but deliv-2 is not in the jobs array
      const jobs = groupJobs([order1]);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].order.id).toBe('deliv-1');
      expect(jobs[0].partner).toBeUndefined();
    });

    it('shows job as single if stackStops is null or invalid', () => {
      const jobWithoutStops: Order = {
        id: 'deliv-no-stops',
        stackStops: null,
      } as Order;

      const jobs = groupJobs([jobWithoutStops]);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].order.id).toBe('deliv-no-stops');
      expect(jobs[0].partner).toBeUndefined();
    });
  });

  describe('isStack', () => {
    it('returns true when partner is defined and false when undefined', () => {
      expect(isStack({ order: order1, partner: order2 })).toBe(true);
      expect(isStack({ order: order1 })).toBe(false);
      expect(isStack({ order: order1, partner: undefined })).toBe(false);
    });
  });

  describe('addOnJobOf (spec 0048, row 81, AC-6)', () => {
    const addOnOffer: Order = {
      id: 'deliv-addon',
      addOn: true,
      stackStops: [
        { deliveryId: 'deliv-held', stop: 'PICKUP' },
        { deliveryId: 'deliv-addon', stop: 'PICKUP' },
        { deliveryId: 'deliv-held', stop: 'DROPOFF' },
        { deliveryId: 'deliv-addon', stop: 'DROPOFF' },
      ],
      totalCompensation: 350,
    } as Order;

    const heldJob: Order = {
      id: 'deliv-held',
      status: OrderStatus.dispatched,
      totalCompensation: 450,
    } as Order;

    it('returns matching job when offer has addOn: true and valid stackStops referencing held job', () => {
      const job = addOnJobOf(addOnOffer, [heldJob]);
      expect(job).toEqual(heldJob);
    });

    it('returns undefined if offer.addOn is false or undefined', () => {
      expect(
        addOnJobOf({ ...addOnOffer, addOn: false }, [heldJob]),
      ).toBeUndefined();
      expect(
        addOnJobOf({ ...addOnOffer, addOn: undefined }, [heldJob]),
      ).toBeUndefined();
    });

    it('returns undefined if held job is not in jobs array', () => {
      expect(addOnJobOf(addOnOffer, [])).toBeUndefined();
      expect(
        addOnJobOf(addOnOffer, [{ id: 'other-job' } as Order]),
      ).toBeUndefined();
    });

    it('returns undefined if stackStops is null, malformed, or does not reference both deliveries', () => {
      expect(
        addOnJobOf({ ...addOnOffer, stackStops: null }, [heldJob]),
      ).toBeUndefined();
      expect(
        addOnJobOf({ ...addOnOffer, stackStops: [] }, [heldJob]),
      ).toBeUndefined();
      expect(
        addOnJobOf(
          {
            ...addOnOffer,
            stackStops: [
              { deliveryId: 'deliv-addon', stop: 'PICKUP' },
              { deliveryId: 'deliv-addon', stop: 'DROPOFF' },
            ],
          },
          [heldJob],
        ),
      ).toBeUndefined();
    });
  });

  describe('attachAddOnJobs (spec 0048, row 81, AC-10)', () => {
    const addOnOffer: Order = {
      id: 'deliv-addon',
      addOn: true,
      stackStops: [
        { deliveryId: 'deliv-held', stop: 'PICKUP' },
        { deliveryId: 'deliv-addon', stop: 'PICKUP' },
        { deliveryId: 'deliv-held', stop: 'DROPOFF' },
        { deliveryId: 'deliv-addon', stop: 'DROPOFF' },
      ],
    } as Order;

    const heldJob: Order = {
      id: 'deliv-held',
      status: OrderStatus.dispatched,
    } as Order;

    it('joins add on offer to the held job it rides with', () => {
      const cards = [{ order: addOnOffer }];
      const result = attachAddOnJobs(cards, [heldJob]);

      expect(result).toHaveLength(1);
      expect(result[0].order).toEqual(addOnOffer);
      expect(result[0].partner).toEqual(heldJob);
    });

    it('leaves card unchanged when partner is already set (e.g. stack)', () => {
      const stackCard = { order: order1, partner: order2 };
      const result = attachAddOnJobs([stackCard], [heldJob]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(stackCard);
    });

    it('leaves add on card without partner when held job is not in jobs array (until job list catches up)', () => {
      const cards = [{ order: addOnOffer }];
      const result = attachAddOnJobs(cards, []);

      expect(result).toHaveLength(1);
      expect(result[0].order).toEqual(addOnOffer);
      expect(result[0].partner).toBeUndefined();
    });
  });

  describe('isCalmAddOn (spec 0048, row 81, cross check 2)', () => {
    const addOnOffer: Order = {
      id: 'deliv-addon',
      addOn: true,
      stackStops: [
        { deliveryId: 'deliv-held', stop: 'PICKUP' },
        { deliveryId: 'deliv-addon', stop: 'PICKUP' },
        { deliveryId: 'deliv-held', stop: 'DROPOFF' },
        { deliveryId: 'deliv-addon', stop: 'DROPOFF' },
      ],
    } as Order;

    const heldJob: Order = {
      id: 'deliv-held',
      status: OrderStatus.dispatched,
    } as Order;

    it('returns false when offer.addOn is not true', () => {
      expect(isCalmAddOn({ id: 'deliv-single' } as Order, [])).toBe(false);
      expect(isCalmAddOn({ ...addOnOffer, addOn: false }, [])).toBe(false);
    });

    it('returns true when held job is not on phone (the calm side)', () => {
      expect(isCalmAddOn(addOnOffer, [])).toBe(true);
      // When stackStops is missing or names no other job, job lookup finds undefined and errs on calm side
      expect(
        isCalmAddOn({ ...addOnOffer, stackStops: undefined }, [heldJob]),
      ).toBe(true);
      expect(isCalmAddOn({ ...addOnOffer, stackStops: [] }, [heldJob])).toBe(
        true,
      );
    });

    it('returns true when held job status is in PAST_PICKUP (picked_up, on_the_way, arrived dropoff, dropped_off)', () => {
      for (const status of [
        OrderStatus.picked_up,
        OrderStatus.on_the_way,
        OrderStatus.courier_arrived_at_dropoff_location,
        OrderStatus.dropped_off,
      ]) {
        const job = { id: 'deliv-held', status } as Order;
        expect(isCalmAddOn(addOnOffer, [job])).toBe(true);
      }
    });

    it('returns false when held job is before pickup (dispatched, accepted, arrived pickup)', () => {
      for (const status of [
        OrderStatus.dispatched,
        OrderStatus.accepted,
        OrderStatus.courier_arrived_at_pickup_location,
      ]) {
        const job = { id: 'deliv-held', status } as Order;
        expect(isCalmAddOn(addOnOffer, [job])).toBe(false);
      }
    });
  });
});
