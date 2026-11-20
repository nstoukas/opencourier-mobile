import {
  formatWorkDuration,
  centsPerHourOf,
  counterView,
  coopClock,
  coopDate,
  addDays,
  pageRange,
  formatShare,
} from './timeWorked';
import { CurrentTimeWorked } from '@app/types/timeWorked';

describe('timeWorked utilities (spec 0040, AC-10, AC-7, AC-6)', () => {
  describe('formatWorkDuration (AC-10)', () => {
    it('returns "0 min" for 0 and negative values', () => {
      expect(formatWorkDuration(0)).toBe('0 min');
      expect(formatWorkDuration(-10)).toBe('0 min');
      expect(formatWorkDuration(-3600)).toBe('0 min');
    });

    it('returns "<m> min" under an hour', () => {
      expect(formatWorkDuration(45)).toBe('0 min');
      expect(formatWorkDuration(60)).toBe('1 min');
      expect(formatWorkDuration(48 * 60)).toBe('48 min');
      expect(formatWorkDuration(48 * 60 + 35)).toBe('48 min');
      expect(formatWorkDuration(59 * 60 + 59)).toBe('59 min');
    });

    it('returns "<h>h<mm>" from an hour', () => {
      expect(formatWorkDuration(3600)).toBe('1h00');
      expect(formatWorkDuration(3600 + 5 * 60)).toBe('1h05');
      // 3h12 = 3 * 3600 + 12 * 60 = 11520 s
      expect(formatWorkDuration(11520)).toBe('3h12');
      expect(formatWorkDuration(10 * 3600 + 45 * 60)).toBe('10h45');
    });
  });

  describe('centsPerHourOf (AC-6, AC-10)', () => {
    it('returns null when workSeconds is under 60 s (under a minute)', () => {
      expect(centsPerHourOf(1000, 0)).toBeNull();
      expect(centsPerHourOf(1000, 59)).toBeNull();
      expect(centsPerHourOf(1000, -10)).toBeNull();
    });

    it('returns rounded cents per hour for 60 s or more', () => {
      // €38.50 (3850 cents) in 3h12 (11520 s) -> (3850 * 3600) / 11520 = 1203.125 -> 1203 cents/h
      expect(centsPerHourOf(3850, 11520)).toBe(1203);
      // €10.00 in 1 hour (3600 s) -> 1000 cents/h
      expect(centsPerHourOf(1000, 3600)).toBe(1000);
      // €0.00 in 2 minutes (120 s) -> 0 cents/h
      expect(centsPerHourOf(0, 120)).toBe(0);
      // Rounding check: 100 cents in 120 s -> (100 * 3600) / 120 = 3000
      expect(centsPerHourOf(100, 120)).toBe(3000);
    });
  });

  describe('counterView (AC-10)', () => {
    it('returns { kind: "none" } when snapshot is undefined or shift is null', () => {
      expect(counterView(undefined, 1000, 2000)).toEqual({ kind: 'none' });

      const snapshotNoShift: CurrentTimeWorked = {
        asOf: '2026-11-20T10:00:00.000Z',
        shiftBreakMinutes: 30,
        shift: null,
      };
      expect(counterView(snapshotNoShift, 1000, 2000)).toEqual({
        kind: 'none',
      });
    });

    it('for a working shift, adds phone elapsed time since fetch (fetchedAtMs to nowMs) to workSeconds and recomputes centsPerHour', () => {
      const snapshot: CurrentTimeWorked = {
        asOf: '2026-11-20T10:00:00.000Z',
        shiftBreakMinutes: 30,
        shift: {
          startedAt: '2026-11-20T07:00:00.000Z',
          onBreakSince: null,
          workSeconds: 10800, // 3 hours
          jobSeconds: 7200,
          paidWaitSeconds: 600,
          unpaidSeconds: 3000,
          moneyCents: 3850,
          centsPerHour: 1283,
          currencyCode: 'EUR',
        },
      };

      const fetchedAtMs = 1_000_000;
      // 12 minutes (720 seconds) passed on the phone since fetch
      const nowMs = fetchedAtMs + 720_000;

      const view = counterView(snapshot, fetchedAtMs, nowMs);

      expect(view).toEqual({
        kind: 'working',
        workSeconds: 10800 + 720, // 11520 (3h12)
        moneyCents: 3850,
        centsPerHour: centsPerHourOf(3850, 11520), // 1203
        currencyCode: 'EUR',
      });
    });

    it('never uses the phone clock against the server asOf (phone set wrong does not shift workSeconds)', () => {
      const snapshot: CurrentTimeWorked = {
        asOf: '2026-11-20T10:00:00.000Z',
        shiftBreakMinutes: 30,
        shift: {
          startedAt: '2026-11-20T07:00:00.000Z',
          onBreakSince: null,
          workSeconds: 3600,
          jobSeconds: 1800,
          paidWaitSeconds: 0,
          unpaidSeconds: 1800,
          moneyCents: 1500,
          centsPerHour: 1500,
          currencyCode: 'EUR',
        },
      };

      // Even if phone clock nowMs is years in the future or past relative to asOf:
      const fetchedAtMs = Date.parse('2030-01-01T00:00:00.000Z');
      const nowMs = fetchedAtMs + 60_000; // 60s elapsed on phone

      const view = counterView(snapshot, fetchedAtMs, nowMs);
      expect(view).toEqual({
        kind: 'working',
        workSeconds: 3660,
        moneyCents: 1500,
        centsPerHour: centsPerHourOf(1500, 3660),
        currencyCode: 'EUR',
      });
    });

    it('clamps negative elapsed time (phone clock set backwards after fetch) to 0', () => {
      const snapshot: CurrentTimeWorked = {
        asOf: '2026-11-20T10:00:00.000Z',
        shiftBreakMinutes: 30,
        shift: {
          startedAt: '2026-11-20T07:00:00.000Z',
          onBreakSince: null,
          workSeconds: 3600,
          jobSeconds: 1800,
          paidWaitSeconds: 0,
          unpaidSeconds: 1800,
          moneyCents: 1500,
          centsPerHour: 1500,
          currencyCode: 'EUR',
        },
      };

      const fetchedAtMs = 5000;
      const nowMs = 2000; // time jumped backwards

      const view = counterView(snapshot, fetchedAtMs, nowMs);
      expect(view).toEqual({
        kind: 'working',
        workSeconds: 3600,
        moneyCents: 1500,
        centsPerHour: 1500,
        currencyCode: 'EUR',
      });
    });

    it('on a break, computes break minutes as (asOf - onBreakSince) + elapsed since fetch', () => {
      const snapshot: CurrentTimeWorked = {
        asOf: '2026-11-20T10:05:00.000Z',
        shiftBreakMinutes: 30,
        shift: {
          startedAt: '2026-11-20T07:00:00.000Z',
          onBreakSince: '2026-11-20T10:00:00.000Z', // 5 min break at asOf
          workSeconds: 10800,
          jobSeconds: 7200,
          paidWaitSeconds: 600,
          unpaidSeconds: 3000,
          moneyCents: 3850,
          centsPerHour: 1283,
          currencyCode: 'EUR',
        },
      };

      const fetchedAtMs = 1_000_000;
      // 7 minutes (420,000 ms) passed on phone since fetch -> total break 5 + 7 = 12 minutes
      const nowMs = fetchedAtMs + 7 * 60 * 1000;

      const view = counterView(snapshot, fetchedAtMs, nowMs);
      expect(view).toEqual({
        kind: 'break',
        breakMinutes: 12,
      });
    });

    it('returns { kind: "none" } once break reaches shiftBreakMinutes', () => {
      const snapshot: CurrentTimeWorked = {
        asOf: '2026-11-20T10:05:00.000Z',
        shiftBreakMinutes: 30,
        shift: {
          startedAt: '2026-11-20T07:00:00.000Z',
          onBreakSince: '2026-11-20T10:00:00.000Z', // 5 min break at asOf
          workSeconds: 10800,
          jobSeconds: 7200,
          paidWaitSeconds: 600,
          unpaidSeconds: 3000,
          moneyCents: 3850,
          centsPerHour: 1283,
          currencyCode: 'EUR',
        },
      };

      const fetchedAtMs = 1_000_000;
      // 25 minutes passed on phone -> 5 + 25 = 30 min (limit reached)
      const nowMsLimit = fetchedAtMs + 25 * 60 * 1000;
      expect(counterView(snapshot, fetchedAtMs, nowMsLimit)).toEqual({
        kind: 'none',
      });

      // 26 minutes passed -> over limit
      const nowMsOver = fetchedAtMs + 26 * 60 * 1000;
      expect(counterView(snapshot, fetchedAtMs, nowMsOver)).toEqual({
        kind: 'none',
      });
    });
  });

  describe('coopDate (AC-7, AC-11)', () => {
    it('gives the Europe/Athens day (e.g. 23:30 UTC in winter is next day in Athens)', () => {
      // Winter: Athens is UTC+2 (EET). 2026-01-15T23:30:00Z -> 2026-01-16 01:30 in Athens.
      const winterUtc = Date.parse('2026-01-15T23:30:00.000Z');
      expect(coopDate(winterUtc)).toBe('2026-01-16');

      // Noon UTC on Jan 15 is Jan 15 in Athens.
      const winterNoonUtc = Date.parse('2026-01-15T12:00:00.000Z');
      expect(coopDate(winterNoonUtc)).toBe('2026-01-15');

      // Summer: Athens is UTC+3 (EEST). 2026-07-15T21:30:00Z -> 2026-07-16 00:30 in Athens.
      const summerUtc = Date.parse('2026-07-15T21:30:00.000Z');
      expect(coopDate(summerUtc)).toBe('2026-07-16');
    });
  });

  describe('coopClock (decision 36.48)', () => {
    it('formats a timestamp into HH:mm in Europe/Athens time, regardless of local timezone', () => {
      // 2026-11-18T22:30:00Z in winter (EET = UTC+2) is 2026-11-19 00:30 in Athens
      expect(coopClock(Date.parse('2026-11-18T22:30:00Z'))).toBe('00:30');

      // Summer: Athens is UTC+3 (EEST). 2026-07-15T21:30:00Z -> 2026-07-16 00:30 in Athens
      expect(coopClock(Date.parse('2026-07-15T21:30:00Z'))).toBe('00:30');
    });
  });

  describe('addDays and pageRange (AC-11)', () => {
    it('addDays shifts a YYYY-MM-DD date by whole days without timezone shift', () => {
      expect(addDays('2026-11-20', 0)).toBe('2026-11-20');
      expect(addDays('2026-11-20', 1)).toBe('2026-11-21');
      expect(addDays('2026-11-20', -6)).toBe('2026-11-14');
      expect(addDays('2026-11-20', -7)).toBe('2026-11-13');
    });

    it('pageRange(today, 0) is the 7 days ending today, and page 1 is the 7 days before', () => {
      const today = '2026-11-20';
      // Page 0: Nov 14 to Nov 20 (7 days)
      expect(pageRange(today, 0)).toEqual({
        from: '2026-11-14',
        to: '2026-11-20',
      });

      // Page 1: Nov 07 to Nov 13 (7 days before)
      expect(pageRange(today, 1)).toEqual({
        from: '2026-11-07',
        to: '2026-11-13',
      });

      // Page 2: Oct 31 to Nov 06
      expect(pageRange(today, 2)).toEqual({
        from: '2026-10-31',
        to: '2026-11-06',
      });
    });
  });

  describe('formatShare', () => {
    it('formats a share ratio as a percentage or dash when null', () => {
      expect(formatShare(0.38)).toBe('38%');
      expect(formatShare(0.246)).toBe('25%');
      expect(formatShare(0)).toBe('0%');
      expect(formatShare(1)).toBe('100%');
      expect(formatShare(null)).toBe('—');
    });
  });
});
