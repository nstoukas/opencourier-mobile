import { OrderStatus } from '@app/types/enums';
import {
  ACCURACY_FLOOR_METRES,
  ARRIVAL_STEP,
  HAND_BACK_GRACE_MS,
  MAX_FIX_AGE_MS,
  arrivalStageOf,
  isAtStop,
  isUsableFix,
} from './arrival';

describe('arrival pure utilities (spec 0021, AC-1, AC-2, AC-12)', () => {
  describe('arrivalStageOf', () => {
    it('returns "pickup" for accepted and dispatched', () => {
      expect(arrivalStageOf(OrderStatus.accepted)).toBe('pickup');
      expect(arrivalStageOf(OrderStatus.dispatched)).toBe('pickup');
    });

    it('returns "dropoff" for picked_up and on_the_way', () => {
      expect(arrivalStageOf(OrderStatus.picked_up)).toBe('dropoff');
      expect(arrivalStageOf(OrderStatus.on_the_way)).toBe('dropoff');
    });

    it('returns null for other statuses (already arrived or completed)', () => {
      expect(
        arrivalStageOf(OrderStatus.courier_arrived_at_pickup_location),
      ).toBeNull();
      expect(
        arrivalStageOf(OrderStatus.courier_arrived_at_dropoff_location),
      ).toBeNull();
      expect(arrivalStageOf(OrderStatus.dropped_off)).toBeNull();
      expect(arrivalStageOf(OrderStatus.canceled)).toBeNull();
      expect(arrivalStageOf('UNKNOWN_STATUS')).toBeNull();
    });
  });

  describe('constants', () => {
    it('maps arrival stages to outbox steps', () => {
      expect(ARRIVAL_STEP.pickup).toBe('arrived_at_pickup');
      expect(ARRIVAL_STEP.dropoff).toBe('arrived_at_dropoff');
    });

    it('defines 60 s max fix age, 30 m accuracy floor, and 3 s hand back grace', () => {
      expect(MAX_FIX_AGE_MS).toBe(60_000);
      expect(ACCURACY_FLOOR_METRES).toBe(30);
      expect(HAND_BACK_GRACE_MS).toBe(3_000);
    });
  });

  describe('isAtStop (AC-1, AC-2)', () => {
    // 39.362, 22.945: Volos center
    const stop = { latitude: 39.362, longitude: 22.945 };

    it('returns true when fix is at stop within radius and accuracy is at most max(R, 30)', () => {
      const fix = {
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 15,
      };
      expect(isAtStop(fix, stop, 50)).toBe(true);
    });

    it('returns false when stop is undefined', () => {
      const fix = {
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 15,
      };
      expect(isAtStop(fix, undefined, 50)).toBe(false);
    });

    it('returns false when radius is null, undefined, 0 or negative (AC-2: no detection)', () => {
      const fix = {
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 10,
      };
      expect(isAtStop(fix, stop, null)).toBe(false);
      expect(isAtStop(fix, stop, undefined)).toBe(false);
      expect(isAtStop(fix, stop, 0)).toBe(false);
      expect(isAtStop(fix, stop, -10)).toBe(false);
    });

    it('returns false when accuracyMetres is null, 0, or negative', () => {
      const stopCoord = { latitude: 39.362, longitude: 22.945 };
      expect(
        isAtStop(
          { latitude: 39.362, longitude: 22.945, accuracyMetres: null },
          stopCoord,
          50,
        ),
      ).toBe(false);
      expect(
        isAtStop(
          { latitude: 39.362, longitude: 22.945, accuracyMetres: 0 },
          stopCoord,
          50,
        ),
      ).toBe(false);
      expect(
        isAtStop(
          { latitude: 39.362, longitude: 22.945, accuracyMetres: -5 },
          stopCoord,
          50,
        ),
      ).toBe(false);
    });

    it('accuracy check respects max(R, 30): accepts up to 30 m accuracy for R=20, refuses > 30 m', () => {
      // With R = 20: max(20, 30) = 30
      const fix30 = {
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 30,
      };
      expect(isAtStop(fix30, stop, 20)).toBe(true);

      const fix31 = {
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 31,
      };
      expect(isAtStop(fix31, stop, 20)).toBe(false);
    });

    it('accuracy check respects max(R, 30): accepts up to R accuracy for R=50, refuses > 50 m', () => {
      // With R = 50: max(50, 30) = 50
      const fix50 = {
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 50,
      };
      expect(isAtStop(fix50, stop, 50)).toBe(true);

      const fix51 = {
        latitude: 39.362,
        longitude: 22.945,
        accuracyMetres: 51,
      };
      expect(isAtStop(fix51, stop, 50)).toBe(false);
    });

    it('returns false when fix is further than radiusMetres from stop', () => {
      // 39.362, 22.945 to 39.365, 22.945 is ~333 metres away
      const farFix = {
        latitude: 39.365,
        longitude: 22.945,
        accuracyMetres: 10,
      };
      expect(isAtStop(farFix, stop, 50)).toBe(false);
    });
  });

  describe('isUsableFix (AC-1)', () => {
    it('returns true when fix.at is at or after stageSince and within 60 s of now', () => {
      const now = 100_000;
      const stageSince = 50_000;
      const fix = { at: 60_000 };

      expect(isUsableFix(fix, stageSince, now)).toBe(true);
    });

    it('returns true when fix.at equals stageSince', () => {
      const now = 100_000;
      const stageSince = 70_000;
      const fix = { at: 70_000 };

      expect(isUsableFix(fix, stageSince, now)).toBe(true);
    });

    it('returns true when fix.at is exactly 60 s old', () => {
      const now = 100_000;
      const stageSince = 40_000;
      const fix = { at: 40_000 }; // 100_000 - 40_000 = 60_000 ms

      expect(isUsableFix(fix, stageSince, now)).toBe(true);
    });

    it('returns false when fix.at was taken before stage started (stageSince)', () => {
      const now = 100_000;
      const stageSince = 80_000;
      const fix = { at: 79_999 }; // Before stage started

      expect(isUsableFix(fix, stageSince, now)).toBe(false);
    });

    it('returns false when fix.at is older than 60 s', () => {
      const now = 100_000;
      const stageSince = 20_000;
      const fix = { at: 39_999 }; // 100_000 - 39_999 = 60_001 ms > 60_000 ms

      expect(isUsableFix(fix, stageSince, now)).toBe(false);
    });
  });
});
