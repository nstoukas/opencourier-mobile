import {
  SosRecord,
  clearSos,
  dropSentSosPoints,
  dropSosDelivery,
  loadSosRecords,
  markSosStarted,
} from './sosStore';
import { SOS_NOT_ACTIVE_CODE, SosAnswer, SosService } from './sosService';

// Spec 0022. Sends what this rider's SOS still owes the server, in the only
// order that keeps the record whole: the start first (so the incident exists),
// then the positions taken while it was active, oldest first, then the
// rider's "I'm safe" or "False alarm" (AC-5, AC-6).

// The most positions in one request (the server refuses more).
export const SOS_POINTS_PER_REQUEST = 120;

// The oldest age the server takes for a tap or a position: 7 days. An older
// one is sent as 7 days rather than refused, so a start kept a week without
// signal still reaches the co-op instead of being tried forever (row 73
// review). The server puts no point before the SOS's start anyway.
export const SOS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// How long ago `then` was by the phone's clock, within what the server takes.
const ageOf = (now: number, then: number): number =>
  Math.min(SOS_MAX_AGE_MS, Math.max(0, now - then));

// What one send round ended with:
// - 'idle': nothing to send, or everything went;
// - 'noSignal': a request got no answer; what waits is sent next round;
// - 'retry': the server could not take it now (a server error, too many
//   requests, a login being renewed); sent next round;
// - 'ended': the rider's end reached the server, the SOS is cleared;
// - 'endedByCoop': the server says the SOS is no longer active and the rider
//   did not end it: an admin closed it. Its waiting positions are dropped.
export type SosSendOutcome =
  | 'idle'
  | 'noSignal'
  | 'retry'
  | 'ended'
  | 'endedByCoop';

// A status the phone should try again later.
const isTryAgain = (answer: SosAnswer<unknown>): boolean =>
  answer.kind === 'error' &&
  (answer.httpStatus === 401 ||
    answer.httpStatus === 408 ||
    answer.httpStatus === 429 ||
    answer.httpStatus >= 500);

const waitOutcome = (answer: SosAnswer<unknown>): SosSendOutcome =>
  answer.kind === 'none' ? 'noSignal' : 'retry';

let sending: Promise<SosSendOutcome> | null = null;

// How the last round ended, for the SOS screen's line ("No signal: your
// position is saved and will be sent"). Memory only.
let lastOutcome: SosSendOutcome = 'idle';
const outcomeListeners = new Set<() => void>();

export const getLastSosOutcome = (): SosSendOutcome => lastOutcome;

// The shape React's useSyncExternalStore expects.
export const subscribeSosOutcome = (listener: () => void): (() => void) => {
  outcomeListeners.add(listener);
  return () => {
    outcomeListeners.delete(listener);
  };
};

const setLastOutcome = (outcome: SosSendOutcome) => {
  if (outcome !== lastOutcome) {
    lastOutcome = outcome;
    outcomeListeners.forEach(listener => listener());
  }
};

// One round for this rider. A call while a round runs joins it.
// `currentCourierId` is asked before each request: if another rider (or
// nobody) is logged in by then, the round stops, so nothing goes out with
// someone else's login. `now` is the phone's clock (only differences of it
// are sent).
export const sendSos = (
  courierId: string,
  api: SosService,
  currentCourierId: () => string | undefined,
  now: () => number = Date.now,
): Promise<SosSendOutcome> => {
  if (!sending) {
    sending = round(courierId, api, currentCourierId, now)
      .then(outcome => {
        setLastOutcome(outcome);
        return outcome;
      })
      .finally(() => {
        sending = null;
      });
  }
  return sending;
};

// Every SOS kept for this rider, oldest first. One that is ended goes all the
// way (start, positions, end) before the next one's start, so the server
// never takes a new start while the last one is still active (it would answer
// with that one). A round that must wait stops there; the outcome is the
// newest SOS's.
const round = async (
  courierId: string,
  api: SosService,
  currentCourierId: () => string | undefined,
  now: () => number,
): Promise<SosSendOutcome> => {
  const loggedIn = () => currentCourierId() === courierId;
  const clientIds = (await loadSosRecords(courierId)).map(
    record => record.clientId,
  );
  let outcome: SosSendOutcome = 'idle';
  for (const clientId of clientIds) {
    if (!loggedIn()) {
      return 'idle';
    }
    outcome = await sendOne(courierId, clientId, api, loggedIn, now);
    if (outcome === 'noSignal' || outcome === 'retry') {
      return outcome;
    }
  }
  return outcome;
};

// The start, positions and end of the one SOS with this clientId.
const sendOne = async (
  courierId: string,
  clientId: string,
  api: SosService,
  loggedIn: () => boolean,
  now: () => number,
): Promise<SosSendOutcome> => {
  const find = async (): Promise<SosRecord | undefined> =>
    (await loadSosRecords(courierId)).find(
      record => record.clientId === clientId,
    );

  // ---- The start ----
  for (;;) {
    const record = await find();
    if (!record || !loggedIn()) {
      return 'idle';
    }
    if (record.incidentId) {
      break;
    }
    const answer = await api.start({
      clientId: record.clientId,
      tapAgeMs: ageOf(now(), record.heldAt),
      ...(record.deliveryId ? { deliveryId: record.deliveryId } : {}),
    });
    if (answer.kind === 'ok') {
      const incident = answer.result;
      // A retried start whose SOS an admin has since closed: nothing is
      // shared for it any more, unless the rider's own end still waits.
      if (incident.state !== 'ACTIVE' && !record.end) {
        await clearSos(courierId, clientId);
        return 'endedByCoop';
      }
      await markSosStarted(courierId, clientId, incident.id);
      break;
    }
    if (answer.kind === 'error' && !isTryAgain(answer) && record.deliveryId) {
      // The job is no longer the rider's (404) or the server will not take
      // it: the SOS itself must still go, so send it again without the job.
      await dropSosDelivery(courierId, clientId);
      continue;
    }
    // Never dropped: an SOS start waits until the server has it.
    return waitOutcome(answer);
  }

  // ---- The positions ----
  for (;;) {
    const record = await find();
    if (!record?.incidentId || !loggedIn()) {
      return 'idle';
    }
    if (record.points.length === 0) {
      break;
    }
    const batch = record.points.slice(0, SOS_POINTS_PER_REQUEST);
    const sentAt = now();
    const answer = await api.sendPoints(
      record.incidentId,
      batch.map(point => ({
        latitude: point.latitude,
        longitude: point.longitude,
        ...(point.accuracyMetres !== undefined
          ? { accuracyMetres: point.accuracyMetres }
          : {}),
        ageMs: ageOf(sentAt, point.takenAt),
      })),
    );
    if (answer.kind === 'ok') {
      await dropSentSosPoints(courierId, clientId, batch);
      continue;
    }
    if (answer.kind === 'none' || isTryAgain(answer)) {
      return waitOutcome(answer);
    }
    const notActive =
      (answer.httpStatus === 409 && answer.code === SOS_NOT_ACTIVE_CODE) ||
      answer.httpStatus === 404;
    if (notActive && !record.end) {
      // Ended by the co-op (or gone): stop, drop what waits (AC-6).
      await clearSos(courierId, clientId);
      return 'endedByCoop';
    }
    if (notActive) {
      // The rider's own end already landed: these can no longer be stored.
      await dropSentSosPoints(courierId, clientId, record.points);
      break;
    }
    // A 400: the server refused this batch as a whole; it is dropped, never
    // sent again (spec 0022, API table).
    await dropSentSosPoints(courierId, clientId, batch);
  }

  // ---- The rider's end ----
  const record = await find();
  if (!record?.incidentId || !record.end || !loggedIn()) {
    return 'idle';
  }
  const answer = await api.end(
    record.incidentId,
    record.end.kind,
    ageOf(now(), record.end.tappedAt),
  );
  if (answer.kind === 'none' || isTryAgain(answer)) {
    return waitOutcome(answer);
  }
  // Taken (or a repeat), already closed by an admin (409), or gone (404):
  // either way nothing is left to send.
  await clearSos(courierId, clientId);
  return 'ended';
};

// For tests only.
export const resetSosSenderForTests = (): void => {
  sending = null;
  lastOutcome = 'idle';
  outcomeListeners.clear();
};
