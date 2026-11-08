// Spec 0027: an Athens date ("2026-11-07") as "Sat 7 Nov". Worked out from the text in UTC, so the
// phone's own time zone can never move the day. English, as the app is (i18n.ts).
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const dayLabel = (date: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return date;
  }
  const day = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return `${WEEKDAYS[day.getUTCDay()]} ${day.getUTCDate()} ${
    MONTHS[day.getUTCMonth()]
  }`;
};
