import moment from 'moment';
// Importing moment's locale files makes them available; `setAppLocale` below switches the whole app
// between them. Each import also switches moment to that locale, so setAppLocale runs after them.
import 'moment/locale/en-gb';
import 'moment/locale/el';

// The locale the app formats numbers, money, dates and times in (row 66; spec 0054, AC-3), following
// the app's language: Greek ('el-GR': "3,38 €", "1,2 km") or British English ('en-GB': "€3.38",
// "1.2 km"). Both show 24 hour times, the day before the month and weeks that start on Monday, never
// US formats. Every time is on the co-op's clock, Europe/Athens (timeWorked.ts: coopDate, coopClock).
// This file imports nothing of i18next, so the formatters stay plain functions; appLanguage.ts calls
// setAppLocale together with i18next's changeLanguage.
const LOCALES = { el: 'el-GR', en: 'en-GB' } as const;
const MOMENT_LOCALES = { el: 'el', en: 'en-gb' } as const;
// `keyof typeof LOCALES` is 'el' | 'en', the keys of the object above.
type LocaleLanguage = keyof typeof LOCALES;

let current: LocaleLanguage = 'el';

/** The Intl locale for the language on show, e.g. 'el-GR'. Read it at the moment of formatting. */
export const appLocale = (): string => LOCALES[current];

/** Switches every format (Intl and moment's month and day names) to a language. */
export const setAppLocale = (language: LocaleLanguage): void => {
  current = language;
  moment.locale(MOMENT_LOCALES[language]);
};
setAppLocale('el');

/**
 * Kilometres as the rider reads them, always with one decimal and the language's decimal mark:
 * 1.234 is "1,2" in Greek and "1.2" in English (spec 0054, AC-3). The one place a distance becomes text;
 * the caller adds "km" (or its sentence does).
 */
export const kmNumber = (km: number): string =>
  new Intl.NumberFormat(appLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(km);

// Used only when an amount arrives without its currency. The instance's own
// currency, set in its Config, always wins.
export const FALLBACK_CURRENCY = 'EUR';
