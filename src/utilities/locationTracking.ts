import { UserStatus } from '@app/types/types';

// Which location watch the app runs (row 67). Location is used only to dispatch
// and deliver (binding value 5), so there is none at all while the rider is
// Offline with no job, and never more than one at a time.
export enum TrackingMode {
  Off = 'off',
  // Online (or on Last call) with no job: matching needs a rough position.
  Waiting = 'waiting',
  // Carrying a job: the restaurant and customer follow the delivery.
  Job = 'job',
}

export const trackingModeFor = (
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
  TrackingMode.Waiting | TrackingMode.Job,
  WatchOptions
> = {
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
