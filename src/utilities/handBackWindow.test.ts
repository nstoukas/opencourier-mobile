import { OrderStatus } from '@app/types/enums';
import { Order, Location } from '@app/types/types';
import {
  handBackUntilOnPhone,
  handBackSecondsLeft,
  isHandBackWindowOpen,
  hidesCustomerDetails,
  canHandBack,
  dropoffAreaOf,
} from './handBackWindow';

describe('handBackWindow (spec 0020, AC-3, AC-4, AC-9, decisions 71.10, 71.11)', () => {
  describe('handBackSecondsLeft', () => {
    it('rounds up and never goes below 0 (0 for null or undefined)', () => {
      const now = 100_000;

      // 1.9 seconds left -> rounds up to 2
      expect(handBackSecondsLeft(now + 1900, now)).toBe(2);
      // 1.0 second left -> 1
      expect(handBackSecondsLeft(now + 1000, now)).toBe(1);
      // 1 millisecond left in the last second -> rounds up to 1
      expect(handBackSecondsLeft(now + 1, now)).toBe(1);
      // 0 milliseconds left -> 0
      expect(handBackSecondsLeft(now, now)).toBe(0);
      // Past the deadline -> 0, never negative
      expect(handBackSecondsLeft(now - 5000, now)).toBe(0);
      // Null or undefined -> 0
      expect(handBackSecondsLeft(null, now)).toBe(0);
      expect(handBackSecondsLeft(undefined, now)).toBe(0);
    });
  });

  describe('handBackUntilOnPhone', () => {
    it('moves server handBackUntil onto phone clock using request midpoint', () => {
      const serverNow = '2026-11-02T12:00:00.000Z';
      const handBackUntil = '2026-11-02T12:01:00.000Z'; // 60s ahead on server
      const phoneNow = 1_000_000;

      const untilOnPhone = handBackUntilOnPhone(handBackUntil, serverNow, phoneNow);
      expect(untilOnPhone).toBe(phoneNow + 60_000);
    });

    it('returns null when handBackUntil is null or undefined', () => {
      const serverNow = '2026-11-02T12:00:00.000Z';
      expect(handBackUntilOnPhone(null, serverNow, 1_000_000)).toBeNull();
      expect(handBackUntilOnPhone(undefined, serverNow, 1_000_000)).toBeNull();
    });
  });

  describe('isHandBackWindowOpen', () => {
    it('returns true while seconds left > 0, false when 0', () => {
      const now = 200_000;
      const orderOpen = { handBackUntilOnPhone: now + 5000 } as Order;
      const orderExpired = { handBackUntilOnPhone: now } as Order;
      const orderNoWindow = { handBackUntilOnPhone: null } as Order;

      expect(isHandBackWindowOpen(orderOpen, now)).toBe(true);
      expect(isHandBackWindowOpen(orderExpired, now)).toBe(false);
      expect(isHandBackWindowOpen(orderNoWindow, now)).toBe(false);
    });
  });

  describe('canHandBack', () => {
    it('needs the window open AND status ACCEPTED or DISPATCHED AND not waitingToSend', () => {
      const now = 300_000;
      const openWindow = now + 40_000;

      // Happy path: ACCEPTED, window open, not waitingToSend
      const acceptedOrder = {
        status: OrderStatus.accepted,
        handBackUntilOnPhone: openWindow,
        waitingToSend: false,
      } as Order;
      expect(canHandBack(acceptedOrder, now)).toBe(true);

      // Happy path: DISPATCHED, window open, not waitingToSend
      const dispatchedOrder = {
        status: OrderStatus.dispatched,
        handBackUntilOnPhone: openWindow,
        waitingToSend: false,
      } as Order;
      expect(canHandBack(dispatchedOrder, now)).toBe(true);

      // Refused when waitingToSend is true (step in flight / outbox)
      const waitingOrder = {
        status: OrderStatus.accepted,
        handBackUntilOnPhone: openWindow,
        waitingToSend: true,
      } as Order;
      expect(canHandBack(waitingOrder, now)).toBe(false);

      // Refused when status is COURIER_ARRIVED_AT_PICKUP_LOCATION or later (decision 71.6)
      const arrivedPickupOrder = {
        status: OrderStatus.courier_arrived_at_pickup_location,
        handBackUntilOnPhone: openWindow,
        waitingToSend: false,
      } as Order;
      expect(canHandBack(arrivedPickupOrder, now)).toBe(false);

      const pickedUpOrder = {
        status: OrderStatus.picked_up,
        handBackUntilOnPhone: openWindow,
        waitingToSend: false,
      } as Order;
      expect(canHandBack(pickedUpOrder, now)).toBe(false);

      // Refused when window is closed (0 seconds left)
      const expiredOrder = {
        status: OrderStatus.accepted,
        handBackUntilOnPhone: now,
        waitingToSend: false,
      } as Order;
      expect(canHandBack(expiredOrder, now)).toBe(false);

      // Refused when handBackUntilOnPhone is null
      const nullWindowOrder = {
        status: OrderStatus.accepted,
        handBackUntilOnPhone: null,
        waitingToSend: false,
      } as Order;
      expect(canHandBack(nullWindowOrder, now)).toBe(false);
    });
  });

  describe('hidesCustomerDetails', () => {
    it('needs the window open AND status ACCEPTED or DISPATCHED (false at COURIER_ARRIVED_AT_PICKUP_LOCATION even inside the window)', () => {
      const now = 400_000;
      const openWindow = now + 30_000;

      // Inside window at ACCEPTED -> true
      expect(
        hidesCustomerDetails(
          { status: OrderStatus.accepted, handBackUntilOnPhone: openWindow } as Order,
          now,
        ),
      ).toBe(true);

      // Inside window at DISPATCHED -> true
      expect(
        hidesCustomerDetails(
          { status: OrderStatus.dispatched, handBackUntilOnPhone: openWindow } as Order,
          now,
        ),
      ).toBe(true);

      // False at COURIER_ARRIVED_AT_PICKUP_LOCATION even inside the window (row 71 review, restaurant asks for name)
      expect(
        hidesCustomerDetails(
          {
            status: OrderStatus.courier_arrived_at_pickup_location,
            handBackUntilOnPhone: openWindow,
          } as Order,
          now,
        ),
      ).toBe(false);

      // False at PICKED_UP or later
      expect(
        hidesCustomerDetails(
          { status: OrderStatus.picked_up, handBackUntilOnPhone: openWindow } as Order,
          now,
        ),
      ).toBe(false);

      // False when window is closed even if status is ACCEPTED
      expect(
        hidesCustomerDetails(
          { status: OrderStatus.accepted, handBackUntilOnPhone: now } as Order,
          now,
        ),
      ).toBe(false);
    });
  });

  describe('dropoffAreaOf (decision 71.11, copy of backend dropoffAreaOf)', () => {
    it('matches the backend rule: street unless street contains house number, then city; never a number', () => {
      // 1. Standard case: street without house number -> returns street
      expect(
        dropoffAreaOf({
          street: 'Iasonos',
          houseNumber: '42',
          city: 'Volos',
        }),
      ).toBe('Iasonos');

      // 2. Street contains house number -> falls back to city
      expect(
        dropoffAreaOf({
          street: 'Iasonos 42',
          houseNumber: '42',
          city: 'Volos',
        }),
      ).toBe('Volos');

      // 3. Street contains house number and city contains house number -> returns empty string (never leak house number)
      expect(
        dropoffAreaOf({
          street: 'Iasonos 42',
          houseNumber: '42',
          city: 'Volos 42',
        }),
      ).toBe('');

      // 4. Missing house number -> falls back to city
      expect(
        dropoffAreaOf({
          street: 'Iasonos',
          houseNumber: '',
          city: 'Volos',
        }),
      ).toBe('Volos');

      // 5. Missing street -> returns city unless city contains house number
      expect(
        dropoffAreaOf({
          street: '',
          houseNumber: '10',
          city: 'Larissa',
        }),
      ).toBe('Larissa');

      expect(
        dropoffAreaOf({
          street: '',
          houseNumber: '10',
          city: 'Larissa 10',
        }),
      ).toBe('');

      // 6. Trims whitespace around values
      expect(
        dropoffAreaOf({
          street: '  Ermou  ',
          houseNumber: '  15  ',
          city: '  Athens  ',
        }),
      ).toBe('Ermou');

      // 7. Undefined or empty location -> returns empty string
      expect(dropoffAreaOf(undefined)).toBe('');
      expect(
        dropoffAreaOf({
          street: undefined as unknown as string,
          houseNumber: undefined as unknown as string,
          city: undefined as unknown as string,
        }),
      ).toBe('');
    });
  });
});
