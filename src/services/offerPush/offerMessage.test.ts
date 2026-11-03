import {
  fromNotificationData,
  OfferAlertData,
  parseOfferMessage,
  toNotificationData,
} from './offerMessage';

// The offer from a parsed push, or a failed test when it is not an offer.
const offerOf = (data: Record<string, unknown>): OfferAlertData => {
  const parsed = parseOfferMessage(data);
  if (parsed?.kind !== 'offer') {
    throw new Error(`not an offer: ${JSON.stringify(parsed)}`);
  }
  return parsed.offer;
};

describe('offerMessage (spec 0003, AC-4, AC-10)', () => {
  const validData = {
    type: 'NEW_DELIVERY_OFFER',
    deliveryId: 'del-msg-123',
    offeredAt: '2026-10-26T10:00:00.000Z',
    offerExpiresAt: '2026-10-26T10:01:00.000Z',
    serverNow: '2026-10-26T10:00:10.000Z',
    payTotal: '650',
    currencyCode: 'EUR',
    restaurantName: 'Volos Bakery',
    dropoffArea: 'Dimitriadis',
    // The quote's single km, still sent for apps older than row 100.
    distanceKm: '3.1',
    toPickupMetres: '1834',
    toDropoffMetres: '1012',
    minutes: '6',
    insistent: '0',
  };

  it('AC-4: parses complete NEW_DELIVERY_OFFER message and computes msLeftAtSend from server times', () => {
    const parsed = parseOfferMessage(validData);

    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe('offer');
    if (parsed?.kind === 'offer') {
      expect(parsed.offer).toEqual({
        deliveryId: 'del-msg-123',
        offeredAt: '2026-10-26T10:00:00.000Z',
        msLeftAtSend: 50000, // 10:01:00 - 10:00:10 = 50s = 50000ms
        payTotal: 650,
        currencyCode: 'EUR',
        restaurantName: 'Volos Bakery',
        dropoffArea: 'Dimitriadis',
        trip: { toPickupMetres: 1834, toDropoffMetres: 1012, minutes: 6 },
        insistent: false,
      });
    }
  });

  it('parses insistent="1" flag as insistent: true', () => {
    const parsed = parseOfferMessage({
      ...validData,
      insistent: '1',
    });

    expect(parsed?.kind).toBe('offer');
    if (parsed?.kind === 'offer') {
      expect(parsed.offer.insistent).toBe(true);
    }
  });

  it('parses offer with no deadline as msLeftAtSend: null', () => {
    const parsed = parseOfferMessage({
      ...validData,
      offerExpiresAt: '',
    });

    expect(parsed?.kind).toBe('offer');
    if (parsed?.kind === 'offer') {
      expect(parsed.offer.msLeftAtSend).toBeNull();
    }
  });

  it('parses OFFER_ENDED message', () => {
    const parsed = parseOfferMessage({
      type: 'OFFER_ENDED',
      deliveryId: 'del-ended-1',
      reason: 'EXPIRED',
    });

    expect(parsed).toEqual({
      kind: 'ended',
      deliveryId: 'del-ended-1',
      reason: 'EXPIRED',
    });
  });

  it('rejects malformed or incomplete messages', () => {
    // Missing data object
    expect(parseOfferMessage(undefined)).toBeNull();
    expect(parseOfferMessage({})).toBeNull();

    // Missing deliveryId
    expect(
      parseOfferMessage({
        type: 'NEW_DELIVERY_OFFER',
        restaurantName: 'Test',
      }),
    ).toBeNull();
    expect(
      parseOfferMessage({
        type: 'NEW_DELIVERY_OFFER',
        deliveryId: '',
      }),
    ).toBeNull();

    // Unknown or invalid type
    expect(
      parseOfferMessage({
        type: 'UNKNOWN_TYPE',
        deliveryId: 'del-1',
      }),
    ).toBeNull();
  });

  it('AC-10: allow list excludes customer personal data (name, phone, houseNumber, notes, items)', () => {
    const rawWithCustomer = {
      ...validData,
      customerName: 'Secret Customer',
      customerPhone: '+306900000000',
      houseNumber: '42',
      customerNotes: 'Door code 1234',
      items: '2x Souvlaki',
    };

    const parsed = parseOfferMessage(rawWithCustomer);
    expect(parsed?.kind).toBe('offer');
    if (parsed?.kind === 'offer') {
      const keys = Object.keys(parsed.offer);
      expect(keys).not.toContain('customerName');
      expect(keys).not.toContain('customerPhone');
      expect(keys).not.toContain('houseNumber');
      expect(keys).not.toContain('customerNotes');
      expect(keys).not.toContain('items');
    }
  });

  it('toNotificationData and fromNotificationData roundtrip correctly', () => {
    const offer: OfferAlertData = {
      deliveryId: 'del-roundtrip',
      offeredAt: '2026-10-26T10:00:00.000Z',
      msLeftAtSend: 30000,
      payTotal: 450,
      currencyCode: 'EUR',
      restaurantName: 'Co-op Grill',
      dropoffArea: 'Port Area',
      trip: { toPickupMetres: 1800, toDropoffMetres: 950, minutes: 8 },
      insistent: true,
    };

    const deadlineAt = 1700000000000;
    const notificationData = toNotificationData(offer, deadlineAt);

    expect(notificationData.kind).toBe('offer-alert');
    expect(notificationData.deliveryId).toBe('del-roundtrip');
    expect(notificationData.insistent).toBe('1');
    expect(notificationData.payTotal).toBe('450');

    const restored = fromNotificationData(notificationData);
    expect(restored).toEqual({
      deliveryId: 'del-roundtrip',
      offeredAt: '2026-10-26T10:00:00.000Z',
      deadlineAt,
      payTotal: 450,
      currencyCode: 'EUR',
      restaurantName: 'Co-op Grill',
      dropoffArea: 'Port Area',
      trip: { toPickupMetres: 1800, toDropoffMetres: 950, minutes: 8 },
      insistent: true,
    });
  });

  it('fromNotificationData rejects malformed notification data (not kind offer-alert or empty deliveryId)', () => {
    expect(fromNotificationData(undefined)).toBeNull();
    expect(fromNotificationData({})).toBeNull();
    expect(
      fromNotificationData({
        kind: 'other-notification',
        deliveryId: 'del-1',
      }),
    ).toBeNull();
    expect(
      fromNotificationData({
        kind: 'offer-alert',
        deliveryId: '',
      }),
    ).toBeNull();
  });
  describe('the trip (row 100, decision 100.2)', () => {
    it('reads toPickupMetres, toDropoffMetres and minutes into trip as numbers', () => {
      const offer = offerOf(validData);
      expect(offer.trip).toEqual({
        toPickupMetres: 1834,
        toDropoffMetres: 1012,
        minutes: 6,
      });
      expect(typeof offer.trip.toPickupMetres).toBe('number');
      expect(typeof offer.trip.toDropoffMetres).toBe('number');
      expect(typeof offer.trip.minutes).toBe('number');
    });

    it('reads an empty figure as null (routing down)', () => {
      const offer = offerOf({
        ...validData,
        toPickupMetres: '',
        toDropoffMetres: '',
        minutes: '',
      });
      expect(offer.trip).toEqual({
        toPickupMetres: null,
        toDropoffMetres: null,
        minutes: null,
      });
    });

    it('reads a missing figure as null (a server older than row 100)', () => {
      // The push as it was before row 100: no trip keys at all.
      const older = Object.fromEntries(
        Object.entries(validData).filter(
          ([key]) =>
            !['toPickupMetres', 'toDropoffMetres', 'minutes'].includes(key),
        ),
      );
      expect(offerOf(older).trip).toEqual({
        toPickupMetres: null,
        toDropoffMetres: null,
        minutes: null,
      });
    });

    it('reads junk as null, figure by figure', () => {
      expect(
        offerOf({
          ...validData,
          toPickupMetres: 'abc',
          toDropoffMetres: '1012',
          minutes: '6',
        }).trip,
      ).toEqual({ toPickupMetres: null, toDropoffMetres: 1012, minutes: 6 });
      expect(
        offerOf({
          ...validData,
          toPickupMetres: '1834',
          toDropoffMetres: 'NaN',
          minutes: '6',
        }).trip,
      ).toEqual({ toPickupMetres: 1834, toDropoffMetres: null, minutes: 6 });
      expect(
        offerOf({
          ...validData,
          toPickupMetres: '1834',
          toDropoffMetres: '1012',
          minutes: 'soon',
        }).trip,
      ).toEqual({ toPickupMetres: 1834, toDropoffMetres: 1012, minutes: null });
      // FCM data is strings: a value of another type is not trusted either.
      expect(
        offerOf({
          ...validData,
          toPickupMetres: 1834,
          toDropoffMetres: { m: 1 },
          minutes: 'Infinity',
        }).trip,
      ).toEqual({ toPickupMetres: null, toDropoffMetres: null, minutes: null });
    });

    it('keeps one leg when only that leg is known', () => {
      expect(
        offerOf({
          ...validData,
          toPickupMetres: '',
          toDropoffMetres: '1012',
          minutes: '',
        }).trip,
      ).toEqual({ toPickupMetres: null, toDropoffMetres: 1012, minutes: null });
    });

    it("never carries the quote's distanceKm, even when the trip is unknown", () => {
      const offer = offerOf({
        ...validData,
        distanceKm: '3.1',
        toPickupMetres: '',
        toDropoffMetres: '',
        minutes: '',
      });
      expect(Object.keys(offer)).not.toContain('distanceKm');
      expect(offer.trip).toEqual({
        toPickupMetres: null,
        toDropoffMetres: null,
        minutes: null,
      });
      // Nowhere in the offer, in metres or in km.
      expect(JSON.stringify(offer)).not.toContain('3.1');
      expect(JSON.stringify(offer)).not.toContain('3100');

      const stored = toNotificationData(offer, null);
      expect(Object.keys(stored)).not.toContain('distanceKm');
      expect(JSON.stringify(stored)).not.toContain('3.1');
    });
  });

  describe('the stored alert data keeps the trip (row 100)', () => {
    const offer: OfferAlertData = {
      deliveryId: 'del-trip-store',
      offeredAt: '2026-10-26T10:00:00.000Z',
      msLeftAtSend: 30000,
      payTotal: 450,
      currencyCode: 'EUR',
      restaurantName: 'Co-op Grill',
      dropoffArea: 'Port Area',
      trip: { toPickupMetres: 1834, toDropoffMetres: 1012, minutes: 6 },
      insistent: false,
    };

    it.each([
      [
        'all known',
        { toPickupMetres: 1834, toDropoffMetres: 1012, minutes: 6 },
      ],
      [
        'all unknown',
        { toPickupMetres: null, toDropoffMetres: null, minutes: null },
      ],
      [
        'the restaurant leg only',
        { toPickupMetres: 1834, toDropoffMetres: null, minutes: null },
      ],
      [
        'the customer leg and minutes',
        { toPickupMetres: null, toDropoffMetres: 1012, minutes: 6 },
      ],
      ['zero metres', { toPickupMetres: 0, toDropoffMetres: 0, minutes: 0 }],
      [
        'a fraction',
        { toPickupMetres: 1834.6, toDropoffMetres: 1012, minutes: 6 },
      ],
    ])('round trips the trip with %s', (_name, trip) => {
      const data = toNotificationData({ ...offer, trip }, 1700000000000);
      // notifee data must be strings.
      Object.values(data).forEach(value => expect(typeof value).toBe('string'));
      expect(fromNotificationData(data)?.trip).toEqual(trip);
    });
  });
});
