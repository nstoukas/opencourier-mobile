import { UserStatus } from '@app/types/types';
import {
  TrackingMode,
  WATCH_OPTIONS,
  trackingModeFor,
} from './locationTracking';

describe('locationTracking (Row 67, Clauses 1 & 2)', () => {
  describe('trackingModeFor', () => {
    it('returns off when Offline with 0 jobs', () => {
      expect(trackingModeFor(UserStatus.Offline, 0, true)).toBe(
        TrackingMode.Off,
      );
    });

    it('returns waiting when Online with 0 jobs', () => {
      expect(trackingModeFor(UserStatus.Online, 0, true)).toBe(
        TrackingMode.Waiting,
      );
    });

    it('returns waiting when LAST_CALL with 0 jobs', () => {
      expect(trackingModeFor(UserStatus.LastCall, 0, true)).toBe(
        TrackingMode.Waiting,
      );
    });

    it('returns job for any status with 1+ jobs (decision 67.3)', () => {
      // Offline with an active job keeps tracking until delivery is complete
      expect(trackingModeFor(UserStatus.Offline, 1, true)).toBe(
        TrackingMode.Job,
      );
      expect(trackingModeFor(UserStatus.Online, 1, true)).toBe(
        TrackingMode.Job,
      );
      expect(trackingModeFor(UserStatus.LastCall, 2, true)).toBe(
        TrackingMode.Job,
      );
    });

    it('returns off when hasPermission is false', () => {
      expect(trackingModeFor(UserStatus.Online, 0, false)).toBe(
        TrackingMode.Off,
      );
      expect(trackingModeFor(UserStatus.Online, 2, false)).toBe(
        TrackingMode.Off,
      );
      expect(trackingModeFor(UserStatus.Offline, 1, false)).toBe(
        TrackingMode.Off,
      );
    });

    it('returns off when status is undefined (no user)', () => {
      expect(trackingModeFor(undefined, 0, true)).toBe(TrackingMode.Off);
      expect(trackingModeFor(undefined, 1, true)).toBe(TrackingMode.Off);
    });
  });

  describe('WATCH_OPTIONS (Clause 2, decision 67.2)', () => {
    it('pins job watch options to 10s interval, 10s fastestInterval, 30m distanceFilter', () => {
      expect(WATCH_OPTIONS[TrackingMode.Job]).toEqual({
        interval: 10000,
        fastestInterval: 10000,
        distanceFilter: 30,
      });
    });

    it('pins waiting watch options to 60s interval, 30s fastestInterval, 100m distanceFilter', () => {
      expect(WATCH_OPTIONS[TrackingMode.Waiting]).toEqual({
        interval: 60000,
        fastestInterval: 30000,
        distanceFilter: 100,
      });
    });
  });
});
