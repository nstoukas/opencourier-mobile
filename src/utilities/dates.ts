import { APP_LOCALE } from './locale';

// Spec 0042 removed the phone timezone helpers and the week helpers with the old Earnings screens: every
// day and time on those screens is now the co-op's (Europe/Athens, `utilities/timeWorked.ts`).
// `formatEarnings` and `formatTime` have no caller left but stay, because `locale.test.ts` pins the
// app's 24 hour clock through them.
export const formatEarnings = 'D MMM';
export const formatShift = 'HH:mm';
export const formatSpaced = 'D MMM YYYY';

export const formatTime = (time: string) =>
  new Date(time).toLocaleTimeString(APP_LOCALE, { timeStyle: 'short' });
