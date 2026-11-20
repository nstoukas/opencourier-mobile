import { WorkedJob, WorkedShift } from '@app/types/timeWorked';

// Spec 0042: what the server answers for the Earnings screen. Times are ISO strings, money is whole
// cents in `currencyCode`, durations whole seconds, km unrounded. Every figure is worked out on the
// server; the phone only shows them.

// The four figures for a day or a week (AC-1), with the money and time beside them.
export interface EarningsFigures {
  workSeconds: number;
  jobSeconds: number;
  paidWaitSeconds: number;
  unpaidSeconds: number;
  // Includes unlinkedMoneyCents; every rate leaves it out.
  moneyCents: number;
  unlinkedMoneyCents: number;
  // The part of unlinkedMoneyCents that belongs to no job at all; shown apart (decision 75.31).
  noJobMoneyCents: number;
  centsPerHour: number | null;
  activeCentsPerHour: number | null;
  paidKm: number;
  centsPerPaidKm: number | null;
  medianPickupWaitSeconds: number | null;
  pickupWaitCount: number;
  dropOffCount: number;
}

export interface EarningsDay extends EarningsFigures {
  date: string;
}

export interface EarningsWeek extends EarningsFigures {
  // The Monday, YYYY-MM-DD.
  weekStart: string;
  // The week holds today, so it runs to now.
  soFar: boolean;
  // The week holds the first day the rider can open, so its figures start there.
  cutAtReach: boolean;
}

// How a job ended, when not in this rider's drop off (AC-8). Null means delivered.
export type JobEndLabel =
  | 'CANCELLED_AFTER_PICKUP'
  | 'CANCELLED'
  | 'REMOVED'
  | 'HANDED_BACK'
  | 'REASSIGNED'
  | 'FAILED'
  | 'ENDED'
  | 'IN_PROGRESS';

export interface EarningsJob extends WorkedJob {
  paidKm: number | null;
  dropoffArea: string | null;
  pickupWaitSeconds: number | null;
  cancelledAfterPickup: boolean;
  endLabel: JobEndLabel | null;
}

export interface EarningsShift extends WorkedShift {
  jobs: EarningsJob[];
}

export interface EarningsMonth {
  // YYYY-MM.
  month: string;
  // The month's days the server answered for, cut to the rider's reach and to today.
  from: string;
  to: string;
  // The first day the rider can open (2 months back, AC-9).
  reachFrom: string;
  recordedFrom: string | null;
  currencyCode: string;
  days: EarningsDay[];
  // Every week that overlaps the month, with its own figures.
  weeks: EarningsWeek[];
  // Shifts overlapping the month, each with only the jobs accepted inside it.
  shifts: EarningsShift[];
  jobsInNoShift: EarningsJob[];
}

export type TimelineWho = 'YOU' | 'RESTAURANT' | 'DISPATCH' | 'SYSTEM';

export interface EarningsTimelineLine {
  // A delivery event type, e.g. 'PICKED_UP'.
  type: string;
  at: string;
  who: TimelineWho | null;
  // Another rider took it; never says who.
  anotherRider: boolean;
}

export interface EarningsCompensationLine {
  reason: string;
  amountCents: number;
  waitMinutes: number | null;
  createdAt: string;
  addedLater: boolean;
}

// One delivery as this rider held it (AC-10, AC-11).
export interface EarningsDeliveryDetail {
  deliveryId: string;
  currencyCode: string;
  pickupName: string;
  dropoffArea: string | null;
  paidKm: number;
  jobs: {
    acceptedAt: string;
    endedAt: string | null;
    endLabel: JobEndLabel | null;
    minutes: number;
    pickupWaitSeconds: number | null;
  }[];
  breakdown: {
    // Shown only when the two add up to the delivery pay; otherwise one "Delivery pay" line.
    baseFeeCents: number | null;
    distanceFeeCents: number | null;
    deliveryPayCents: number;
    tipsCents: number;
    compensations: EarningsCompensationLine[];
    totalCents: number;
  };
  timeline: EarningsTimelineLine[];
}
