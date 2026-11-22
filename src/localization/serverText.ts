// The server's words in the rider's language (spec 0054, AC-6). A refusal arrives as
// `{ error: true, result: [{ code, message, statusCode, params? }] }`; when the app has a text for its
// `code` (the `server` namespace, copied from the backend's src/localization), that text is shown with
// the refusal's `params` filled in; otherwise the server's own sentence, which is English.
// The templates use the backend renderer's syntax: `{{name}}`, `{{name, clock}}` (an ISO time as HH:mm on
// the co-op's clock), `{{name, money}}` (cents, with the sibling `currency` value), `{{name, decimal}}` (a
// number with the language's decimal mark), `{{name, day}}` ("today", "tomorrow", "on 3 August", on the
// co-op's clock), `{{name, when}}` (HH:mm, and its day when that is not today) and `$t(server.x.{{name}})`
// (another key). This renders them the same way, line for line, rather than through i18next's own
// interpolation (decision 47.31).
// No courier answer carries a delivery record line (the rider's timeline words events by type, spec
// 0042), so only refusals use this today (decision 47.35).
import i18n from 'i18next';
import moment from 'moment';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { appLocale } from '@app/utilities/locale';
import {
  addDays,
  COOP_TIMEZONE,
  coopClock,
  coopDate,
} from '@app/utilities/timeWorked';
import { toAppLanguage, type AppLanguage } from './appLanguage';

// Values a template fills in: the refusal's `params` (numbers, words, ISO times).
type ServerParams = Record<string, unknown>;

// The raw template of a `server.*` key in a language, or null. getResource reads the texts as stored,
// before i18next fills anything in.
const lookup = (language: AppLanguage, key: string): string | null => {
  const value: unknown = i18n.getResource(
    language,
    'server',
    key.replace(/^server\./, ''),
  );
  return typeof value === 'string' ? value : null;
};

const PLACEHOLDER = /\{\{\s*(\w+)\s*(?:,\s*(\w+)\s*)?\}\}/g;

// Each language's words for a day seen from today, as the backend's renderer has them.
const DAY_WORDS: Record<
  AppLanguage,
  { today: string; tomorrow: string; on: string }
> = {
  el: { today: 'σήμερα', tomorrow: 'αύριο', on: 'στις' },
  en: { today: 'today', tomorrow: 'tomorrow', on: 'on' },
};

// "3 Αυγούστου" / "3 August" on the co-op's clock; moment's month names if Intl cannot convert zones.
const dayAndMonth = (ms: number): string => {
  try {
    return new Intl.DateTimeFormat(appLocale(), {
      day: 'numeric',
      month: 'long',
      timeZone: COOP_TIMEZONE,
    }).format(new Date(ms));
  } catch {
    return moment(ms).format('D MMMM');
  }
};

/** "today", "tomorrow", or "on 3 August" (Greek "στις 3 Αυγούστου"), seen from now on the co-op's clock. */
export const dayText = (ms: number, language: AppLanguage): string => {
  const words = DAY_WORDS[language];
  const today = coopDate(Date.now());
  const day = coopDate(ms);
  if (day === today) {
    return words.today;
  }
  if (day === addDays(today, 1)) {
    return words.tomorrow;
  }
  return `${words.on} ${dayAndMonth(ms)}`;
};

/** HH:mm on the co-op's clock, followed by its day when that is not today ("09:00 αύριο"). */
export const whenText = (ms: number, language: AppLanguage): string => {
  const day = dayText(ms, language);
  return day === DAY_WORDS[language].today
    ? coopClock(ms)
    : `${coopClock(ms)} ${day}`;
};

const formatValue = (
  value: unknown,
  format: string | undefined,
  params: ServerParams,
  language: AppLanguage,
): string => {
  if (value === undefined || value === null) {
    return '';
  }
  if (
    (format === 'clock' || format === 'day' || format === 'when') &&
    typeof value === 'string'
  ) {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) {
      return value;
    }
    if (format === 'day') {
      return dayText(ms, language);
    }
    return format === 'when' ? whenText(ms, language) : coopClock(ms);
  }
  if (format === 'money' && typeof value === 'number') {
    const currency =
      typeof params.currency === 'string' ? params.currency : undefined;
    return formatCurrencyFromCents(value, currency);
  }
  if (format === 'decimal' && typeof value === 'number') {
    return new Intl.NumberFormat(appLocale(), {
      maximumFractionDigits: 1,
    }).format(value);
  }
  return String(value);
};

/** Whether the app has a text for a server key, such as `server.error.SHIFT_FULL`. */
export const hasServerText = (key: string): boolean =>
  lookup('en', key) !== null;

/** The text of a `server.*` key in the language on show, with its values filled in. */
export const renderServerText = (
  key: string,
  params: ServerParams = {},
): string => {
  const language = toAppLanguage(i18n.language);
  const template = lookup(language, key) ?? lookup('en', key);
  if (template === null) {
    return key;
  }
  const fill = (text: string) =>
    text.replace(PLACEHOLDER, (_match, name: string, format?: string) =>
      formatValue(params[name], format, params, language),
    );
  // Nested keys first, filling only the placeholders inside the key, so a value is never read as a key.
  const nested = template.replace(
    /\$t\(([^)]*)\)/g,
    (_match, nestedKey: string) => {
      const resolved = fill(nestedKey);
      return lookup(language, resolved) ?? lookup('en', resolved) ?? resolved;
    },
  );
  return fill(nested);
};

/** One item of a refusal's `result` list, as the server sends it. */
export type ServerRefusal = {
  code?: unknown;
  message?: unknown;
  params?: unknown;
};

/**
 * The words for one refusal in the rider's language: the app's text for its code (with its params),
 * else the server's own sentence, else undefined.
 */
export const refusalText = (
  refusal: ServerRefusal | undefined,
): string | undefined => {
  if (!refusal) {
    return undefined;
  }
  if (
    typeof refusal.code === 'string' &&
    hasServerText(`server.error.${refusal.code}`)
  ) {
    const params =
      typeof refusal.params === 'object' && refusal.params !== null
        ? (refusal.params as ServerParams)
        : {};
    return renderServerText(`server.error.${refusal.code}`, params);
  }
  const message = refusal.message;
  return typeof message === 'string' && message.trim() ? message : undefined;
};
