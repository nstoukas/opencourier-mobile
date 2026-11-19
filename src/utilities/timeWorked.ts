import moment from 'moment';
import { CurrentTimeWorked } from '@app/types/timeWorked';

// Spec 0040: the co-op's days run midnight to midnight in this timezone, as the server counts them.
export const COOP_TIMEZONE = 'Europe/Athens';
// The Earnings section shows 7 days at a time; "Earlier" loads the 7 before (AC-11).
export const TIME_WORKED_PAGE_DAYS = 7;
// While a shift is open the counter asks the server again this often (AC-10): an admin's change or a
// cut off sends no socket message.
export const CURRENT_REFETCH_MS = 5 * 60 * 1000;
// How often the counter redraws its own minutes between fetches.
export const COUNTER_TICK_MS = 30 * 1000;
// € per hour is shown once work time reaches a minute (AC-6).
const MIN_SECONDS_FOR_RATE = 60;

// "48 min" under an hour, "3h12" from an hour (AC-10).
export const formatWorkDuration = (seconds: number): string => {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h${String(minutes % 60).padStart(2, '0')}`;
};

export const centsPerHourOf = (
  moneyCents: number,
  workSeconds: number,
): number | null =>
  workSeconds < MIN_SECONDS_FOR_RATE
    ? null
    : Math.round((moneyCents * 3600) / workSeconds);

// What the counter shows now, from the last snapshot plus the time since it arrived (AC-10). The
// phone's own elapsed time is used, never its clock against the server's, so a phone set wrong
// cannot move the figure.
export type CounterView =
  | { kind: 'none' }
  | {
      kind: 'working';
      workSeconds: number;
      moneyCents: number;
      centsPerHour: number | null;
      currencyCode: string;
    }
  | { kind: 'break'; breakMinutes: number };

export const counterView = (
  snapshot: CurrentTimeWorked | undefined,
  fetchedAtMs: number,
  nowMs: number,
): CounterView => {
  const shift = snapshot?.shift;
  if (!snapshot || !shift) {
    return { kind: 'none' };
  }
  const sinceFetch = Math.max(0, nowMs - fetchedAtMs);
  if (shift.onBreakSince) {
    const breakMs =
      Date.parse(snapshot.asOf) - Date.parse(shift.onBreakSince) + sinceFetch;
    // The break reached the limit with no new Online: the shift has ended, so the counter goes.
    if (breakMs >= snapshot.shiftBreakMinutes * 60 * 1000) {
      return { kind: 'none' };
    }
    return { kind: 'break', breakMinutes: Math.floor(breakMs / 60000) };
  }
  const workSeconds = shift.workSeconds + Math.floor(sinceFetch / 1000);
  return {
    kind: 'working',
    workSeconds,
    moneyCents: shift.moneyCents,
    centsPerHour: centsPerHourOf(shift.moneyCents, workSeconds),
    currencyCode: shift.currencyCode,
  };
};

// Today's date in the co-op's timezone, YYYY-MM-DD. Falls back to the phone's own day if this
// JavaScript engine cannot convert timezones.
export const coopDate = (ms: number): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: COOP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(ms));
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    const date = `${part('year')}-${part('month')}-${part('day')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
  } catch {
    // fall through
  }
  return moment(ms).format('YYYY-MM-DD');
};

// A clock time, HH:mm, in the co-op's timezone, so a shift reads the same on a phone set to another
// zone as on the admin's screen. Falls back to the phone's own clock like coopDate.
export const coopClock = (ms: number): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: COOP_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(ms));
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    const time = `${part('hour')}:${part('minute')}`;
    if (/^\d{2}:\d{2}$/.test(time)) {
      return time;
    }
  } catch {
    // fall through
  }
  return moment(ms).format('HH:mm');
};

// A YYYY-MM-DD day moved by whole days, with no timezone involved.
export const addDays = (date: string, days: number): string =>
  moment.utc(date, 'YYYY-MM-DD').add(days, 'day').format('YYYY-MM-DD');

// The page of days for "Earlier" number `page` (0 = the last 7 days, ending today).
export const pageRange = (
  today: string,
  page: number,
): { from: string; to: string } => {
  const to = addDays(today, -page * TIME_WORKED_PAGE_DAYS);
  return { from: addDays(to, -(TIME_WORKED_PAGE_DAYS - 1)), to };
};

// "38%" for a share between 0 and 1.
export const formatShare = (share: number | null): string =>
  share === null ? '—' : `${Math.round(share * 100)}%`;
