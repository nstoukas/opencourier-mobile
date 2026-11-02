import AsyncStorage from '@react-native-async-storage/async-storage';

// The SOS kept on the phone (spec 0022, AC-5). Everything an SOS still has to
// tell the server is written here first and sent from here, so an app kill, a
// reboot or no signal loses nothing: the start (until the server has it), the
// positions taken while it is active, and the rider's "I'm safe" or "False
// alarm". Keyed by the rider, so another rider logging in on the same phone
// never sends, sees or resumes someone else's SOS.

const STORAGE_KEY = 'sosByRider';

// The most positions kept waiting: half an hour at one every 5 s. Beyond
// that the oldest are dropped, so a phone with no signal for hours cannot
// fill its storage.
export const SOS_MAX_WAITING_POINTS = 360;

export type SosPoint = {
  latitude: number;
  longitude: number;
  // The phone's own estimate of how far off the fix may be, in metres.
  accuracyMetres?: number;
  // The phone's clock when the fix was taken. Only differences of it are sent
  // (ageMs), so a phone set to the wrong day cannot move a point in time.
  takenAt: number;
};

export type SosEnd = {
  kind: 'safe' | 'falseAlarm';
  // The phone's clock at the tap, sent as tapAgeMs.
  tappedAt: number;
};

export type SosRecord = {
  // The phone's own id for this SOS, made at the hold. A retried start with
  // the same id never makes a second incident on the server.
  clientId: string;
  // The phone's clock when the 3 s hold completed, sent as tapAgeMs.
  heldAt: number;
  // The job the rider held at the hold, if any.
  deliveryId?: string;
  // Set once the server has the SOS: "The co-op has been alerted".
  incidentId?: string;
  // Positions waiting to be sent, oldest first.
  points: SosPoint[];
  // Set by "I'm safe" or "False alarm": the sharing stops at once, and this
  // is sent after the start, so the record always exists first (AC-6).
  end?: SosEnd;
};

// ---- The store: in memory and in AsyncStorage ----

let records: Record<string, SosRecord> = {};
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
// Each change waits for the one before it, so two quick changes never write
// over each other in storage.
let writing: Promise<unknown> = Promise.resolve();

// Reads storage once. A failed read is never taken as "no SOS" (the next save
// would wipe a waiting start): it is tried again on the next use.
const load = (): Promise<void> => {
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        records = raw ? (JSON.parse(raw) as Record<string, SosRecord>) : {};
        listeners.forEach(listener => listener());
      })
      .catch(error => {
        loading = null;
        throw error;
      });
  }
  return loading;
};

// Applies one change to one rider's record (undefined removes it), saves,
// then tells the screens. Memory changes only once the save has worked.
const change = (
  courierId: string,
  update: (current: SosRecord | undefined) => SosRecord | undefined,
): Promise<void> => {
  const next = writing.then(async () => {
    await load();
    const updated = update(records[courierId]);
    // A new object each time, so React sees the change.
    const all = { ...records };
    if (updated) {
      all[courierId] = updated;
    } else {
      delete all[courierId];
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    records = all;
    listeners.forEach(listener => listener());
  });
  // A failed save must not block every later change.
  writing = next.catch(() => undefined);
  return next;
};

// This rider's SOS as it is now, if any. Starts reading storage on first use.
export const getSosRecord = (
  courierId: string | undefined,
): SosRecord | undefined => {
  load().catch(error => console.log('Could not read the SOS store', error));
  return courierId ? records[courierId] : undefined;
};

// This rider's SOS once storage has been read (right after the app starts,
// memory alone could still say none).
export const loadSosRecord = async (
  courierId: string,
): Promise<SosRecord | undefined> => {
  await load();
  return records[courierId];
};

// Calls `listener` after every change; returns the function that stops it.
// (The shape React's useSyncExternalStore expects.)
export const subscribeSos = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// True while the phone shares this SOS: it exists and the rider has not
// ended it. Only then are positions taken for it (AC-5, AC-13).
export const isSharing = (record: SosRecord | undefined): boolean =>
  !!record && !record.end;

// ---- Changes ----

// The 3 s hold. Keeps an SOS already here (a second hold changes nothing).
export const startSos = (
  courierId: string,
  start: { clientId: string; heldAt: number; deliveryId?: string },
): Promise<void> =>
  change(courierId, current => current ?? { ...start, points: [] });

// An SOS the server says is active, found after a restart or a new login
// (AC-12). Keeps what is here if it is the same incident or not yet sent.
export const resumeSos = (
  courierId: string,
  incident: { id: string; startedAt: number },
  clientId: string,
): Promise<void> =>
  change(courierId, current =>
    current && (!current.incidentId || current.incidentId === incident.id)
      ? { ...current, incidentId: incident.id }
      : {
          clientId,
          heldAt: incident.startedAt,
          incidentId: incident.id,
          points: [],
        },
  );

// The server has the SOS.
export const markSosStarted = (
  courierId: string,
  clientId: string,
  incidentId: string,
): Promise<void> =>
  change(courierId, current =>
    current && current.clientId === clientId
      ? { ...current, incidentId }
      : current,
  );

// The start's job turned out not to be the rider's any more (the server
// answered 404): send the start again without it.
export const dropSosDelivery = (courierId: string): Promise<void> =>
  change(courierId, current =>
    current ? { ...current, deliveryId: undefined } : current,
  );

// One position for an SOS still shared. Dropped once the rider ended it.
export const addSosPoint = (
  courierId: string,
  point: SosPoint,
): Promise<void> =>
  change(courierId, current => {
    if (!isSharing(current) || !current) {
      return current;
    }
    const points = [...current.points, point];
    return {
      ...current,
      points: points.slice(Math.max(0, points.length - SOS_MAX_WAITING_POINTS)),
    };
  });

// The first `count` waiting positions reached the server (or were refused
// as a batch): they are not sent again.
export const dropSentSosPoints = (
  courierId: string,
  count: number,
): Promise<void> =>
  change(courierId, current =>
    current ? { ...current, points: current.points.slice(count) } : current,
  );

// "I'm safe" or "False alarm": the sharing stops at once (AC-6). A second
// tap keeps the first answer.
export const endSos = (courierId: string, end: SosEnd): Promise<void> =>
  change(courierId, current =>
    current && !current.end ? { ...current, end } : current,
  );

// Nothing more to send: the server has the end, an admin closed it, or the
// incident is gone. The SOS screen closes.
export const clearSos = (courierId: string): Promise<void> =>
  change(courierId, () => undefined);

// Logging out during an SOS (AC-12): the sharing stops, but a start the server
// has not had yet is kept, so the record still reaches the co-op the next time
// this rider logs in. An SOS the server already has stays active for an admin.
export const stopSosForLogout = (courierId: string): Promise<void> =>
  change(courierId, current =>
    current && !current.incidentId ? { ...current, points: [] } : undefined,
  );

// For tests only: forget everything held in memory.
export const resetSosStoreForTests = (): void => {
  records = {};
  loading = null;
  writing = Promise.resolve();
  listeners.clear();
};
