import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

// Spec 0038 (AC-9): which answered review requests the rider has opened is kept on this phone only.
// The server never records whether or when a rider read an answer.
export const REVIEW_SEEN_KEY = 'review_answers_seen';
// Enough for years of requests; the oldest marks drop off first.
const MAX_MARKS = 200;

let cached: string[] | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export async function loadReviewSeen(): Promise<string[]> {
  if (cached !== undefined) {
    return cached;
  }
  try {
    const raw = await AsyncStorage.getItem(REVIEW_SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    cached = [];
  }
  notify();
  return cached;
}

// Marks these answered requests as opened. Only ids not already marked are added.
export async function markReviewsSeen(ids: string[]): Promise<void> {
  const seen = await loadReviewSeen();
  const fresh = ids.filter(id => !seen.includes(id));
  if (fresh.length === 0) {
    return;
  }
  cached = [...seen, ...fresh].slice(-MAX_MARKS);
  notify();
  await AsyncStorage.setItem(REVIEW_SEEN_KEY, JSON.stringify(cached));
}

export async function clearReviewSeen(): Promise<void> {
  cached = [];
  notify();
  await AsyncStorage.removeItem(REVIEW_SEEN_KEY);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// The opened answers, for a screen. Empty until the phone's list has loaded.
export function useReviewSeen(): string[] {
  useEffect(() => {
    loadReviewSeen().catch(() => undefined);
  }, []);
  return useSyncExternalStore(subscribe, () => cached ?? EMPTY);
}

const EMPTY: string[] = [];
