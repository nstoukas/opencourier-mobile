import { orderItemsOf } from './orderItems';
import { Order } from '@app/types/types';

describe('orderItemsOf (row 159)', () => {
  describe('non-list values', () => {
    it('returns an empty array when value is null or undefined', () => {
      expect(orderItemsOf(null)).toEqual([]);
      expect(orderItemsOf(undefined)).toEqual([]);
    });

    it('returns an empty array when value is a plain object', () => {
      expect(orderItemsOf({})).toEqual([]);
      expect(orderItemsOf({ name: 'Souvlaki', quantity: 2 })).toEqual([]);
    });

    it('returns an empty array when value is a string, number, or boolean', () => {
      expect(orderItemsOf('2x Souvlaki')).toEqual([]);
      expect(orderItemsOf(42)).toEqual([]);
      expect(orderItemsOf(true)).toEqual([]);
      expect(orderItemsOf(false)).toEqual([]);
    });
  });

  describe('list filtering and name validation', () => {
    it('filters out non-objects (nulls, numbers, strings, booleans)', () => {
      const input = [null, undefined, 42, 'Souvlaki', true, false];
      expect(orderItemsOf(input)).toEqual([]);
    });

    it('filters out objects without a name property or with non-string name', () => {
      const input = [
        {},
        { quantity: 2 },
        { size: 'Large' },
        { name: null },
        { name: 123 },
        { name: {} },
        { name: true },
      ];
      expect(orderItemsOf(input)).toEqual([]);
    });

    it('filters out items with empty or whitespace-only name', () => {
      const input = [
        { name: '' },
        { name: ' ' },
        { name: '   ' },
        { name: '\t\n ' },
      ];
      expect(orderItemsOf(input)).toEqual([]);
    });

    it('keeps items with a non-empty trimmed name', () => {
      const input = [{ name: 'Pita Gyros' }, { name: '  Greek Salad  ' }];
      const result = orderItemsOf(input);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Pita Gyros');
      expect(result[1].name).toBe('  Greek Salad  ');
    });
  });

  describe('normalisation of kept items', () => {
    describe('quantity normalisation', () => {
      it('preserves a valid positive numeric quantity', () => {
        const result = orderItemsOf([{ name: 'Burger', quantity: 3 }]);
        expect(result[0].quantity).toBe(3);
      });

      it('converts string quantity like "2" to number 2', () => {
        const result = orderItemsOf([{ name: 'Burger', quantity: '2' }]);
        expect(result[0].quantity).toBe(2);
        expect(typeof result[0].quantity).toBe('number');
      });

      it('normalises unreadable, zero, negative, or non-finite quantities to 1', () => {
        const input = [
          { name: 'Item A', quantity: 'x' },
          { name: 'Item B', quantity: 0 },
          { name: 'Item C', quantity: -1 },
          { name: 'Item D', quantity: -5 },
          { name: 'Item E', quantity: NaN },
          { name: 'Item F', quantity: Infinity },
          { name: 'Item G', quantity: -Infinity },
          { name: 'Item H' }, // undefined
        ];
        const result = orderItemsOf(input);
        expect(result.map(i => i.quantity)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
      });
    });

    describe('size normalisation', () => {
      it('preserves string size', () => {
        const result = orderItemsOf([
          { name: 'Pizza', size: 'Large' },
          { name: 'Coke', size: '0.33L' },
        ]);
        expect(result[0].size).toBe('Large');
        expect(result[1].size).toBe('0.33L');
      });

      it('normalises non-string or missing size to empty string', () => {
        const input = [
          { name: 'Item 1', size: 5 },
          { name: 'Item 2', size: null },
          { name: 'Item 3', size: {} },
          { name: 'Item 4', size: true },
          { name: 'Item 5' }, // undefined
        ];
        const result = orderItemsOf(input);
        expect(result.map(i => i.size)).toEqual(['', '', '', '', '']);
      });
    });

    describe('kind normalisation', () => {
      it('preserves DRINK and SIDE kinds', () => {
        const result = orderItemsOf([
          { name: 'Cola', kind: 'DRINK' },
          { name: 'Fries', kind: 'SIDE' },
        ]);
        expect(result[0].kind).toBe('DRINK');
        expect(result[1].kind).toBe('SIDE');
      });

      it('drops any other kind (such as FOOD, DESSERT, or arbitrary text)', () => {
        const input = [
          { name: 'Steak', kind: 'FOOD' },
          { name: 'Ice Cream', kind: 'DESSERT' },
          { name: 'Water', kind: 'drink' }, // lower case is not matching the enum
          { name: 'Unknown', kind: 123 },
        ];
        const result = orderItemsOf(input);
        expect(result.map(i => i.kind)).toEqual([
          undefined,
          undefined,
          undefined,
          undefined,
        ]);
      });
    });
  });

  describe('mixed list with valid, invalid, and edge-case items', () => {
    it('filters invalid entries and normalises all kept entries in place', () => {
      const mixedInput = [
        null,
        123,
        'random text',
        { price: 10 }, // missing name
        { name: '' }, // empty name
        { name: '   ' }, // whitespace name
        { name: 'Pork Gyros', quantity: '2', size: 'Large' },
        { name: 'Drink Cola', quantity: -1, kind: 'DRINK', size: 5 },
        { name: 'Fries', quantity: 'x', kind: 'SIDE' },
        { name: 'Salad', quantity: 0, kind: 'FOOD' },
      ];

      const result = orderItemsOf(mixedInput);

      expect(result).toEqual([
        {
          name: 'Pork Gyros',
          quantity: 2,
          size: 'Large',
          kind: undefined,
        },
        {
          name: 'Drink Cola',
          quantity: 1,
          size: '',
          kind: 'DRINK',
        },
        {
          name: 'Fries',
          quantity: 1,
          size: '',
          kind: 'SIDE',
        },
        {
          name: 'Salad',
          quantity: 1,
          size: '',
          kind: undefined,
        },
      ]);
    });
  });

  describe('Order type nullable fields contract (row 159)', () => {
    it('accepts null for all server-nullable fields and validates types', () => {
      // Compile-time check: an Order where every nullable field is explicitly null
      const orderWithNulls: Order = {
        id: 'del-row159',
        pickupName: 'Taverna',
        pickupPhoneNumber: '+302421012345',
        pickupBusinessName: 'Taverna Volos',
        pickupNotes: null,
        pickupVerification: null,
        pickupLocationId: 'loc-pickup',
        pickupReadyAt: null,
        pickupDeadlineAt: null,
        dropoffVerification: null,
        dropoffReadyAt: null,
        dropoffEta: null,
        dropoffDeadlineAt: null,
        deliverableAction: 'LEAVE_AT_DOOR',
        undeliverableAction: null,
        undeliverableReason: null,
        dropoffLocationId: 'loc-dropoff',
        deliveryTypes: ['STANDARD'],
        requiresDropoffSignature: false, // boolean
        requiresId: false,
        orderReference: null,
        orderTotalValue: null,
        orderItems: null, // unknown
        status: 'DISPATCHED',
        currencyCode: 'EUR',
        totalCost: null,
        fee: null,
        pay: null,
        totalCompensation: null,
        pickupTypes: ['FOOD'],
        idempotencyKey: null,
        externalStoreId: null,
        returnVerification: null,
        externalId: null,
        courierId: null,
        partnerId: null,
        deliveryQuoteId: 'quote-159',
        createdAt: '2026-11-24T12:00:00Z',
        pickupLocationNotes: [],
        dropOffLocationNotes: [],
        pickupLocation: {
          id: 'loc-pickup-1',
          addressLine1: 'Iasonos 12',
          addressLine2: '',
          longitude: 22.94,
          latitude: 39.36,
          formattedAddress: 'Iasonos 12, Volos',
        },
        dropoffLocation: {
          id: 'loc-dropoff-1',
          addressLine1: 'Dimitriadis 45',
          addressLine2: '',
          longitude: 22.94,
          latitude: 39.36,
          formattedAddress: 'Dimitriadis 45, Volos',
        },
      };

      expect(orderWithNulls.pickupNotes).toBeNull();
      expect(orderWithNulls.pickupVerification).toBeNull();
      expect(orderWithNulls.dropoffVerification).toBeNull();
      expect(orderWithNulls.returnVerification).toBeNull();
      expect(orderWithNulls.pickupReadyAt).toBeNull();
      expect(orderWithNulls.pickupDeadlineAt).toBeNull();
      expect(orderWithNulls.dropoffReadyAt).toBeNull();
      expect(orderWithNulls.dropoffEta).toBeNull();
      expect(orderWithNulls.dropoffDeadlineAt).toBeNull();
      expect(orderWithNulls.undeliverableAction).toBeNull();
      expect(orderWithNulls.undeliverableReason).toBeNull();
      expect(orderWithNulls.orderReference).toBeNull();
      expect(orderWithNulls.orderTotalValue).toBeNull();
      expect(orderWithNulls.idempotencyKey).toBeNull();
      expect(orderWithNulls.externalStoreId).toBeNull();
      expect(orderWithNulls.externalId).toBeNull();
      expect(orderWithNulls.courierId).toBeNull();
      expect(orderWithNulls.partnerId).toBeNull();
      expect(orderWithNulls.totalCost).toBeNull();
      expect(orderWithNulls.fee).toBeNull();
      expect(orderWithNulls.totalCompensation).toBeNull();
      expect(orderWithNulls.pay).toBeNull();
      expect(typeof orderWithNulls.requiresDropoffSignature).toBe('boolean');

      // orderItems is typed unknown so it accepts arbitrary shapes without type errors
      const orderWithObjectItems: Order = {
        ...orderWithNulls,
        orderItems: { unexpected: 'object' },
      };
      expect(orderItemsOf(orderWithObjectItems.orderItems)).toEqual([]);
    });
  });
});
