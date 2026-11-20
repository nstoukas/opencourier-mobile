import {
  addMonths,
  END_LABEL_KEYS,
  formatKm,
  jobDate,
  jobMinutes,
  jobMoneyCents,
  mergeMonths,
  monthGrid,
  monthOf,
  monthsOfPeriod,
  periodDates,
  shiftsOnDay,
  waitMinutes,
  weekStartOf,
} from './earnings';
import {
  EarningsDay,
  EarningsJob,
  EarningsMonth,
  EarningsShift,
  EarningsWeek,
} from '@app/types/earnings';

describe('earnings pure helpers (spec 0042 AC-1, AC-2, AC-5, AC-7, AC-8)', () => {
  describe('monthOf', () => {
    it('returns YYYY-MM prefix from YYYY-MM-DD date', () => {
      expect(monthOf('2026-11-20')).toBe('2026-11');
      expect(monthOf('2026-01-01')).toBe('2026-01');
    });
  });

  describe('weekStartOf (AC-5: Monday first)', () => {
    it('returns Monday for any day of the week', () => {
      // 2026-11-20 is a Friday -> Monday is 2026-11-16
      expect(weekStartOf('2026-11-20')).toBe('2026-11-16');
      // 2026-11-16 is Monday -> returns 2026-11-16
      expect(weekStartOf('2026-11-16')).toBe('2026-11-16');
      // 2026-11-22 is Sunday -> returns 2026-11-16
      expect(weekStartOf('2026-11-22')).toBe('2026-11-16');
      // 2026-11-18 is Wednesday -> returns 2026-11-16
      expect(weekStartOf('2026-11-18')).toBe('2026-11-16');
    });

    it('handles week crossing month boundary', () => {
      // 2026-12-02 is Wednesday -> Monday is 2026-11-30
      expect(weekStartOf('2026-12-02')).toBe('2026-11-30');
    });
  });

  describe('periodDates', () => {
    it('returns single date in day mode', () => {
      expect(periodDates('day', '2026-11-20')).toEqual(['2026-11-20']);
    });

    it('returns all 7 days of the week Monday to Sunday in week mode', () => {
      expect(periodDates('week', '2026-11-20')).toEqual([
        '2026-11-16',
        '2026-11-17',
        '2026-11-18',
        '2026-11-19',
        '2026-11-20',
        '2026-11-21',
        '2026-11-22',
      ]);
    });
  });

  describe('monthsOfPeriod', () => {
    it('returns one month when period is within a single month', () => {
      expect(monthsOfPeriod('day', '2026-11-20')).toEqual(['2026-11']);
      expect(monthsOfPeriod('week', '2026-11-20')).toEqual(['2026-11']);
    });

    it('returns two months when a week crosses a month boundary', () => {
      // Week of 2026-11-30 runs Mon Nov 30 to Sun Dec 6
      expect(monthsOfPeriod('week', '2026-12-01')).toEqual([
        '2026-11',
        '2026-12',
      ]);
      expect(monthsOfPeriod('week', '2026-11-30')).toEqual([
        '2026-11',
        '2026-12',
      ]);
    });
  });

  describe('mergeMonths', () => {
    const makeDay = (date: string): EarningsDay => ({
      date,
      workSeconds: 3600,
      jobSeconds: 2400,
      paidWaitSeconds: 300,
      unpaidSeconds: 900,
      moneyCents: 1500,
      unlinkedMoneyCents: 0,
      noJobMoneyCents: 0,
      centsPerHour: 1500,
      activeCentsPerHour: 2000,
      paidKm: 3.5,
      centsPerPaidKm: 429,
      medianPickupWaitSeconds: 120,
      pickupWaitCount: 1,
      dropOffCount: 1,
    });

    const makeWeek = (weekStart: string): EarningsWeek => ({
      weekStart,
      soFar: false,
      cutAtReach: false,
      workSeconds: 3600,
      jobSeconds: 2400,
      paidWaitSeconds: 300,
      unpaidSeconds: 900,
      moneyCents: 1500,
      unlinkedMoneyCents: 0,
      noJobMoneyCents: 0,
      centsPerHour: 1500,
      activeCentsPerHour: 2000,
      paidKm: 3.5,
      centsPerPaidKm: 429,
      medianPickupWaitSeconds: 120,
      pickupWaitCount: 1,
      dropOffCount: 1,
    });

    const jobA: EarningsJob = {
      deliveryId: 'del-A',
      acceptedAt: '2026-11-30T21:00:00.000Z',
      endedAt: '2026-11-30T21:30:00.000Z',
      endEventType: 'DROPPED_OFF',
      droppedOff: true,
      paidWaitSeconds: 60,
      deliveryMoneyCents: 500,
      compensations: [],
      paidKm: 2.1,
      dropoffArea: 'Center',
      pickupWaitSeconds: 60,
      cancelledAfterPickup: false,
      endLabel: null,
      pickupName: 'Taverna',
    };

    const jobB: EarningsJob = {
      deliveryId: 'del-B',
      acceptedAt: '2026-12-01T00:30:00.000Z',
      endedAt: '2026-12-01T01:00:00.000Z',
      endEventType: 'DROPPED_OFF',
      droppedOff: true,
      paidWaitSeconds: 90,
      deliveryMoneyCents: 600,
      compensations: [],
      paidKm: 3.0,
      dropoffArea: 'Port',
      pickupWaitSeconds: 90,
      cancelledAfterPickup: false,
      endLabel: null,
      pickupName: 'Pizza',
    };

    const shiftCrossing: EarningsShift = {
      startedAt: '2026-11-30T20:00:00.000Z',
      startedBeforeRange: false,
      endedAt: '2026-12-01T02:00:00.000Z',
      onBreakSince: null,
      workSeconds: 21600,
      jobSeconds: 3600,
      paidWaitSeconds: 0,
      unpaidSeconds: 18000,
      breaks: [],
      moneyCents: 1100,
      lateMoneyCents: 0,
      centsPerHour: null,
      currencyCode: 'EUR',
      statusChanges: [],
      jobs: [jobA],
    };

    it('joins days, weeks, and dedupes shifts keeping jobs of each once', () => {
      const month1: EarningsMonth = {
        month: '2026-11',
        from: '2026-11-01',
        to: '2026-11-30',
        reachFrom: '2026-09-20',
        recordedFrom: '2026-09-01T00:00:00.000Z',
        currencyCode: 'EUR',
        days: [makeDay('2026-11-30')],
        weeks: [makeWeek('2026-11-30')],
        shifts: [shiftCrossing],
        jobsInNoShift: [],
      };

      const month2: EarningsMonth = {
        month: '2026-12',
        from: '2026-12-01',
        to: '2026-12-31',
        reachFrom: '2026-09-20',
        recordedFrom: '2026-09-01T00:00:00.000Z',
        currencyCode: 'EUR',
        days: [makeDay('2026-12-01')],
        weeks: [makeWeek('2026-11-30')],
        shifts: [{ ...shiftCrossing, jobs: [jobB] }],
        jobsInNoShift: [],
      };

      const merged = mergeMonths([month1, month2]);

      expect(merged.days).toHaveLength(2);
      expect(merged.weeks).toHaveLength(1); // Deduped same weekStart
      expect(merged.shifts).toHaveLength(1);
      // The merged shift has both jobs!
      expect(merged.shifts[0].jobs).toHaveLength(2);
      expect(merged.shifts[0].jobs.map(j => j.deliveryId)).toEqual([
        'del-A',
        'del-B',
      ]);
      expect(merged.reachFrom).toBe('2026-09-20');
      expect(merged.recordedFrom).toBe('2026-09-01T00:00:00.000Z');
      expect(merged.currencyCode).toBe('EUR');
    });

    it('handles empty input gracefully', () => {
      const merged = mergeMonths([]);
      expect(merged.reachFrom).toBeNull();
      expect(merged.recordedFrom).toBeNull();
      expect(merged.currencyCode).toBe('EUR');
      expect(merged.days).toEqual([]);
      expect(merged.weeks).toEqual([]);
      expect(merged.shifts).toEqual([]);
      expect(merged.jobsInNoShift).toEqual([]);
    });
  });

  describe('jobDate (AC-2: Europe/Athens timezone)', () => {
    it('uses Athens date for accept timestamp regardless of local zone', () => {
      // 2026-11-20T22:30:00Z in Athens (UTC+2) is 2026-11-21 00:30
      expect(jobDate({ acceptedAt: '2026-11-20T22:30:00.000Z' })).toBe(
        '2026-11-21',
      );
      // 2026-11-20T21:30:00Z in Athens is 2026-11-20 23:30
      expect(jobDate({ acceptedAt: '2026-11-20T21:30:00.000Z' })).toBe(
        '2026-11-20',
      );
    });
  });

  describe('jobMoneyCents (AC-8, spec 0040 AC-6)', () => {
    it('adds deliveryMoneyCents plus all linked compensation amounts', () => {
      const job: EarningsJob = {
        deliveryId: 'del-1',
        acceptedAt: '2026-11-20T12:00:00.000Z',
        endedAt: '2026-11-20T12:20:00.000Z',
        endEventType: 'DROPPED_OFF',
        droppedOff: true,
        paidWaitSeconds: 120,
        deliveryMoneyCents: 350,
        compensations: [
          {
            id: 'c1',
            reason: 'WAITING',
            amountCents: 150,
            createdAt: '2026-11-20T12:15:00.000Z',
            addedLater: false,
          },
          {
            id: 'c2',
            reason: 'REVIEW',
            amountCents: 50,
            createdAt: '2026-11-21T10:00:00.000Z',
            addedLater: true,
          },
        ],
        paidKm: 2.0,
        dropoffArea: 'Center',
        pickupWaitSeconds: 120,
        cancelledAfterPickup: false,
        endLabel: null,
        pickupName: 'Souvlaki',
      };

      expect(jobMoneyCents(job)).toBe(350 + 150 + 50); // 550 cents
    });
  });

  describe('jobMinutes', () => {
    it('calculates duration from accept to end in rounded whole minutes', () => {
      expect(
        jobMinutes(
          {
            acceptedAt: '2026-11-20T12:00:00.000Z',
            endedAt: '2026-11-20T12:14:35.000Z',
          },
          0,
        ),
      ).toBe(15); // 14 min 35 sec rounds to 15 min

      expect(
        jobMinutes(
          {
            acceptedAt: '2026-11-20T12:00:00.000Z',
            endedAt: '2026-11-20T12:14:15.000Z',
          },
          0,
        ),
      ).toBe(14); // 14 min 15 sec rounds to 14 min
    });

    it('uses nowMs when job is still held (endedAt is null)', () => {
      const acceptedAt = '2026-11-20T12:00:00.000Z';
      const nowMs = Date.parse('2026-11-20T12:22:10.000Z');
      expect(jobMinutes({ acceptedAt, endedAt: null }, nowMs)).toBe(22);
    });
  });

  describe('shiftsOnDay (AC-6)', () => {
    const shift1: EarningsShift = {
      startedAt: '2026-11-19T21:00:00.000Z', // In Athens: Nov 19 23:00
      startedBeforeRange: false,
      endedAt: '2026-11-20T03:00:00.000Z', // In Athens: Nov 20 05:00
      onBreakSince: null,
      workSeconds: 21600,
      jobSeconds: 3600,
      paidWaitSeconds: 0,
      unpaidSeconds: 18000,
      breaks: [],
      moneyCents: 500,
      lateMoneyCents: 0,
      centsPerHour: null,
      currencyCode: 'EUR',
      statusChanges: [],
      jobs: [
        {
          deliveryId: 'j1',
          acceptedAt: '2026-11-19T21:30:00.000Z', // Nov 19
          endedAt: '2026-11-19T22:00:00.000Z',
          endEventType: 'DROPPED_OFF',
          droppedOff: true,
          paidWaitSeconds: 0,
          deliveryMoneyCents: 250,
          compensations: [],
          paidKm: 1.0,
          dropoffArea: 'A',
          pickupWaitSeconds: 0,
          cancelledAfterPickup: false,
          endLabel: null,
          pickupName: 'P1',
        },
        {
          deliveryId: 'j2',
          acceptedAt: '2026-11-20T01:00:00.000Z', // Nov 20
          endedAt: '2026-11-20T01:30:00.000Z',
          endEventType: 'DROPPED_OFF',
          droppedOff: true,
          paidWaitSeconds: 0,
          deliveryMoneyCents: 250,
          compensations: [],
          paidKm: 1.0,
          dropoffArea: 'B',
          pickupWaitSeconds: 0,
          cancelledAfterPickup: false,
          endLabel: null,
          pickupName: 'P2',
        },
      ],
    };

    it('returns shifts touching the day, filtering jobs to only those accepted on that day', () => {
      const resultNov20 = shiftsOnDay([shift1], '2026-11-20', 0);
      expect(resultNov20).toHaveLength(1);
      // Only j2 was accepted on Nov 20 in Athens time!
      expect(resultNov20[0].jobs).toHaveLength(1);
      expect(resultNov20[0].jobs[0].deliveryId).toBe('j2');

      const resultNov19 = shiftsOnDay([shift1], '2026-11-19', 0);
      expect(resultNov19).toHaveLength(1);
      // Only j1 was accepted on Nov 19
      expect(resultNov19[0].jobs).toHaveLength(1);
      expect(resultNov19[0].jobs[0].deliveryId).toBe('j1');
    });

    it('excludes shifts that do not touch the day', () => {
      const resultNov21 = shiftsOnDay([shift1], '2026-11-21', 0);
      expect(resultNov21).toEqual([]);
    });
  });

  describe('formatKm (AC-1, AC-8)', () => {
    it('formats km with one decimal place', () => {
      expect(formatKm(2.482)).toBe('2.5 km');
      expect(formatKm(1)).toBe('1.0 km');
      expect(formatKm(0)).toBe('0.0 km');
      expect(formatKm(0.04)).toBe('0.0 km');
      expect(formatKm(0.06)).toBe('0.1 km');
    });
  });

  describe('waitMinutes (AC-1)', () => {
    it('rounds seconds to whole minutes', () => {
      expect(waitMinutes(66)).toBe(1);
      expect(waitMinutes(119)).toBe(2);
      expect(waitMinutes(30)).toBe(1);
      expect(waitMinutes(29)).toBe(0);
      expect(waitMinutes(0)).toBe(0);
    });
  });

  describe('addMonths', () => {
    it('adds or subtracts calendar months from YYYY-MM', () => {
      expect(addMonths('2026-11', 1)).toBe('2026-12');
      expect(addMonths('2026-11', -1)).toBe('2026-10');
      expect(addMonths('2026-12', 1)).toBe('2027-01');
      expect(addMonths('2026-01', -1)).toBe('2025-12');
    });
  });

  describe('monthGrid (AC-7: Monday first, 7 cells per row)', () => {
    it('generates grid of weeks with null padding where every row has 7 cells', () => {
      const grid = monthGrid('2026-11');
      // Nov 2026 starts on Sunday (day 7 of week, so 6 nulls in first week)
      expect(grid.length).toBeGreaterThanOrEqual(4);
      for (const week of grid) {
        expect(week).toHaveLength(7);
      }

      // First week has null padding before Nov 1
      const firstWeek = grid[0];
      expect(firstWeek[0]).toBeNull(); // Monday is not Nov 1
      expect(firstWeek[6]).toBe('2026-11-01'); // Sunday is Nov 1

      // Last day of Nov 2026 is Monday Nov 30
      const lastWeek = grid[grid.length - 1];
      expect(lastWeek[0]).toBe('2026-11-30');
      expect(lastWeek[1]).toBeNull();
      expect(lastWeek[6]).toBeNull();
    });
  });

  describe('END_LABEL_KEYS (AC-8)', () => {
    it('maps all non-delivered end labels to their translation keys', () => {
      expect(END_LABEL_KEYS.CANCELLED_AFTER_PICKUP).toBe(
        'earnings_end_cancelled_after_pickup',
      );
      expect(END_LABEL_KEYS.CANCELLED).toBe('earnings_end_cancelled');
      expect(END_LABEL_KEYS.REMOVED).toBe('earnings_end_removed');
      expect(END_LABEL_KEYS.HANDED_BACK).toBe('earnings_end_handed_back');
      expect(END_LABEL_KEYS.REASSIGNED).toBe('earnings_end_reassigned');
      expect(END_LABEL_KEYS.FAILED).toBe('earnings_end_failed');
      expect(END_LABEL_KEYS.ENDED).toBe('earnings_end_ended');
      expect(END_LABEL_KEYS.IN_PROGRESS).toBe('earnings_end_in_progress');
    });
  });
});
