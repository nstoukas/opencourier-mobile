// The server's words in the rider's language (spec 0054, AC-6). A refusal arrives as
// `{ error: true, result: [{ code, message, statusCode, params? }] }`; when the app has a text for its
// `code` (the `server` namespace, copied from the backend's src/localization), that text is shown with
// the refusal's `params` filled in; otherwise the server's own sentence, which is English.
// The templates use the backend renderer's syntax: `{{name}}`, `{{name, clock}}` (an ISO time as HH:mm on
// the co-op's clock) and `$t(server.x.{{name}})` (another key). This renders them the same way, line for
// line, rather than through i18next's own interpolation (decision 47.31).
// No courier answer carries a delivery record line (the rider's timeline words events by type, spec
// 0042), so only refusals use this today (decision 47.35).
import i18n from 'i18next';
import { coopClock } from '@app/utilities/timeWorked';
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

const formatValue = (value: unknown, format: string | undefined): string => {
  if (value === undefined || value === null) {
    return '';
  }
  if (format === 'clock' && typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? value : coopClock(ms);
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
      formatValue(params[name], format),
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
