import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import {
  waitSeconds,
  waitClockText,
  isWaitingAtPickup,
  canLeaveWait,
} from './waitClock';

describe('waitClock (spec 0033, AC-5, AC-6)', () => {
  describe('waitSeconds', () => {
    it('calculates elapsed whole seconds and never goes below 0', () => {
      const arrived = 100_000;

      // Exactly at arrival
      expect(waitSeconds(arrived, 100_000)).toBe(0);

      // Fractional second rounds down
      expect(waitSeconds(arrived, 100_999)).toBe(0);
      expect(waitSeconds(arrived, 101_000)).toBe(1);
      expect(waitSeconds(arrived, 101_500)).toBe(1);

      // Multiple seconds
      expect(waitSeconds(arrived, 135_000)).toBe(35);

      // Before arrival time (e.g. clock jitter): returns 0, never negative
      expect(waitSeconds(arrived, 99_000)).toBe(0);
      expect(waitSeconds(arrived, 50_000)).toBe(0);
    });
  });

  describe('waitClockText', () => {
    it('formats clock text as "M:SS" with seconds padded', () => {
      // 0 seconds -> "0:00"
      expect(waitClockText(0)).toBe('0:00');

      // Single-digit seconds are zero-padded
      expect(waitClockText(5)).toBe('0:05');
      expect(waitClockText(9)).toBe('0:09');

      // Two-digit seconds
      expect(waitClockText(10)).toBe('0:10');
      expect(waitClockText(59)).toBe('0:59');

      // Exactly 6 minutes and 12 seconds (spec requirement: "6:12")
      expect(waitClockText(6 * 60 + 12)).toBe('6:12');

      // Exactly 1 minute
      expect(waitClockText(60)).toBe('1:00');
      expect(waitClockText(65)).toBe('1:05');
    });

    it('past 59 minutes keeps counting minutes without rolling over to hours', () => {
      // Exactly 60 minutes
      expect(waitClockText(60 * 60)).toBe('60:00');

      // 65 minutes and 4 seconds
      expect(waitClockText(65 * 60 + 4)).toBe('65:04');

      // 120 minutes and 30 seconds
      expect(waitClockText(120 * 60 + 30)).toBe('120:30');
    });
  });

  describe('isWaitingAtPickup', () => {
    it('returns true only at pickup arrival with an arrival timestamp', () => {
      const arrivedOrder: Order = {
        status: OrderStatus.courier_arrived_at_pickup_location,
        arrivedAtOnPhone: 100_000,
      } as Order;
      expect(isWaitingAtPickup(arrivedOrder)).toBe(true);
    });

    it('returns false at pickup arrival when arrivedAtOnPhone is null or undefined', () => {
      const nullArrivalOrder: Order = {
        status: OrderStatus.courier_arrived_at_pickup_location,
        arrivedAtOnPhone: null,
      } as Order;
      expect(isWaitingAtPickup(nullArrivalOrder)).toBe(false);

      const undefinedArrivalOrder: Order = {
        status: OrderStatus.courier_arrived_at_pickup_location,
      } as Order;
      expect(isWaitingAtPickup(undefinedArrivalOrder)).toBe(false);
    });

    it('returns false for any other status even if arrivedAtOnPhone is set', () => {
      const otherStatuses = [
        OrderStatus.accepted,
        OrderStatus.dispatched,
        OrderStatus.picked_up,
        OrderStatus.courier_arrived_at_dropoff_location,
        OrderStatus.dropped_off,
        OrderStatus.canceled,
      ];

      for (const status of otherStatuses) {
        const order = {
          status,
          arrivedAtOnPhone: 100_000,
        } as Order;
        expect(isWaitingAtPickup(order)).toBe(false);
      }
    });
  });

  describe('canLeaveWait', () => {
    const arrived = 100_000;
    const limitMinutes = 10;
    const limitMs = limitMinutes * 60_000; // 600,000 ms

    const baseOrder: Order = {
      status: OrderStatus.courier_arrived_at_pickup_location,
      arrivedAtOnPhone: arrived,
      waitLimitMinutes: limitMinutes,
    } as Order;

    it('appears exactly at the limit, not before', () => {
      // 1 ms before the limit -> false
      expect(canLeaveWait(baseOrder, arrived + limitMs - 1)).toBe(false);

      // 1 second before the limit -> false
      expect(canLeaveWait(baseOrder, arrived + limitMs - 1000)).toBe(false);

      // Exactly at the limit -> true
      expect(canLeaveWait(baseOrder, arrived + limitMs)).toBe(true);

      // Past the limit -> true
      expect(canLeaveWait(baseOrder, arrived + limitMs + 5000)).toBe(true);
    });

    it('refuses when waitLimitMinutes is missing or 0', () => {
      const noLimitOrder: Order = {
        ...baseOrder,
        waitLimitMinutes: undefined,
      };
      expect(canLeaveWait(noLimitOrder, arrived + limitMs + 10_000)).toBe(
        false,
      );

      const zeroLimitOrder: Order = {
        ...baseOrder,
        waitLimitMinutes: 0,
      };
      expect(canLeaveWait(zeroLimitOrder, arrived + limitMs + 10_000)).toBe(
        false,
      );
    });

    it('refuses when arrivedAtOnPhone is null or undefined', () => {
      const nullArrivalOrder: Order = {
        ...baseOrder,
        arrivedAtOnPhone: null,
      };
      expect(canLeaveWait(nullArrivalOrder, arrived + limitMs + 10_000)).toBe(
        false,
      );

      const undefinedArrivalOrder: Order = {
        ...baseOrder,
        arrivedAtOnPhone: undefined,
      };
      expect(
        canLeaveWait(undefinedArrivalOrder, arrived + limitMs + 10_000),
      ).toBe(false);
    });

    it('refuses for any status other than courier_arrived_at_pickup_location', () => {
      const nonPickupStatuses = [
        OrderStatus.accepted,
        OrderStatus.dispatched,
        OrderStatus.picked_up,
        OrderStatus.courier_arrived_at_dropoff_location,
        OrderStatus.dropped_off,
        OrderStatus.canceled,
      ];

      for (const status of nonPickupStatuses) {
        const order = {
          ...baseOrder,
          status,
        };
        expect(canLeaveWait(order, arrived + limitMs + 10_000)).toBe(false);
      }
    });
  });
});
