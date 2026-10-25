// Moves an offer's server times onto the phone's clock (spec 0002, AC-9).
//
// The server sends each offer's `offeredAt` and `offerExpiresAt`, plus
// `serverNow`, its own clock at the moment it built the list. A phone clock can
// be minutes wrong, so the app never compares a server time with Date.now()
// directly. It takes the difference between two server times (for example
// "this offer ends 45 s after serverNow"), which no phone clock can change,
// and adds that difference to the phone's clock at the moment the list arrived.
// From then on the phone's own clock counts down, and the deadline lands at
// the same real moment as on the server, give or take the network delay.

import { OfferTimesOnPhone } from '@app/types/types';

// Server date text to milliseconds, or null when it is missing or unreadable.
const toMillis = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? null : millis;
};

// `serverNow` is the list's server clock; `phoneNow` is Date.now() when the
// list arrived. Without a readable `serverNow` (an older server), the server
// times are used as they are.
export const offerTimesOnPhone = (
  offer: { offeredAt?: string | null; offerExpiresAt?: string | null },
  serverNow: string | null | undefined,
  phoneNow: number,
): OfferTimesOnPhone => {
  const server = toMillis(serverNow);
  // How far the phone clock is ahead of the server clock (0 if unknown).
  const phoneAhead = server === null ? 0 : phoneNow - server;

  const onPhone = (value: string | null | undefined): number | null => {
    const millis = toMillis(value);
    return millis === null ? null : millis + phoneAhead;
  };

  return {
    offeredAt: onPhone(offer.offeredAt),
    expiresAt: onPhone(offer.offerExpiresAt),
  };
};
