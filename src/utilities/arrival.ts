import { OrderStatus } from '@app/types/enums';
import { JobStep } from './jobSteps';
import { metresBetween } from './routeLegs';
import type { Fix } from '@app/services/latestFix';

// Arrival detection (spec 0021). Plain functions with no React, so each rule
// can be tested on its own. The rider's position never leaves the phone here:
// only the ordinary arrived step is sent, marked `detected` (value 5).

// The stop a job is heading to, by the status the screen shows.
export type ArrivalStage = 'pickup' | 'dropoff';

// Typed as plain strings so `includes(status)` accepts any status text.
const TO_PICKUP: string[] = [OrderStatus.accepted, OrderStatus.dispatched];
const TO_DROPOFF: string[] = [OrderStatus.picked_up, OrderStatus.on_the_way];

// Which arrival the job still waits for, or null when it waits for none (it is
// at a stop already, or past the last one).
export const arrivalStageOf = (status: string): ArrivalStage | null => {
  if (TO_PICKUP.includes(status)) {
    return 'pickup';
  }
  if (TO_DROPOFF.includes(status)) {
    return 'dropoff';
  }
  return null;
};

// The outbox step that records each arrival.
export const ARRIVAL_STEP: Record<ArrivalStage, JobStep> = {
  pickup: 'arrived_at_pickup',
  dropoff: 'arrived_at_dropoff',
};

// A fix older than this is not used when a stage or the window changes with
// no new fix (the Job watch only reports after 30 m of movement).
export const MAX_FIX_AGE_MS = 60_000;

// Town GPS is often only good to 10 to 30 m, so a small radius still accepts a
// fix the phone rates at up to 30 m (spec 0021, AC-1).
export const ACCURACY_FLOOR_METRES = 30;

// The server takes a hand back for this long after the window's end (its offer
// grace, OFFER_EXPIRY_GRACE_SECONDS): a held arrival waits for it too (AC-12).
export const HAND_BACK_GRACE_MS = 3_000;

// True when this fix puts the rider at the stop: within `radiusMetres` of it,
// with an accuracy the phone rates at most max(radius, 30 m). A radius of 0
// (detection off) or none known never matches; neither does a fix with no
// accuracy figure, since it cannot show the rider is really there.
export const isAtStop = (
  fix: Pick<Fix, 'latitude' | 'longitude' | 'accuracyMetres'>,
  stop: { latitude: number; longitude: number } | undefined,
  radiusMetres: number | null | undefined,
): boolean => {
  if (!stop || !radiusMetres || radiusMetres <= 0) {
    return false;
  }
  if (fix.accuracyMetres === null || !(fix.accuracyMetres > 0)) {
    return false;
  }
  if (fix.accuracyMetres > Math.max(radiusMetres, ACCURACY_FLOOR_METRES)) {
    return false;
  }
  return metresBetween(fix, stop) <= radiusMetres;
};

// True when the fix is recent enough to be used now, and was taken once the
// job was already heading to this stop (`stageSince`), so a fix by the
// restaurant never "arrives" at a customer next door after pickup.
export const isUsableFix = (
  fix: Pick<Fix, 'at'>,
  stageSince: number,
  now: number,
): boolean => fix.at >= stageSince && now - fix.at <= MAX_FIX_AGE_MS;
