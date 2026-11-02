import { UserStatus } from '@app/types/types';
import {
  TrackingMode,
  WATCH_OPTIONS,
  ordinaryModeFor,
  shouldForwardOrdinaryFix,
  trackingModeFor,
} from './locationTracking';

describe('locationTracking (Row 67, Row 73, spec 0022, AC-5, AC-13, decision 73.9)', () => {
  describe('ordinaryModeFor', () => {
    it('returns off when Offline with 0 jobs', () => {
      expect(ordinaryModeFor(UserStatus.Offline, 0, true)).toBe(
        TrackingMode.Off,
      );
    });

    it('returns waiting when Online or LastCall with 0 jobs', () => {
      expect(ordinaryModeFor(UserStatus.Online, 0, true)).toBe(
        TrackingMode.Waiting,
      );
      expect(ordinaryModeFor(UserStatus.LastCall, 0, true)).toBe(
        TrackingMode.Waiting,
      );
    });

    it('returns job for any status with 1+ jobs', () => {
      expect(ordinaryModeFor(UserStatus.Offline, 1, true)).toBe(
        TrackingMode.Job,
      );
      expect(ordinaryModeFor(UserStatus.Online, 1, true)).toBe(
        TrackingMode.Job,
      );
      expect(ordinaryModeFor(UserStatus.LastCall, 2, true)).toBe(
        TrackingMode.Job,
      );
    });

    it('returns off when hasPermission is false or status is undefined', () => {
      expect(ordinaryModeFor(UserStatus.Online, 2, false)).toBe(
        TrackingMode.Off,
      );
      expect(ordinaryModeFor(undefined, 1, true)).toBe(TrackingMode.Off);
    });
  });

  describe('trackingModeFor with sosSharing', () => {
    it('returns Sos when sosSharing and permission granted, whatever the status and jobs (including OFFLINE with no job)', () => {
      expect(trackingModeFor(UserStatus.Offline, 0, true, true)).toBe(
        TrackingMode.Sos,
      );
      expect(trackingModeFor(UserStatus.Online, 0, true, true)).toBe(
        TrackingMode.Sos,
      );
      expect(trackingModeFor(UserStatus.LastCall, 2, true, true)).toBe(
        TrackingMode.Sos,
      );
    });

    it('returns Off without permission even during an SOS', () => {
      expect(trackingModeFor(UserStatus.Offline, 0, false, true)).toBe(
        TrackingMode.Off,
      );
      expect(trackingModeFor(UserStatus.Online, 1, false, true)).toBe(
        TrackingMode.Off,
      );
    });

    it('returns Off when status is undefined even if sosSharing is true', () => {
      expect(trackingModeFor(undefined, 0, true, true)).toBe(TrackingMode.Off);
    });

    it('falls back to ordinaryModeFor when sosSharing is false', () => {
      expect(trackingModeFor(UserStatus.Offline, 0, true, false)).toBe(
        TrackingMode.Off,
      );
      expect(trackingModeFor(UserStatus.Online, 0, true, false)).toBe(
        TrackingMode.Waiting,
      );
      expect(trackingModeFor(UserStatus.Offline, 1, true, false)).toBe(
        TrackingMode.Job,
      );
    });
  });

  describe('WATCH_OPTIONS (spec 0022, AC-5)', () => {
    it('pins Sos watch options to 5000 interval, 5000 fastestInterval, 0 distanceFilter, high accuracy', () => {
      expect(WATCH_OPTIONS[TrackingMode.Sos]).toEqual({
        interval: 5000,
        fastestInterval: 5000,
        distanceFilter: 0,
        enableHighAccuracy: true,
      });
    });

    it('pins job watch options to 10s interval, 10s fastestInterval, 30m distanceFilter, enableHighAccuracy true', () => {
      expect(WATCH_OPTIONS[TrackingMode.Job]).toEqual({
        interval: 10000,
        fastestInterval: 10000,
        distanceFilter: 30,
        enableHighAccuracy: true,
      });
    });

    it('pins waiting watch options to 60s interval, 30s fastestInterval, 100m distanceFilter, enableHighAccuracy false', () => {
      expect(WATCH_OPTIONS[TrackingMode.Waiting]).toEqual({
        interval: 60000,
        fastestInterval: 30000,
        distanceFilter: 100,
        enableHighAccuracy: false,
      });
    });
  });

  describe('shouldForwardOrdinaryFix (spec 0022, AC-13, decision 73.9)', () => {
    const origin = { latitude: 39.3622, longitude: 22.9425 };
    // Move ~50 metres away
    const move50m = { latitude: 39.3626, longitude: 22.9425 };
    // Move ~150 metres away
    const move150m = { latitude: 39.3635, longitude: 22.9425 };

    it('returns false for TrackingMode.Off, even if it is the first fix', () => {
      expect(
        shouldForwardOrdinaryFix(TrackingMode.Off, undefined, origin, 10000),
      ).toBe(false);
    });

    it('returns true for the first fix of Waiting or Job', () => {
      expect(
        shouldForwardOrdinaryFix(
          TrackingMode.Waiting,
          undefined,
          origin,
          10000,
        ),
      ).toBe(true);
      expect(
        shouldForwardOrdinaryFix(TrackingMode.Job, undefined, origin, 10000),
      ).toBe(true);
    });

    it('for Waiting mode: requires >= 30000 ms AND >= 100 m since the last forwarded fix', () => {
      const last = { ...origin, at: 10000 };

      // Case 1: time >= 30000 ms, but distance < 100 m (50 m) -> false
      expect(
        shouldForwardOrdinaryFix(TrackingMode.Waiting, last, move50m, 45000),
      ).toBe(false);

      // Case 2: distance >= 100 m, but time < 30000 ms (20000 ms) -> false
      expect(
        shouldForwardOrdinaryFix(TrackingMode.Waiting, last, move150m, 30000),
      ).toBe(false);

      // Case 3: time >= 30000 ms AND distance >= 100 m -> true
      expect(
        shouldForwardOrdinaryFix(TrackingMode.Waiting, last, move150m, 40000),
      ).toBe(true);
    });

    it('for Job mode: requires >= 10000 ms AND >= 30 m since the last forwarded fix', () => {
      const last = { ...origin, at: 10000 };

      // Case 1: time >= 10000 ms, but distance < 30 m (same location) -> false
      expect(
        shouldForwardOrdinaryFix(TrackingMode.Job, last, origin, 25000),
      ).toBe(false);

      // Case 2: distance >= 30 m (50 m), but time < 10000 ms (5000 ms) -> false
      expect(
        shouldForwardOrdinaryFix(TrackingMode.Job, last, move50m, 15000),
      ).toBe(false);

      // Case 3: time >= 10000 ms AND distance >= 30 m -> true
      expect(
        shouldForwardOrdinaryFix(TrackingMode.Job, last, move50m, 20000),
      ).toBe(true);
    });
  });
});
