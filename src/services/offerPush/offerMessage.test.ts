import {
  fromNotificationData,
  parseOfferMessage,
  toNotificationData,
} from './offerMessage';

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
    distanceKm: '3.1',
    minutes: '15',
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
        distanceKm: '3.1',
        minutes: '15',
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
    const offer = {
      deliveryId: 'del-roundtrip',
      offeredAt: '2026-10-26T10:00:00.000Z',
      msLeftAtSend: 30000,
      payTotal: 450,
      currencyCode: 'EUR',
      restaurantName: 'Co-op Grill',
      dropoffArea: 'Port Area',
      distanceKm: '1.8',
      minutes: '8',
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
      distanceKm: '1.8',
      minutes: '8',
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
});
