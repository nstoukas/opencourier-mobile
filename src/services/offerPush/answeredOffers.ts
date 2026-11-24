// The offers this phone has already answered (row 58, spec 0003, AC-5).
//
// A rider can answer the same offer two ways: a button on the alert (which can
// run with the app closed) and a tap in the app. This list keeps the phone
// from sending twice. It is not the real guarantee: the server accepts or
// declines an offer at most once and answers 409 to anything later (spec
// 0002, AC-5). The list only saves the second request.
//
// An offer is named by its delivery id and the server's `offeredAt`, not by
// the delivery id alone: the same delivery can be offered to the same rider
// again later, and that new offer must still be answerable.
//
// Row 131 adds a second list beside it: the offers whose Decline from the
// alert could not be sent, so the phone never accepts them by itself. Same
// offer key, same storage rules.
//
// Kept on the phone only, with no time attached, and never sent anywhere
// (value 5): it says nothing about how fast anyone answered.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'answered_offer_ids';
// Row 131: the offers whose Decline from the alert could not be sent. Kept
// apart from the answered list, which a failed send leaves, so the rider can
// still answer from the app; this one only stops the phone accepting them.
const DECLINE_FAILED_KEY = 'decline_failed_offer_ids';
// Enough to cover every offer a rider could still see; older ones drop off.
const KEEP_AT_MOST = 50;

export const offerKeyOf = (deliveryId: string, offeredAt?: string | null) =>
  `${deliveryId}@${offeredAt ?? ''}`;

// The list in memory, so the app's tap check stays synchronous. Loaded from
// storage once; `answerOffer` waits for the load before it checks.
let answered: string[] = [];
let declineFailed: string[] = [];
let loading: Promise<void> | null = null;

// The stored list under `key`, joined with what is already in memory (kept
// first from storage, then anything added before the load finished).
const mergedWithStored = async (
  key: string,
  inMemory: string[],
): Promise<string[]> => {
  const stored = await AsyncStorage.getItem(key);
  const fromStorage: unknown = stored ? JSON.parse(stored) : [];
  if (!Array.isArray(fromStorage)) {
    return inMemory;
  }
  const merged = [...fromStorage.map(String), ...inMemory];
  return merged.filter((item, i) => merged.indexOf(item) === i);
};

export const loadAnsweredOffers = (): Promise<void> => {
  if (loading === null) {
    loading = Promise.all([
      mergedWithStored(STORAGE_KEY, answered)
        .then(list => {
          answered = list;
        })
        .catch(() => undefined),
      // Decision 131.2: if this list cannot be read (a storage error, bad
      // JSON), auto accept goes on without it. That is accepted on purpose:
      // the read practically never fails, and the other choice, no auto
      // accept for the rest of the session, would cost every rider offers.
      mergedWithStored(DECLINE_FAILED_KEY, declineFailed)
        .then(list => {
          declineFailed = list;
        })
        .catch(() => undefined),
    ]).then(() => undefined);
  }
  return loading;
};

export const isOfferAnswered = (key: string): boolean => answered.includes(key);

// Adds the offer and returns true, or returns false if it was already there
// (the caller then sends nothing).
export const markOfferAnswered = (key: string): boolean => {
  if (answered.includes(key)) {
    return false;
  }
  answered = [...answered, key].slice(-KEEP_AT_MOST);
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(answered)).catch(
    () => undefined,
  );
  return true;
};

// Row 155: an offer the server ended can no longer be answered, so it joins the
// same list. A NEW_DELIVERY_OFFER push for it that arrives after its end (FCM
// does not keep order) is then dropped silently, like an answered one, while a
// new offer of the same delivery has a later `offeredAt` and still rings.
// Without an `offeredAt` (an older server) nothing is kept: the delivery id
// alone would also silence a real new offer.
export const markOfferEnded = async (
  deliveryId: string,
  offeredAt: string | null,
): Promise<void> => {
  if (!offeredAt) {
    return;
  }
  await loadAnsweredOffers();
  markOfferAnswered(offerKeyOf(deliveryId, offeredAt));
};

// A send failed for a reason other than "the offer has ended" (no network):
// let the rider try again.
export const unmarkOfferAnswered = (key: string) => {
  answered = answered.filter(item => item !== key);
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(answered)).catch(
    () => undefined,
  );
};

// Row 131: the rider tapped Decline on the alert and it could not be sent.
// The phone must never accept this offer by itself (value 4: the rider's own
// choice wins); the app shows it for the rider to answer by hand instead.
export const markDeclineFailed = (key: string) => {
  if (declineFailed.includes(key)) {
    return;
  }
  declineFailed = [...declineFailed, key].slice(-KEEP_AT_MOST);
  AsyncStorage.setItem(DECLINE_FAILED_KEY, JSON.stringify(declineFailed)).catch(
    () => undefined,
  );
};

// An entry stays after the rider answers from the app; that is harmless,
// since the server never offers the same key again, and the list keeps 50.
export const isDeclineFailed = (key: string): boolean =>
  declineFailed.includes(key);

// Logging out, or a session the co-op ended: the next rider on this phone
// starts with no such list.
export const clearDeclineFailed = async (): Promise<void> => {
  declineFailed = [];
  await AsyncStorage.removeItem(DECLINE_FAILED_KEY);
};
