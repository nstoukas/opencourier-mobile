// Spec 0042 removed the phone timezone helpers and the week helpers with the old Earnings screens: every
// day and time on those screens is now the co-op's (Europe/Athens, `utilities/timeWorked.ts`, whose
// `coopClock` is the app's 24 hour clock).
export const formatShift = 'HH:mm';
export const formatSpaced = 'D MMM YYYY';
