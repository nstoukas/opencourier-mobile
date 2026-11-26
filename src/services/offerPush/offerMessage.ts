// Reads the data messages the backend pushes (row 58, spec 0003). FCM data
// is all strings; this turns it into typed values, and anything that does not
// look like one of our two messages is ignored.
//
// The keys are the backend's `OFFER_CARD_PAYLOAD_KEYS`
// (`src/domains/delivery/offer-card-payload.ts` in opencourier-backend): the
// offer card's facts only. A push never carries the customer's name, phone,
// house number, notes or items (AC-10), and this file reads nothing else.

import { OfferTrip } from '@app/utilities/offerTrip';

export type OfferAlertData = {
  deliveryId: string;
  // The server's own text for when this offer was made: with `deliveryId` it
  // names one offer (the same delivery offered again gets a new one).
  offeredAt: string;
  // Milliseconds left on the server's clock when it sent the message; null
  // for an offer with no deadline (Offer expiry off, or an admin's offer).
  msLeftAtSend: number | null;
  payTotal: number; // minor units (cents)
  currencyCode: string;
  restaurantName: string;
  dropoffArea: string; // a street or a town, never a house number
  // The offer card's trip (row 100): metres to the restaurant and on to the
  // customer, and the minutes for both; null when unknown, so the alert shows
  // exactly what the card shows. The server still sends the quote's single
  // `distanceKm` for apps older than row 100; this app never shows it.
  trip: OfferTrip;
  insistent: boolean; // the server's 2 minute re send (AC-7)
  // Spec 0046 (AC-7): "Leg 1 of 2" of a multi leg order; null for a single
  // delivery (the server sends '' then, decision 10.2). `?` because a test or
  // an older caller may leave them out, which reads as a single delivery.
  legNumber?: number | null;
  legCount?: number | null;
  // Spec 0048 (cross check 11): one push carries a stack; this is the other
  // order's delivery id, null for a single offer. The phone then loads both
  // orders from the server rather than answering from the alert.
  partnerDeliveryId?: string | null;
  // Spec 0048 (row 81): an add on, one more order offered while on a job, and
  // whether the rider carries food already (cross check 2: then it is calm,
  // never insistent). `?` for older callers and tests: missing reads as false.
  addOn?: boolean;
  calm?: boolean;
};

export type OfferMessage =
  | { kind: 'offer'; offer: OfferAlertData }
  // Row 155: `offeredAt` names the offer that ended (null from an older server).
  | {
      kind: 'ended';
      deliveryId: string;
      reason: string;
      offeredAt: string | null;
    };

// Row 180: a copy of the backend's OFFER_CARD_PAYLOAD_KEYS, in its order, which must stay the same
// (src/utilities/backendCopiesParity.test.ts compares the two). Every key of an offer push besides
// `type`. The app reads most of them; `distanceKm` (for apps older than row 100), `boxSize` and
// `offerGroupId` it receives and leaves alone. `as const` keeps the exact strings, so the type
// below lists them.
export const OFFER_PUSH_KEYS = [
  'deliveryId',
  'offeredAt',
  'offerExpiresAt',
  'serverNow',
  'payTotal',
  'currencyCode',
  'restaurantName',
  'dropoffArea',
  'distanceKm',
  'toPickupMetres',
  'toDropoffMetres',
  'minutes',
  'insistent',
  'boxSize',
  'legNumber',
  'legCount',
  'offerGroupId',
  'partnerDeliveryId',
  'addOn',
  'calm',
] as const;

// `(typeof X)[number]`: any one element of the array X, so 'deliveryId' | 'offeredAt' | ...
export type OfferPushKey = (typeof OFFER_PUSH_KEYS)[number];

// `Record<string, ...>`: an object with any string keys, which is what FCM
// hands over as `message.data` (its values can also be objects on iOS).
type RawData = Record<string, unknown> | undefined;

const text = (data: Record<string, unknown>, key: string): string => {
  const value = data[key];
  return typeof value === 'string' ? value : '';
};

// A finite number sent as text (the server sends whole numbers), or null for
// '' or anything else.
const numberOf = (value: string): number | null => {
  if (value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// The trip figures, from a push or from the alert's own stored data.
const tripOf = (data: Record<string, unknown>): OfferTrip => ({
  toPickupMetres: numberOf(text(data, 'toPickupMetres')),
  toDropoffMetres: numberOf(text(data, 'toDropoffMetres')),
  minutes: numberOf(text(data, 'minutes')),
});

const textOf = (value: number | null): string =>
  value === null ? '' : String(value);

const timeOf = (value: string): number | null => {
  if (value === '') {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

export const parseOfferMessage = (data: RawData): OfferMessage | null => {
  if (!data) {
    return null;
  }
  const type = text(data, 'type');
  const deliveryId = text(data, 'deliveryId');
  if (deliveryId === '') {
    return null;
  }

  if (type === 'OFFER_ENDED') {
    return {
      kind: 'ended',
      deliveryId,
      reason: text(data, 'reason'),
      offeredAt: text(data, 'offeredAt') || null,
    };
  }
  if (type !== 'NEW_DELIVERY_OFFER') {
    return null;
  }

  // An offer push field: a read through `field` with a key outside OFFER_PUSH_KEYS is a type
  // error. Reads through `text` (type, deliveryId, the trip figures) are not; the parity test
  // checks those at run time.
  const field = (key: OfferPushKey): string => text(data, key);

  // The deadline as a difference of two server times, so a wrong phone clock
  // changes nothing (spec 0002's rule; spec 0003's Value sourcing table).
  const expiresAt = timeOf(field('offerExpiresAt'));
  const serverNow = timeOf(field('serverNow'));
  const msLeftAtSend =
    expiresAt !== null && serverNow !== null ? expiresAt - serverNow : null;

  const pay = Number(field('payTotal'));
  return {
    kind: 'offer',
    offer: {
      deliveryId,
      offeredAt: field('offeredAt'),
      msLeftAtSend,
      payTotal: Number.isFinite(pay) ? pay : 0,
      currencyCode: field('currencyCode'),
      restaurantName: field('restaurantName'),
      dropoffArea: field('dropoffArea'),
      trip: tripOf(data),
      insistent: field('insistent') === '1',
      legNumber: numberOf(field('legNumber')),
      legCount: numberOf(field('legCount')),
      partnerDeliveryId: field('partnerDeliveryId') || null,
      addOn: field('addOn') === '1',
      calm: field('calm') === '1',
    },
  };
};

// What the alert keeps in its own `data`, so the offer screen and the
// Accept and Decline buttons can work from the notification alone (AC-4,
// AC-5). notifee data must be strings too. `deadlineAt` is the deadline on
// this phone's clock, worked out once when the message arrived.
// `Omit<T, 'x'> & { ... }`: the type T without field x, plus the fields listed.
export type StoredOfferAlert = Omit<OfferAlertData, 'msLeftAtSend'> & {
  deadlineAt: number | null;
};

export const toNotificationData = (
  offer: OfferAlertData,
  deadlineAt: number | null,
): Record<string, string> => ({
  kind: 'offer-alert',
  deliveryId: offer.deliveryId,
  offeredAt: offer.offeredAt,
  deadlineAt: deadlineAt === null ? '' : String(deadlineAt),
  payTotal: String(offer.payTotal),
  currencyCode: offer.currencyCode,
  restaurantName: offer.restaurantName,
  dropoffArea: offer.dropoffArea,
  toPickupMetres: textOf(offer.trip.toPickupMetres),
  toDropoffMetres: textOf(offer.trip.toDropoffMetres),
  minutes: textOf(offer.trip.minutes),
  insistent: offer.insistent ? '1' : '',
  legNumber: textOf(offer.legNumber ?? null),
  legCount: textOf(offer.legCount ?? null),
  partnerDeliveryId: offer.partnerDeliveryId ?? '',
  addOn: offer.addOn ? '1' : '',
  calm: offer.calm ? '1' : '',
});

export const fromNotificationData = (
  data: RawData,
): StoredOfferAlert | null => {
  if (!data || text(data, 'kind') !== 'offer-alert') {
    return null;
  }
  const deliveryId = text(data, 'deliveryId');
  if (deliveryId === '') {
    return null;
  }
  const deadline = Number(text(data, 'deadlineAt'));
  const pay = Number(text(data, 'payTotal'));
  return {
    deliveryId,
    offeredAt: text(data, 'offeredAt'),
    deadlineAt:
      text(data, 'deadlineAt') !== '' && Number.isFinite(deadline)
        ? deadline
        : null,
    payTotal: Number.isFinite(pay) ? pay : 0,
    currencyCode: text(data, 'currencyCode'),
    restaurantName: text(data, 'restaurantName'),
    dropoffArea: text(data, 'dropoffArea'),
    trip: tripOf(data),
    insistent: text(data, 'insistent') === '1',
    legNumber: numberOf(text(data, 'legNumber')),
    legCount: numberOf(text(data, 'legCount')),
    partnerDeliveryId: text(data, 'partnerDeliveryId') || null,
    addOn: text(data, 'addOn') === '1',
    calm: text(data, 'calm') === '1',
  };
};
