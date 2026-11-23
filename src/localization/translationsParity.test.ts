import en from './en/translations';
import el from './el/translations';
import { serverEn } from './server/en';
import { serverEl } from './server/el';
import {
  EVENT_MESSAGE_CODES,
  EVENT_PART_CODES,
} from '@app/types/event-messages';

// Extracts interpolation placeholders like {{count}} or {{readyAt, clock}} -> 'count', 'readyAt'
const extractPlaceholders = (text: string): string[] => {
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map(m => m.slice(2, -2).trim().split(',')[0].trim()).sort();
};

describe('Translation Parity and Completeness Guard (spec 0054, AC-8)', () => {
  const enKeys = Object.keys(en);
  const elKeys = Object.keys(el);

  it('contains the same set of keys in Greek and English translation files', () => {
    const missingInEl = enKeys.filter(k => !(k in el));
    const extraInEl = elKeys.filter(k => !(k in en));

    expect(missingInEl).toEqual([]);
    expect(extraInEl).toEqual([]);
    expect(elKeys.length).toBe(enKeys.length);
    expect(enKeys.length).toBeGreaterThan(1000);
  });

  it('contains no empty or whitespace-only translation strings in English', () => {
    for (const [_key, value] of Object.entries(en)) {
      expect(typeof value).toBe('string');
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });

  it('contains no empty or whitespace-only translation strings in Greek', () => {
    for (const [_key, value] of Object.entries(el)) {
      expect(typeof value).toBe('string');
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });

  it('matches interpolation placeholders between English and Greek for every key', () => {
    const mismatches: Array<{ key: string; en: string[]; el: string[] }> = [];

    for (const key of enKeys) {
      const enVal = (en as any)[key];
      const elVal = (el as any)[key];
      if (typeof enVal === 'string' && typeof elVal === 'string') {
        const enPlaceholders = extractPlaceholders(enVal);
        const elPlaceholders = extractPlaceholders(elVal);
        if (JSON.stringify(enPlaceholders) !== JSON.stringify(elPlaceholders)) {
          mismatches.push({ key, en: enPlaceholders, el: elPlaceholders });
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  describe('server texts parity (event messages, parts, errors)', () => {
    const serverEnEvents = serverEn.server.event as Record<string, string>;
    const serverElEvents = serverEl.server.event as Record<string, string>;
    const serverEnParts = serverEn.server.eventPart as Record<string, string>;
    const serverElParts = serverEl.server.eventPart as Record<string, string>;
    const serverEnErrors = serverEn.server.error as Record<string, string>;
    const serverElErrors = serverEl.server.error as Record<string, string>;

    it('every EVENT_MESSAGE_CODE has a non-empty template in both server/en and server/el', () => {
      const codeNames = Object.keys(EVENT_MESSAGE_CODES);
      expect(codeNames.length).toBe(80); // 80 since ACCEPTED_TOGETHER_AUTOMATICALLY (decision 128.0)

      for (const code of codeNames) {
        expect(serverEnEvents[code]).toBeDefined();
        expect(serverEnEvents[code].trim().length).toBeGreaterThan(0);

        expect(serverElEvents[code]).toBeDefined();
        expect(serverElEvents[code].trim().length).toBeGreaterThan(0);
      }
    });

    it('every EVENT_PART_CODE has a non-empty template in both server/en and server/el', () => {
      const partNames = Object.keys(EVENT_PART_CODES);
      expect(partNames.length).toBe(15);

      for (const part of partNames) {
        expect(serverEnParts[part]).toBeDefined();
        expect(serverEnParts[part].trim().length).toBeGreaterThan(0);

        expect(serverElParts[part]).toBeDefined();
        expect(serverElParts[part].trim().length).toBeGreaterThan(0);
      }
    });

    it('every error code exists with non-empty text in both server/en and server/el', () => {
      const enErrorKeys = Object.keys(serverEnErrors);
      const elErrorKeys = Object.keys(serverElErrors);

      expect(enErrorKeys.sort()).toEqual(elErrorKeys.sort());
      expect(enErrorKeys.length).toBeGreaterThan(40);

      for (const code of enErrorKeys) {
        expect(serverEnErrors[code].trim().length).toBeGreaterThan(0);
        expect(serverElErrors[code].trim().length).toBeGreaterThan(0);
      }
    });
  });
});
