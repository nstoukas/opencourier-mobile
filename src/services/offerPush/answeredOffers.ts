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
// Kept on the phone only, with no time attached, and never sent anywhere
// (value 5): it says nothing about how fast anyone answered.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'answered_offer_ids';
// Enough to cover every offer a rider could still see; older ones drop off.
const KEEP_AT_MOST = 50;

export const offerKeyOf = (deliveryId: string, offeredAt?: string | null) =>
  `${deliveryId}@${offeredAt ?? ''}`;

// The list in memory, so the app's tap check stays synchronous. Loaded from
// storage once; `answerOffer` waits for the load before it checks.
let answered: string[] = [];
let loading: Promise<void> | null = null;

export const loadAnsweredOffers = (): Promise<void> => {
  if (loading === null) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        const fromStorage: unknown = stored ? JSON.parse(stored) : [];
        if (Array.isArray(fromStorage)) {
          // Keep anything added in memory before the load finished.
          const merged = [...fromStorage.map(String), ...answered];
          answered = merged.filter((key, i) => merged.indexOf(key) === i);
        }
      })
      .catch(() => undefined);
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

// A send failed for a reason other than "the offer has ended" (no network):
// let the rider try again.
export const unmarkOfferAnswered = (key: string) => {
  answered = answered.filter(item => item !== key);
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(answered)).catch(
    () => undefined,
  );
};
