import { OrderStatus } from '@app/types/enums';
import { Order, SplitBoxSize, SplitRequest } from '@app/types/types';
import {
  SPLIT_MAX_BOXES,
  SPLIT_MIN_BOXES,
  SPLIT_SIZES,
  allBoxesSized,
  canLeaveSplit,
  canRequestSplit,
  isSplitOpen,
  resizeBoxes,
} from './splitRequest';

// Spec 0047 (row 11): the rules the job card follows for a split at pickup.
describe('splitRequest rules (spec 0047, AC-1, AC-2, AC-8)', () => {
  const request = (status: SplitRequest['status']): SplitRequest => ({
    id: 'split-1',
    deliveryId: 'del-1',
    status,
    proposedLegs: [{ boxSize: 'LARGE' }, { boxSize: 'SMALL' }],
    finalLegs: null,
    createdAt: '2026-11-21T12:00:00.000Z',
    leaveFrom: '2026-11-21T12:10:00.000Z',
    adminNote: null,
  });

  const atRestaurant = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'del-1',
      status: OrderStatus.courier_arrived_at_pickup_location,
      splitRequest: null,
      ...overrides,
    } as unknown as Order);

  it('a split has 2 to 4 boxes, each Small, Medium or Large', () => {
    expect(SPLIT_MIN_BOXES).toBe(2);
    expect(SPLIT_MAX_BOXES).toBe(4);
    expect([...SPLIT_SIZES].sort()).toEqual(['LARGE', 'MEDIUM', 'SMALL']);
  });

  describe('canRequestSplit (AC-1: only at the restaurant, before pickup)', () => {
    it('is true at the restaurant with no request', () => {
      expect(canRequestSplit(atRestaurant())).toBe(true);
    });

    it.each([
      OrderStatus.accepted,
      OrderStatus.dispatched,
      OrderStatus.picked_up,
      OrderStatus.on_the_way,
      OrderStatus.courier_arrived_at_dropoff_location,
      OrderStatus.dropped_off,
      OrderStatus.canceled,
    ])('is false in status %s', status => {
      expect(canRequestSplit(atRestaurant({ status }))).toBe(false);
    });

    it('is false while a request is already open', () => {
      expect(
        canRequestSplit(atRestaurant({ splitRequest: request('OPEN') })),
      ).toBe(false);
    });

    it('is false while a step of this job still waits to be sent (the server may not know the rider arrived)', () => {
      expect(canRequestSplit(atRestaurant({ waitingToSend: true }))).toBe(
        false,
      );
    });

    it.each(['REFUSED', 'CONFIRMED'] as const)(
      'is true again after a %s request (the server allows another, up to four legs)',
      status => {
        expect(
          canRequestSplit(atRestaurant({ splitRequest: request(status) })),
        ).toBe(true);
      },
    );
  });

  describe('isSplitOpen', () => {
    it('is true only for an OPEN request', () => {
      expect(isSplitOpen(atRestaurant({ splitRequest: request('OPEN') }))).toBe(
        true,
      );
      for (const status of ['CONFIRMED', 'REFUSED', 'LEFT', 'VOID'] as const) {
        expect(
          isSplitOpen(atRestaurant({ splitRequest: request(status) })),
        ).toBe(false);
      }
      expect(isSplitOpen(atRestaurant())).toBe(false);
    });
  });

  describe('canLeaveSplit (AC-2, AC-8: Leave once the limit has passed)', () => {
    const leaveFrom = 1_000_000;
    const waiting = (overrides: Partial<Order> = {}) =>
      atRestaurant({
        splitRequest: request('OPEN'),
        splitLeaveFromOnPhone: leaveFrom,
        ...overrides,
      });

    it('is false one millisecond before the leave time', () => {
      expect(canLeaveSplit(waiting(), leaveFrom - 1)).toBe(false);
    });

    it('is true at the leave time and after it', () => {
      expect(canLeaveSplit(waiting(), leaveFrom)).toBe(true);
      expect(canLeaveSplit(waiting(), leaveFrom + 60_000)).toBe(true);
    });

    it('is false when the request is not open, however late it is', () => {
      for (const status of ['CONFIRMED', 'REFUSED', 'LEFT', 'VOID'] as const) {
        expect(
          canLeaveSplit(
            waiting({ splitRequest: request(status) }),
            leaveFrom + 60_000,
          ),
        ).toBe(false);
      }
      expect(
        canLeaveSplit(waiting({ splitRequest: null }), leaveFrom + 60_000),
      ).toBe(false);
    });

    it('is false when the phone does not know the leave time yet', () => {
      expect(
        canLeaveSplit(
          waiting({ splitLeaveFromOnPhone: null }),
          leaveFrom + 60_000,
        ),
      ).toBe(false);
      expect(
        canLeaveSplit(
          waiting({ splitLeaveFromOnPhone: undefined }),
          leaveFrom + 60_000,
        ),
      ).toBe(false);
    });

    it('is false while a step of this job still waits to be sent', () => {
      expect(
        canLeaveSplit(waiting({ waitingToSend: true }), leaveFrom + 60_000),
      ).toBe(false);
    });
  });

  describe('resizeBoxes (changing the number of boxes)', () => {
    it('keeps the sizes already picked and starts a new box with none', () => {
      expect(resizeBoxes(['LARGE', 'SMALL'], 3)).toEqual([
        'LARGE',
        'SMALL',
        null,
      ]);
      expect(resizeBoxes(['LARGE', null], 4)).toEqual([
        'LARGE',
        null,
        null,
        null,
      ]);
    });

    it('drops the last boxes when the count goes down', () => {
      expect(resizeBoxes(['LARGE', 'MEDIUM', 'SMALL', 'SMALL'], 2)).toEqual([
        'LARGE',
        'MEDIUM',
      ]);
    });
  });

  describe('allBoxesSized (Send stays off until every box has a size)', () => {
    it('is true for 2, 3 or 4 boxes that all have a size', () => {
      expect(allBoxesSized(['LARGE', 'SMALL'])).toBe(true);
      expect(allBoxesSized(['LARGE', 'SMALL', 'MEDIUM'])).toBe(true);
      expect(allBoxesSized(['LARGE', 'SMALL', 'MEDIUM', 'SMALL'])).toBe(true);
    });

    it('is false while any box has no size', () => {
      expect(allBoxesSized([null, null])).toBe(false);
      expect(allBoxesSized(['LARGE', null])).toBe(false);
      expect(allBoxesSized(['LARGE', 'SMALL', null])).toBe(false);
    });

    it('is false for fewer than 2 boxes: one box is not a split', () => {
      const one: (SplitBoxSize | null)[] = ['LARGE'];
      expect(allBoxesSized(one)).toBe(false);
      expect(allBoxesSized([])).toBe(false);
    });
  });
});
