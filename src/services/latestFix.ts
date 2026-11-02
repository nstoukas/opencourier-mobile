import { useSyncExternalStore } from 'react';

// Spec 0021 (AC-1, AC-13): the newest position fix this phone read in this run
// of the app, with how accurate the phone said it was and when it was handled.
// It lives only in memory and is never sent anywhere by this module: the
// arrival check reads it, on each new fix and again when a job's stage or the
// hand back window changes (a rider standing still gets no new fix).
export type Fix = {
  latitude: number;
  longitude: number;
  // The phone's own estimate, in metres; null when it gave none.
  accuracyMetres: number | null;
  // `Date.now()` when the fix was handled, never the GPS timestamp: tap times
  // are measured on the phone's clock (spec 0009), and GPS time can differ.
  at: number;
};

let current: Fix | null = null;
const listeners = new Set<() => void>();

export const setLatestFix = (fix: Fix | null) => {
  current = fix;
  listeners.forEach(listener => listener());
};

export const getLatestFix = (): Fix | null => current;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Draws again whenever a new fix arrives.
export const useLatestFix = (): Fix | null =>
  useSyncExternalStore(subscribe, getLatestFix);
