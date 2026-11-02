import { UserStatus } from '@app/types/types';
import { metresBetween } from '@app/utilities/routeLegs';

// Which location watch the app runs (row 67). Location is used only to dispatch
// and deliver (binding value 5), so there is none at all while the rider is
// Offline with no job, and never more than one at a time.
export enum TrackingMode {
  Off = 'off',
  // Online (or on Last call) with no job: matching needs a rough position.
  Waiting = 'waiting',
  // Carrying a job: the restaurant and customer follow the delivery.
  Job = 'job',
  // The rider's own SOS is active (spec 0022): a point every 5 s for the
  // co-op, whatever the rider's status. The highest mode: it replaces the
  // others, so there is still only one watch (AC-13).
  Sos = 'sos',
}

// The mode the rider would be in without an SOS: what dispatch gets to see.
export const ordinaryModeFor = (
  status: UserStatus | undefined,
  activeJobCount: number,
  hasPermission: boolean,
): TrackingMode => {
  if (!hasPermission || status === undefined) {
    return TrackingMode.Off;
  }
  // A job keeps tracking on even after the rider goes Offline: the delivery
  // still has to be followed until it is handed over.
  if (activeJobCount > 0) {
    return TrackingMode.Job;
  }
  return status === UserStatus.Offline
    ? TrackingMode.Off
    : TrackingMode.Waiting;
};

// `sosSharing`: the rider's SOS is active and not yet ended on the phone.
// Then the watch runs at SOS options whatever the status (spec 0022, AC-5);
// without the location permission there is still no watch at all.
export const trackingModeFor = (
  status: UserStatus | undefined,
  activeJobCount: number,
  hasPermission: boolean,
  sosSharing = false,
): TrackingMode => {
  if (sosSharing && hasPermission && status !== undefined) {
    return TrackingMode.Sos;
  }
  return ordinaryModeFor(status, activeJobCount, hasPermission);
};

// How often a fix is taken in each mode. `interval` and `fastestInterval`
// (milliseconds) are Android's; `distanceFilter` (metres) works on both
// platforms, and a fix comes only after the phone has moved that far.
export type WatchOptions = {
  interval: number;
  fastestInterval: number;
  distanceFilter: number;
  // false asks for a rough position (about 100 m) that costs less battery.
  enableHighAccuracy: boolean;
};

// `Record<A, B>` is an object with one B for every A: here, options for each
// mode that has a watch.
export const WATCH_OPTIONS: Record<
  TrackingMode.Waiting | TrackingMode.Job | TrackingMode.Sos,
  WatchOptions
> = {
  // A point every 5 s, wherever the rider is, at the best accuracy the phone
  // has (spec 0022, AC-5): the co-op needs to find a rider in danger.
  [TrackingMode.Sos]: {
    interval: 5000,
    fastestInterval: 5000,
    distanceFilter: 0,
    enableHighAccuracy: true,
  },
  // About every 10 s or 30 m on a job (row 67's Done when).
  [TrackingMode.Job]: {
    interval: 10000,
    fastestInterval: 10000,
    distanceFilter: 30,
    enableHighAccuracy: true,
  },
  // Less often while waiting for offers: about once a minute or 100 m
  // (decision 67.2).
  [TrackingMode.Waiting]: {
    interval: 60000,
    fastestInterval: 30000,
    distanceFilter: 100,
    // Matching needs only a rough position (decision 68.5).
    enableHighAccuracy: false,
  },
};

// The last position sent as the rider's ordinary location (`setUserLocation`).
export type ForwardedFix = {
  latitude: number;
  longitude: number;
  // The phone's clock when it was sent.
  at: number;
};

// During an SOS the one watch gives a fix every 5 s, but dispatch must get no
// finer data than before (spec 0022, AC-13). A fix goes out as the ordinary
// location only as often as the mode the rider would otherwise be in allows:
// at least its `fastestInterval` after the last one sent and at least its
// `distanceFilter` away from it. With no ordinary mode (Offline, no job),
// nothing goes out at all. The first fix of a mode always goes out.
export const shouldForwardOrdinaryFix = (
  ordinaryMode: TrackingMode,
  last: ForwardedFix | undefined,
  fix: { latitude: number; longitude: number },
  now: number,
): boolean => {
  if (
    ordinaryMode !== TrackingMode.Waiting &&
    ordinaryMode !== TrackingMode.Job
  ) {
    return false;
  }
  if (!last) {
    return true;
  }
  const options = WATCH_OPTIONS[ordinaryMode];
  return (
    now - last.at >= options.fastestInterval &&
    metresBetween(last, fix) >= options.distanceFilter
  );
};
