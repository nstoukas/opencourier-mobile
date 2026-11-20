// Spec 0040: what the server answers about the rider's time worked. Times are ISO strings, money is
// whole cents in `currencyCode`, durations are whole seconds.

export type CourierStatusValue = 'ONLINE' | 'OFFLINE' | 'LAST_CALL';

export type StatusChangeCause =
  | 'RIDER'
  | 'ADMIN'
  | 'CUT_OFF'
  | 'LAST_CALL_ACCEPTED'
  | 'SYSTEM_START';

// The home counter's snapshot (AC-10).
export interface CurrentShift {
  startedAt: string;
  // Set while the rider is Offline with no job, until the break reaches the limit.
  onBreakSince: string | null;
  workSeconds: number;
  jobSeconds: number;
  paidWaitSeconds: number;
  unpaidSeconds: number;
  moneyCents: number;
  centsPerHour: number | null;
  currencyCode: string;
}

export interface CurrentTimeWorked {
  asOf: string;
  shiftBreakMinutes: number;
  shift: CurrentShift | null;
}

export interface WorkedStatusChange {
  at: string;
  fromStatus: CourierStatusValue;
  toStatus: CourierStatusValue;
  cause: StatusChangeCause;
  byAdmin: boolean;
}

export interface WorkedCompensation {
  id: string;
  reason: string;
  amountCents: number;
  createdAt: string;
  addedLater: boolean;
}

export interface WorkedJob {
  deliveryId: string;
  pickupName: string;
  acceptedAt: string;
  endedAt: string | null;
  endEventType: string | null;
  droppedOff: boolean;
  deliveryMoneyCents: number;
  paidWaitSeconds: number;
  compensations: WorkedCompensation[];
}

export interface WorkedShift {
  startedAt: string;
  startedBeforeRange: boolean;
  endedAt: string | null;
  onBreakSince: string | null;
  workSeconds: number;
  jobSeconds: number;
  paidWaitSeconds: number;
  unpaidSeconds: number;
  breaks: { startedAt: string; endedAt: string }[];
  moneyCents: number;
  lateMoneyCents: number;
  centsPerHour: number | null;
  currencyCode: string;
  statusChanges: WorkedStatusChange[];
  jobs: WorkedJob[];
}

// A week with fewer than 3 riders carries no figure at all (AC-12).
export type CoopWeek =
  | { weekStart: string; tooFewRiders: true }
  | {
      weekStart: string;
      tooFewRiders: false;
      workSeconds: number;
      unpaidShare: number | null;
      centsPerHour: number | null;
    };

export interface CoopTotals {
  thisWeek: CoopWeek;
  lastWeek: CoopWeek;
}
