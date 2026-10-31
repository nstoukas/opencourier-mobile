import AsyncStorage from '@react-native-async-storage/async-storage';
import { JobStep, hasReachedStep } from '@app/utilities/jobSteps';

// The outbox for job steps (spec 0009). Every step a rider taps (arrived at
// pickup, picked up, arrived at drop off, delivered) is written here first and
// sent from here, with or without signal, so a tap is accepted at once and
// survives the app being closed. Steps are sent oldest first, one at a time.

const STORAGE_KEY = 'jobStepOutbox';

export type OutboxItem = {
  id: string;
  // The rider who tapped it (`user.id`, the Courier id). Only that rider's
  // login ever sends it (AC-8).
  courierId: string;
  deliveryId: string;
  step: JobStep;
  // The phone's clock at the tap. Only differences of it are sent (tapAgeMs),
  // so a phone set to the wrong day cannot move pay.
  tappedAt: number;
  // 'waiting' until the server accepts it (then it is removed); 'refused' when
  // the server said no, kept so Home can show the rider a card until closed.
  state: 'waiting' | 'refused';
  // A note the rider wrote with the step (the delivered screen's note).
  note?: string;
  // The restaurant, copied at the tap, to name the delivery on a refusal card.
  restaurantName: string;
};

export type NewOutboxItem = Omit<OutboxItem, 'id' | 'state'>;

// What came back from one attempt to send a step.
export type StepAnswer =
  // The server answered with the delivery: its status after the step.
  | { kind: 'delivery'; status: string }
  // The server answered with an error status (and its error code, if any).
  | { kind: 'error'; httpStatus: number; code?: string }
  // No answer at all: no signal, a timeout.
  | { kind: 'none' };

export type StepOutcome = 'sent' | 'refused' | 'retry';

// The answer to one step, as spec 0009's AC-6 sorts it.
export const classifyAnswer = (
  step: JobStep,
  answer: StepAnswer,
): StepOutcome => {
  if (answer.kind === 'none') {
    return 'retry';
  }
  if (answer.kind === 'delivery') {
    // At the step or past it: it took effect (perhaps a repeat after a lost
    // answer). Anything else, such as CANCELED, means the server dropped it.
    return hasReachedStep(answer.status, step) ? 'sent' : 'refused';
  }
  const { httpStatus, code } = answer;
  // Already dispatched (Mark as dispatched answers 409 for any status but
  // ACCEPTED). If the delivery was cancelled instead, the next step says so.
  if (
    step === 'dispatched' &&
    httpStatus === 409 &&
    code === 'CANT_UPDATE_DELIVERY_STATUS'
  ) {
    return 'sent';
  }
  // Try again later: a session the renewal could not fix (the rider logs in
  // again), "too slow", "too many", or a server error.
  if (
    httpStatus === 401 ||
    httpStatus === 408 ||
    httpStatus === 429 ||
    httpStatus >= 500
  ) {
    return 'retry';
  }
  // Any other answer is a no: 403 or 404 mean the delivery is no longer
  // this rider's, 400 a step the server will never take.
  return httpStatus >= 400 ? 'refused' : 'retry';
};

// ---- The store: the items, in memory and in AsyncStorage ----

let items: OutboxItem[] = [];
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
// Each change waits for the one before it, so two quick taps never write over
// each other in storage.
let writing: Promise<unknown> = Promise.resolve();
let counter = 0;

const load = (): Promise<void> => {
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        items = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
      })
      .catch(error => {
        console.log('Could not read the job step outbox', error);
        items = [];
      })
      .then(() => listeners.forEach(listener => listener()));
  }
  return loading;
};

// Applies one change to the list, saves it, then tells the screens.
const change = (
  update: (current: OutboxItem[]) => OutboxItem[],
): Promise<void> => {
  const next = writing.then(async () => {
    await load();
    // A new array each time, so React sees the change.
    items = update(items);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    listeners.forEach(listener => listener());
  });
  // A failed save must not block every later change.
  writing = next.catch(() => undefined);
  return next;
};

// The items as they are now. Starts reading storage on first use.
export const getOutboxItems = (): OutboxItem[] => {
  load();
  return items;
};

// Calls `listener` after every change; returns the function that stops it.
// (The shape React's useSyncExternalStore expects.)
export const subscribeOutbox = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Adds steps, in the order given, as waiting.
export const addJobSteps = (newItems: NewOutboxItem[]): Promise<void> =>
  change(current => [
    ...current,
    ...newItems.map(item => ({
      ...item,
      id: `${item.tappedAt}-${counter++}`,
      state: 'waiting' as const,
    })),
  ]);

// Removes the refused items of a delivery (the rider closed its card).
export const dismissRefused = (deliveryId: string): Promise<void> =>
  change(current =>
    current.filter(
      item => !(item.deliveryId === deliveryId && item.state === 'refused'),
    ),
  );

// How many steps of this rider wait to be sent.
export const waitingCount = (courierId: string): number =>
  items.filter(item => item.courierId === courierId && item.state === 'waiting')
    .length;

// ---- Sending ----

let flushing: Promise<void> | null = null;

// Sends this rider's waiting steps, oldest first, one at a time, until none
// wait or one gets no answer (then the rest wait for the next try).
// `send` posts one step and reports the answer; `onSettled` hears each step
// that left the waiting state. A call while a flush runs joins that flush.
export const flushOutbox = (
  courierId: string,
  send: (item: OutboxItem, tapAgeMs: number) => Promise<StepAnswer>,
  onSettled?: (item: OutboxItem, outcome: 'sent' | 'refused') => void,
): Promise<void> => {
  if (!flushing) {
    flushing = (async () => {
      await load();
      for (;;) {
        const item = items.find(
          candidate =>
            candidate.courierId === courierId && candidate.state === 'waiting',
        );
        if (!item) {
          return;
        }
        // How long ago the rider tapped, measured now; never below 0 (the
        // phone's clock may have been moved back meanwhile).
        const tapAgeMs = Math.max(0, Date.now() - item.tappedAt);
        const outcome = classifyAnswer(item.step, await send(item, tapAgeMs));
        if (outcome === 'retry') {
          return;
        }
        if (outcome === 'sent') {
          await change(current => current.filter(i => i.id !== item.id));
        } else {
          // This step and every later step of the same delivery are refused:
          // none of them is sent (AC-6).
          await change(current => {
            const at = current.findIndex(i => i.id === item.id);
            return current.map((i, index) =>
              index >= at &&
              i.deliveryId === item.deliveryId &&
              i.courierId === item.courierId
                ? { ...i, state: 'refused' as const }
                : i,
            );
          });
        }
        onSettled?.(item, outcome);
      }
    })().finally(() => {
      flushing = null;
    });
  }
  return flushing;
};

// For tests only: forget everything held in memory.
export const resetOutboxForTests = (): void => {
  items = [];
  loading = null;
  flushing = null;
  writing = Promise.resolve();
  counter = 0;
  listeners.clear();
};
