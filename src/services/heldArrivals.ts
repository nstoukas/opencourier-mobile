import AsyncStorage from '@react-native-async-storage/async-storage';

// Spec 0021 (AC-12): a pickup arrival detected during the free hand back
// window is held here, not sent, so a rider who accepts while already at the
// restaurant keeps the hand back the co-op set. It is kept in the phone's
// storage, so an app restart during the window does not lose the true arrival
// time (waiting pay, row 23, starts from it). It holds two ids and a time,
// never a position.

const STORAGE_KEY = 'heldArrivals';

export type HeldArrival = {
  courierId: string;
  deliveryId: string;
  // When the rider was first seen at the restaurant (the phone's clock).
  firstFixAt: number;
};

let held: HeldArrival[] = [];
let loading: Promise<void> | null = null;
let writing: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();

// Reads the stored list once; a failed read is tried again on the next use.
const load = (): Promise<void> => {
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        held = raw ? (JSON.parse(raw) as HeldArrival[]) : [];
        listeners.forEach(listener => listener());
      })
      .catch(error => {
        loading = null;
        throw error;
      });
  }
  return loading;
};

// One change at a time, saved before the list in memory moves (as the outbox).
const change = (
  update: (current: HeldArrival[]) => HeldArrival[],
): Promise<void> => {
  const next = writing.then(async () => {
    await load();
    const updated = update(held);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    held = updated;
    listeners.forEach(listener => listener());
  });
  writing = next.catch(() => undefined);
  return next;
};

const same = (a: HeldArrival, courierId: string, deliveryId: string) =>
  a.courierId === courierId && a.deliveryId === deliveryId;

// The held arrivals as they are now. Starts reading storage on first use.
export const getHeldArrivals = (): HeldArrival[] => {
  load().catch(error => console.log('Could not read held arrivals', error));
  return held;
};

export const subscribeHeldArrivals = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// The held arrival of this rider's delivery, once storage is read.
export const findHeldArrival = async (
  courierId: string,
  deliveryId: string,
): Promise<HeldArrival | null> => {
  // Waits for a write still under way, so a hold made in the same instant is seen (review nit).
  await writing;
  await load();
  return held.find(a => same(a, courierId, deliveryId)) ?? null;
};

// Holds the first fix at the restaurant; a later fix never moves it.
export const holdArrival = (arrival: HeldArrival): Promise<void> =>
  change(current =>
    current.some(a => same(a, arrival.courierId, arrival.deliveryId))
      ? current
      : [...current, arrival],
  );

// Drops a delivery's hold: it was sent, the rider handed the job back, or a
// step for it was queued another way.
export const dropHeldArrival = (
  courierId: string,
  deliveryId: string,
): Promise<void> =>
  change(current => current.filter(a => !same(a, courierId, deliveryId)));

// Drops every hold of deliveries this rider no longer holds (cancelled,
// reassigned), and every hold of another rider.
export const keepHeldArrivalsFor = (
  courierId: string,
  deliveryIds: ReadonlySet<string>,
): Promise<void> =>
  change(current =>
    current.filter(
      a => a.courierId === courierId && deliveryIds.has(a.deliveryId),
    ),
  );

// At logout: nothing held survives to the next rider on this phone.
export const clearHeldArrivals = (): Promise<void> => change(() => []);

// For tests only: forget everything held in memory.
export const resetHeldArrivalsForTests = (): void => {
  held = [];
  loading = null;
  writing = Promise.resolve();
  listeners.clear();
};
