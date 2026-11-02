import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import {
  LEAVE_AT_DOOR,
  cardStageOf,
  firstNameOf,
  notesFor,
  orderCodeOf,
} from './jobCard';

describe('jobCard utilities (spec 0021, AC-6 to AC-10, AC-14)', () => {
  describe('orderCodeOf (AC-7, AC-10)', () => {
    it('returns the last 6 characters of the delivery id', () => {
      expect(orderCodeOf('c3924f7e-98b3-4f9e-a89a-0123456789ab')).toBe(
        '6789ab',
      );
      expect(orderCodeOf('k3x9qz')).toBe('k3x9qz');
      expect(orderCodeOf('abc')).toBe('abc');
    });
  });

  describe('firstNameOf (AC-7)', () => {
    it('extracts the first word from dropoffName', () => {
      expect(firstNameOf('Maria Papadopoulou')).toBe('Maria');
      expect(firstNameOf('  Dimitris   K.  ')).toBe('Dimitris');
      expect(firstNameOf('SingleName')).toBe('SingleName');
    });

    it('returns empty string when name is null, undefined, or empty', () => {
      expect(firstNameOf(null)).toBe('');
      expect(firstNameOf(undefined)).toBe('');
      expect(firstNameOf('')).toBe('');
      expect(firstNameOf('   ')).toBe('');
    });
  });

  describe('cardStageOf (AC-6)', () => {
    it('returns "pickup" for accepted, dispatched, and arrived_at_pickup', () => {
      expect(cardStageOf(OrderStatus.accepted)).toBe('pickup');
      expect(cardStageOf(OrderStatus.dispatched)).toBe('pickup');
      expect(cardStageOf(OrderStatus.courier_arrived_at_pickup_location)).toBe(
        'pickup',
      );
    });

    it('returns "dropoff" after pickup', () => {
      expect(cardStageOf(OrderStatus.picked_up)).toBe('dropoff');
      expect(cardStageOf(OrderStatus.on_the_way)).toBe('dropoff');
      expect(cardStageOf(OrderStatus.courier_arrived_at_dropoff_location)).toBe(
        'dropoff',
      );
      expect(cardStageOf(OrderStatus.dropped_off)).toBe('dropoff');
      expect(cardStageOf(OrderStatus.canceled)).toBe('dropoff');
    });
  });

  describe('notesFor (AC-14)', () => {
    const baseOrder: Order = {
      id: 'del-1',
      status: OrderStatus.dispatched,
      pickupBusinessName: 'Souvlaki Bar',
    } as unknown as Order;

    describe('at pickup', () => {
      it('returns restaurant pickupNotes then rider pickupLocationNotes', () => {
        const order = {
          ...baseOrder,
          pickupNotes: 'Use side entrance near kitchen',
          pickupLocationNotes: [
            { note: 'Ring bell on left' },
            { note: 'Watch out for dog' },
          ],
        } as unknown as Order;

        const notes = notesFor(order, 'pickup');
        expect(notes).toEqual([
          { author: 'restaurant', text: 'Use side entrance near kitchen' },
          { author: 'riders', text: 'Ring bell on left' },
          { author: 'riders', text: 'Watch out for dog' },
        ]);
      });

      it('ignores dropoff notes and empty pickup notes', () => {
        const order = {
          ...baseOrder,
          pickupNotes: '   ',
          dropoffNotes: 'Leave at 3rd floor',
          pickupLocationNotes: [{ note: '' }, { note: 'Rider tip' }],
        } as unknown as Order;

        const notes = notesFor(order, 'pickup');
        expect(notes).toEqual([{ author: 'riders', text: 'Rider tip' }]);
      });
    });

    describe('at dropoff', () => {
      it('returns notes in order: leave at door, customer notes, restaurant seller notes, rider location notes', () => {
        const order = {
          ...baseOrder,
          deliverableAction: LEAVE_AT_DOOR,
          dropoffNotes: 'Door code 1234',
          customerNotes: ['Extra napkins requested'],
          dropoffSellerNotes: 'Handle soup container with care',
          dropOffLocationNotes: [{ note: 'Elevator is broken' }],
        } as unknown as Order;

        const notes = notesFor(order, 'dropoff');
        expect(notes).toEqual([
          { author: 'door', text: LEAVE_AT_DOOR },
          { author: 'customer', text: 'Door code 1234' },
          { author: 'customer', text: 'Extra napkins requested' },
          { author: 'restaurant', text: 'Handle soup container with care' },
          { author: 'riders', text: 'Elevator is broken' },
        ]);
      });

      it('does not include door note when deliverableAction is not LEAVE_AT_DOOR', () => {
        const order = {
          ...baseOrder,
          deliverableAction: 'MEET_AT_DOOR',
          dropoffNotes: 'Call upon arrival',
        } as unknown as Order;

        const notes = notesFor(order, 'dropoff');
        expect(notes).toEqual([
          { author: 'customer', text: 'Call upon arrival' },
        ]);
      });

      it('returns empty array when no notes exist', () => {
        const notes = notesFor(baseOrder, 'dropoff');
        expect(notes).toEqual([]);
      });
    });
  });
});
