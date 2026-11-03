import AsyncStorage from '@react-native-async-storage/async-storage';

// The SOS kept on the phone (spec 0022, AC-5). Everything an SOS still has to
// tell the server is written here first and sent from here, so an app kill, a
// reboot or no signal loses nothing: the start (until the server has it), the
// positions taken while it is active, and the rider's "I'm safe" or "False
// alarm". Keyed by the rider, so another rider logging in on the same phone
// never sends, sees or resumes someone else's SOS.
//
// A rider can have more than one SOS here, oldest first (row 73 review): one
// they ended whose "I'm safe" still waits for signal, and a new one they held
// after it. At most the newest is still shared; every one before it is ended
// and only waits to be sent. The sender sends them in that order, so the
// server always has the earlier SOS ended before the next one starts.

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

// Each rider's SOS records, oldest first.
let records: Record<string, SosRecord[]> = {};
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
        const stored = raw
          ? (JSON.parse(raw) as Record<string, SosRecord | SosRecord[]>)
          : {};
        // Before the review fix each rider had one record, not a list.
        records = Object.fromEntries(
          Object.entries(stored).map(([id, kept]) => [
            id,
            Array.isArray(kept) ? kept : [kept],
          ]),
        );
        listeners.forEach(listener => listener());
      })
      .catch(error => {
        loading = null;
        throw error;
      });
  }
  return loading;
};

// Applies one change to one rider's records (an empty list removes them),
// saves, then tells the screens. Memory changes only once the save has worked.
const change = (
  courierId: string,
  update: (current: SosRecord[]) => SosRecord[],
): Promise<void> => {
  const next = writing.then(async () => {
    await load();
    const updated = update(records[courierId] ?? []);
    // A new object each time, so React sees the change.
    const all = { ...records };
    if (updated.length > 0) {
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

// The newest of a list (the one a screen shows), if any.
const newest = (list: SosRecord[] | undefined): SosRecord | undefined =>
  list && list.length > 0 ? list[list.length - 1] : undefined;

// Changes the one record with this clientId; the others stay as they are.
const changeOne = (
  courierId: string,
  clientId: string,
  update: (record: SosRecord) => SosRecord | undefined,
): Promise<void> =>
  change(courierId, current =>
    current.flatMap(record => {
      if (record.clientId !== clientId) {
        return [record];
      }
      const updated = update(record);
      return updated ? [updated] : [];
    }),
  );

// This rider's newest SOS as it is now, if any. Starts reading storage on
// first use.
export const getSosRecord = (
  courierId: string | undefined,
): SosRecord | undefined => {
  load().catch(error => console.log('Could not read the SOS store', error));
  return courierId ? newest(records[courierId]) : undefined;
};

// This rider's newest SOS once storage has been read (right after the app
// starts, memory alone could still say none).
export const loadSosRecord = async (
  courierId: string,
): Promise<SosRecord | undefined> => {
  await load();
  return newest(records[courierId]);
};

// Every SOS this rider still has on the phone, oldest first (the sender's
// order).
export const loadSosRecords = async (
  courierId: string,
): Promise<SosRecord[]> => {
  await load();
  return records[courierId] ?? [];
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

// The 3 s hold. Keeps an SOS still shared (a second hold changes nothing),
// but a hold after "I'm safe" or "False alarm" is a new SOS even while the
// end of the last one still waits for signal (AC-4, row 73 review): it goes
// after it in the list.
export const startSos = (
  courierId: string,
  start: { clientId: string; heldAt: number; deliveryId?: string },
): Promise<void> =>
  change(courierId, current =>
    isSharing(newest(current))
      ? current
      : [...current, { ...start, points: [] }],
  );

// An SOS the server says is active, found after a restart or a new login
// (AC-12). Nothing changes if a record here already is that incident; the
// newest record, if its start was never answered, takes the incident's id
// (the start reached the server but its answer was lost); otherwise the
// incident is added as a new record.
export const resumeSos = (
  courierId: string,
  incident: { id: string; startedAt: number },
  clientId: string,
): Promise<void> =>
  change(courierId, current => {
    if (current.some(record => record.incidentId === incident.id)) {
      return current;
    }
    const last = newest(current);
    if (last && !last.incidentId) {
      return [...current.slice(0, -1), { ...last, incidentId: incident.id }];
    }
    return [
      ...current,
      {
        clientId,
        heldAt: incident.startedAt,
        incidentId: incident.id,
        points: [],
      },
    ];
  });

// The server has the SOS with this clientId.
export const markSosStarted = (
  courierId: string,
  clientId: string,
  incidentId: string,
): Promise<void> =>
  changeOne(courierId, clientId, record => ({ ...record, incidentId }));

// The start's job turned out not to be the rider's any more (the server
// answered 404): send the start again without it.
export const dropSosDelivery = (
  courierId: string,
  clientId: string,
): Promise<void> =>
  changeOne(courierId, clientId, record => ({
    ...record,
    deliveryId: undefined,
  }));

// One position for the SOS still shared (the newest). Dropped once the
// rider ended it.
export const addSosPoint = (
  courierId: string,
  point: SosPoint,
): Promise<void> =>
  change(courierId, current => {
    const last = newest(current);
    if (!last || !isSharing(last)) {
      return current;
    }
    const points = [...last.points, point];
    return [
      ...current.slice(0, -1),
      {
        ...last,
        points: points.slice(
          Math.max(0, points.length - SOS_MAX_WAITING_POINTS),
        ),
      },
    ];
  });

// These waiting positions reached the server (or were refused as a batch):
// they are not sent again. Matched by when each was taken, not by how many,
// so a point dropped from the head of a full buffer while the batch was on
// its way never costs an unsent one (row 73 review).
export const dropSentSosPoints = (
  courierId: string,
  clientId: string,
  sent: SosPoint[],
): Promise<void> => {
  const sentTimes = new Set(sent.map(point => point.takenAt));
  return changeOne(courierId, clientId, record => ({
    ...record,
    points: record.points.filter(point => !sentTimes.has(point.takenAt)),
  }));
};

// "I'm safe" or "False alarm" on the SOS still shared: the sharing stops at
// once (AC-6). A second tap keeps the first answer.
export const endSos = (courierId: string, end: SosEnd): Promise<void> =>
  change(courierId, current => {
    const last = newest(current);
    return last && !last.end
      ? [...current.slice(0, -1), { ...last, end }]
      : current;
  });

// Nothing more to send for the SOS with this clientId: the server has the
// end, an admin closed it, or the incident is gone. If it was the newest, the
// SOS screen closes.
export const clearSos = (courierId: string, clientId: string): Promise<void> =>
  change(courierId, current =>
    current.filter(record => record.clientId !== clientId),
  );

// Logging out during an SOS (AC-12): the sharing stops, and its waiting
// positions go. A start the server has not had yet, or a rider's "I'm safe"
// or "False alarm" not yet sent, is kept, so the record still reaches the
// co-op the next time this rider logs in (row 73 review). An SOS the server
// already has and the rider did not end stays active for an admin.
export const stopSosForLogout = (courierId: string): Promise<void> =>
  change(courierId, current =>
    current
      .filter(record => !record.incidentId || record.end)
      .map(record => ({ ...record, points: [] })),
  );

// For tests only: forget everything held in memory.
export const resetSosStoreForTests = (): void => {
  records = {};
  loading = null;
  writing = Promise.resolve();
  listeners.clear();
};
