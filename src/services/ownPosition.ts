import { useSyncExternalStore } from 'react';
import { RoutePoint } from '@app/types/route';

// Spec 0018 (AC-5): the newest position this phone itself read in this run of
// the app. It lives only in memory and is never sent anywhere by this module:
// the map draws the rider from it, and a stale rider leg is hidden against it.
// The `user` cache is not used for this, because each refetch of the user puts
// the server's stored copy back, which can be days old.

let current: RoutePoint | null = null;
const listeners = new Set<() => void>();

export const setOwnPosition = (point: RoutePoint | null) => {
  current = point;
  listeners.forEach(listener => listener());
};

export const getOwnPosition = (): RoutePoint | null => current;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// `useSyncExternalStore` lets a screen read a value kept outside React and
// draw again whenever it changes.
export const useOwnPosition = (): RoutePoint | null =>
  useSyncExternalStore(subscribe, getOwnPosition);
