import { useSyncExternalStore } from 'react';

// Row 156: true while the location watch says the phone's location is switched off (or set so that
// no fix can come), until the next fix arrives. It lives only in memory, on this phone, and is never
// sent anywhere: the server and admins do not learn it (binding value 5). Home reads it for the
// "Location is off" banner; the tracking hook writes it.
let off = false;
const listeners = new Set<() => void>();

export const setLocationOff = (value: boolean) => {
  if (off === value) {
    return;
  }
  off = value;
  listeners.forEach(listener => listener());
};

export const getLocationOff = (): boolean => off;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Draws again whenever it changes.
export const useLocationOff = (): boolean =>
  useSyncExternalStore(subscribe, getLocationOff);

// The location library's error codes that mean no fix can come until the rider changes a phone
// setting: 2, location switched off (POSITION_UNAVAILABLE, which the library raises only when the
// phone's location is disabled), and 5, location on but in a mode that cannot satisfy the watch
// (SETTINGS_NOT_SATISFIED). A timeout (3) is weak signal, not a setting, so it never warns.
export const LOCATION_OFF_ERROR_CODES: readonly number[] = [2, 5];
