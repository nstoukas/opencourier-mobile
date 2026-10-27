import moment from 'moment';
// Importing moment's British locale file makes it available; `moment.locale` below
// switches the whole app to it.
import 'moment/locale/en-gb';

// The one locale the app formats numbers, money, dates and times in (row 66).
// British English: the interface is English, and this shows 24 hour times, the
// day before the month and weeks that start on Monday, never US formats.
// Row 47 (the Greek interface) changes this together with the language.
export const APP_LOCALE = 'en-GB';
moment.locale('en-gb');

// Used only when an amount arrives without its currency. The instance's own
// currency, set in its Config, always wins.
export const FALLBACK_CURRENCY = 'EUR';
