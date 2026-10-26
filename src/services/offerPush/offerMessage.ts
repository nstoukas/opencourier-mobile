// Reads the data messages the backend pushes (row 58, spec 0003). FCM data
// is all strings; this turns it into typed values, and anything that does not
// look like one of our two messages is ignored.
//
// The keys are the backend's `OFFER_CARD_PAYLOAD_KEYS`
// (`src/domains/delivery/offer-card-payload.ts` in opencourier-backend): the
// offer card's facts only. A push never carries the customer's name, phone,
// house number, notes or items (AC-10), and this file reads nothing else.

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
  distanceKm: string; // already formatted by the server, e.g. "2.4"
  minutes: string; // empty until row 70 sends it
  insistent: boolean; // the server's 2 minute re send (AC-7)
};

export type OfferMessage =
  | { kind: 'offer'; offer: OfferAlertData }
  | { kind: 'ended'; deliveryId: string; reason: string };

// `Record<string, ...>`: an object with any string keys, which is what FCM
// hands over as `message.data` (its values can also be objects on iOS).
type RawData = Record<string, unknown> | undefined;

const text = (data: Record<string, unknown>, key: string): string => {
  const value = data[key];
  return typeof value === 'string' ? value : '';
};

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
    return { kind: 'ended', deliveryId, reason: text(data, 'reason') };
  }
  if (type !== 'NEW_DELIVERY_OFFER') {
    return null;
  }

  // The deadline as a difference of two server times, so a wrong phone clock
  // changes nothing (spec 0002's rule; spec 0003's Value sourcing table).
  const expiresAt = timeOf(text(data, 'offerExpiresAt'));
  const serverNow = timeOf(text(data, 'serverNow'));
  const msLeftAtSend =
    expiresAt !== null && serverNow !== null ? expiresAt - serverNow : null;

  const pay = Number(text(data, 'payTotal'));
  return {
    kind: 'offer',
    offer: {
      deliveryId,
      offeredAt: text(data, 'offeredAt'),
      msLeftAtSend,
      payTotal: Number.isFinite(pay) ? pay : 0,
      currencyCode: text(data, 'currencyCode'),
      restaurantName: text(data, 'restaurantName'),
      dropoffArea: text(data, 'dropoffArea'),
      distanceKm: text(data, 'distanceKm'),
      minutes: text(data, 'minutes'),
      insistent: text(data, 'insistent') === '1',
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
  distanceKm: offer.distanceKm,
  minutes: offer.minutes,
  insistent: offer.insistent ? '1' : '',
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
    distanceKm: text(data, 'distanceKm'),
    minutes: text(data, 'minutes'),
    insistent: text(data, 'insistent') === '1',
  };
};
