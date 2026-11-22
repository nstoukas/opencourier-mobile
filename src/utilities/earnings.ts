import moment from 'moment';
import {
  EarningsDay,
  EarningsJob,
  EarningsMonth,
  EarningsShift,
  EarningsWeek,
  JobEndLabel,
} from '@app/types/earnings';
import { addDays, coopClock, coopDate } from '@app/utilities/timeWorked';
import { kmNumber } from '@app/utilities/locale';

// Spec 0042: small pure helpers for the Earnings screen. Every figure comes from the server; these only
// pick which days, shifts and jobs a period shows, and how a value is written. Days are YYYY-MM-DD in
// the co-op's timezone (Europe/Athens), never the phone's (AC-2).

export type EarningsMode = 'day' | 'week';

export const monthOf = (date: string): string => date.slice(0, 7);

// The Monday of the week a day falls in (weeks run Monday to Sunday, AC-5).
export const weekStartOf = (date: string): string => {
  const day = moment.utc(date, 'YYYY-MM-DD').isoWeekday(); // 1 = Monday
  return addDays(date, -(day - 1));
};

// The days a period covers, oldest first.
export const periodDates = (mode: EarningsMode, date: string): string[] => {
  if (mode === 'day') {
    return [date];
  }
  const monday = weekStartOf(date);
  return [0, 1, 2, 3, 4, 5, 6].map(offset => addDays(monday, offset));
};

// The months a period needs: one for a day, two for a week that crosses a month's end.
export const monthsOfPeriod = (mode: EarningsMode, date: string): string[] => [
  ...new Set(periodDates(mode, date).map(monthOf)),
];

const jobKey = (job: EarningsJob) => `${job.deliveryId}:${job.acceptedAt}`;

export interface MergedMonths {
  reachFrom: string | null;
  recordedFrom: string | null;
  currencyCode: string;
  days: EarningsDay[];
  weeks: EarningsWeek[];
  shifts: EarningsShift[];
  jobsInNoShift: EarningsJob[];
}

// Two months' answers as one: a shift that crosses the month's end is in both, each with only its own
// month's jobs, so its jobs are joined back together.
export const mergeMonths = (months: EarningsMonth[]): MergedMonths => {
  const days = new Map<string, EarningsDay>();
  const weeks = new Map<string, EarningsWeek>();
  const shifts = new Map<string, EarningsShift>();
  const loose = new Map<string, EarningsJob>();
  for (const month of months) {
    month.days.forEach(day => days.set(day.date, day));
    month.weeks.forEach(week => weeks.set(week.weekStart, week));
    for (const shift of month.shifts) {
      const known = shifts.get(shift.startedAt);
      if (!known) {
        shifts.set(shift.startedAt, shift);
        continue;
      }
      const jobs = new Map(known.jobs.map(job => [jobKey(job), job]));
      shift.jobs.forEach(job => jobs.set(jobKey(job), job));
      shifts.set(shift.startedAt, { ...known, jobs: [...jobs.values()] });
    }
    month.jobsInNoShift.forEach(job => loose.set(jobKey(job), job));
  }
  const first = months[0];
  return {
    reachFrom: first?.reachFrom ?? null,
    recordedFrom: first?.recordedFrom ?? null,
    currencyCode: first?.currencyCode ?? 'EUR',
    days: [...days.values()],
    weeks: [...weeks.values()],
    shifts: [...shifts.values()],
    jobsInNoShift: [...loose.values()],
  };
};

export const jobDate = (job: { acceptedAt: string }): string =>
  coopDate(Date.parse(job.acceptedAt));

// A job's money: its delivery money plus every payment linked to it (spec 0040 AC-6).
export const jobMoneyCents = (job: EarningsJob): number =>
  job.compensations.reduce(
    (sum, c) => sum + c.amountCents,
    job.deliveryMoneyCents,
  );

// Accept to the job's end (or now, while held), in whole minutes, rounded as the server rounds them.
export const jobMinutes = (
  job: { acceptedAt: string; endedAt: string | null },
  nowMs: number,
): number =>
  Math.round(
    ((job.endedAt ? Date.parse(job.endedAt) : nowMs) -
      Date.parse(job.acceptedAt)) /
      60000,
  );

// The shifts that touch a day, oldest first, each with only the jobs accepted that day. A shift that
// began the day before is still listed (AC-6, "continues from").
export const shiftsOnDay = (
  shifts: EarningsShift[],
  date: string,
  nowMs: number,
): EarningsShift[] =>
  shifts
    .filter(
      shift =>
        coopDate(Date.parse(shift.startedAt)) <= date &&
        coopDate(shift.endedAt ? Date.parse(shift.endedAt) : nowMs) >= date,
    )
    .map(shift => ({
      ...shift,
      jobs: shift.jobs
        .filter(job => jobDate(job) === date)
        .sort((a, b) => (a.acceptedAt < b.acceptedAt ? -1 : 1)),
    }))
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));

// "1,2 km" in Greek, "1.2 km" in English, one decimal (AC-1; spec 0054, AC-3).
export const formatKm = (km: number): string => `${kmNumber(km)} km`;

// A wait in whole minutes (AC-1: the median is kept in seconds and shown in minutes).
export const waitMinutes = (seconds: number): number =>
  Math.round(seconds / 60);

// The translation key of each end label (AC-8). Delivered jobs have none.
export const END_LABEL_KEYS: Record<JobEndLabel, string> = {
  CANCELLED_AFTER_PICKUP: 'earnings_end_cancelled_after_pickup',
  CANCELLED: 'earnings_end_cancelled',
  REMOVED: 'earnings_end_removed',
  HANDED_BACK: 'earnings_end_handed_back',
  REASSIGNED: 'earnings_end_reassigned',
  FAILED: 'earnings_end_failed',
  ENDED: 'earnings_end_ended',
  IN_PROGRESS: 'earnings_end_in_progress',
};

// The month grid of the calendar (AC-7): weeks of seven days, Monday first; null pads the edges.
export const monthGrid = (month: string): (string | null)[][] => {
  const first = `${month}-01`;
  const daysInMonth = moment.utc(first, 'YYYY-MM-DD').daysInMonth();
  const lead = moment.utc(first, 'YYYY-MM-DD').isoWeekday() - 1;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 0; day < daysInMonth; day += 1) {
    cells.push(addDays(first, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
};

// The month before or after a YYYY-MM month.
export const addMonths = (month: string, count: number): string =>
  moment.utc(`${month}-01`, 'YYYY-MM-DD').add(count, 'month').format('YYYY-MM');

// The time on an "As of" note (AC-13): the co-op's clock time, with the day in front when the saved copy
// is from an earlier day than today (a saved copy can be up to 24 hours old).
export const asOfLabel = (savedAt: number, now: number = Date.now()): string =>
  coopDate(savedAt) === coopDate(now)
    ? coopClock(savedAt)
    : `${moment(coopDate(savedAt), 'YYYY-MM-DD').format('D MMM')}, ${coopClock(
        savedAt,
      )}`;

// Whether a job in no recorded shift was accepted on this co-op day, so the Week view keeps its day even
// when it earned nothing (AC-8).
export const noShiftJobOn = (jobs: EarningsJob[], date: string): boolean =>
  jobs.some(job => jobDate(job) === date);
