import fs from 'fs';
import path from 'path';
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

  // Row 137: the item size words and the minutes wording came in, in both languages; Support left both.
  describe('row 137 keys', () => {
    const enMap = en as Record<string, string>;
    const elMap = el as Record<string, string>;

    it('both languages have the three item size words and the minutes wording', () => {
      expect(enMap.item_size_SMALL).toBe('Small');
      expect(enMap.item_size_MEDIUM).toBe('Medium');
      expect(enMap.item_size_LARGE).toBe('Large');
      expect(elMap.item_size_SMALL).toBe('Μικρό');
      expect(elMap.item_size_MEDIUM).toBe('Μεσαίο');
      expect(elMap.item_size_LARGE).toBe('Μεγάλο');
      expect(enMap.work_duration_minutes).toBe('{{minutes}} min');
      expect(elMap.work_duration_minutes).toBe('{{minutes}} λ.');
    });

    it('neither language keeps a "support" key or a Support label', () => {
      expect(enKeys).not.toContain('support');
      expect(elKeys).not.toContain('support');
      expect(enKeys.filter(k => /support/i.test(k))).toEqual([]);
      expect(elKeys.filter(k => /support/i.test(k))).toEqual([]);
      expect(Object.values(enMap).filter(v => /^support$/i.test(v))).toEqual(
        [],
      );
      expect(Object.values(elMap).filter(v => /^υποστήριξη$/i.test(v))).toEqual(
        [],
      );
    });
  });

  // Row 156: Location off warning banner and button translations (Done when Clause 1).
  describe('row 156 keys', () => {
    const enMap = en as Record<string, string>;
    const elMap = el as Record<string, string>;

    it('both languages define location_off_banner, location_off_turn_on, and location_off_hint', () => {
      expect(enMap.location_off_banner).toBe('Location off');
      expect(elMap.location_off_banner).toBe('Τοποθεσία κλειστή');

      expect(enMap.location_off_turn_on).toBe('Turn on');
      expect(elMap.location_off_turn_on).toBe('Άνοιγμα');

      expect(enMap.location_off_hint).toBe("Opens the phone's location settings");
      expect(elMap.location_off_hint).toBe(
        'Ανοίγει τις ρυθμίσεις τοποθεσίας του τηλεφώνου',
      );
    });
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
      expect(codeNames.length).toBe(81); // 81 since ADD_ON_JOINED (row 146)

      for (const code of codeNames) {
        expect(serverEnEvents[code]).toBeDefined();
        expect(serverEnEvents[code].trim().length).toBeGreaterThan(0);

        expect(serverElEvents[code]).toBeDefined();
        expect(serverElEvents[code].trim().length).toBeGreaterThan(0);
      }
    });

    it('ADD_ON_JOINED event code has expected parameters and matching templates in server/en and server/el (row 146)', () => {
      expect((EVENT_MESSAGE_CODES as any).ADD_ON_JOINED).toEqual([
        'courierId',
        'addOnId',
      ]);
      expect(serverEnEvents.ADD_ON_JOINED).toBe(
        'Delivery {{addOnId}} was added to this job as one more order on the way; courier {{courierId}} has taken both',
      );
      expect(serverElEvents.ADD_ON_JOINED).toBe(
        'Η παραγγελία {{addOnId}} προστέθηκε σε αυτή τη δουλειά ως μία ακόμα παραγγελία στον δρόμο· ο διανομέας {{courierId}} έχει αναλάβει και τις δύο',
      );
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

  describe('row 146 ADD_ON_JOINED event and backend parity', () => {
    const serverEnEvents = serverEn.server.event as Record<string, string>;
    const serverElEvents = serverEl.server.event as Record<string, string>;

    it('both languages define earnings_event_ADD_ON_JOINED label for rider Earnings timeline (row 146)', () => {
      expect((en as any).earnings_event_ADD_ON_JOINED).toBe(
        'Another order added',
      );
      expect((el as any).earnings_event_ADD_ON_JOINED).toBe(
        'Προστέθηκε παραγγελία',
      );
    });

    const backendDir = path.resolve(__dirname, '../../../opencourier-backend');
    const backendEnPath = path.join(backendDir, 'src/localization/en.ts');
    const backendElPath = path.join(backendDir, 'src/localization/el.ts');
    const backendMessagesPath = path.join(
      backendDir,
      'src/shared-types/event-messages.ts',
    );

    const backendPresent =
      fs.existsSync(backendEnPath) &&
      fs.existsSync(backendElPath) &&
      fs.existsSync(backendMessagesPath);

    if (!backendPresent) {
      console.warn(
        '\n=================================================================================\n' +
          `WARNING: Backend localization files not found under ${backendDir}.\n` +
          'Skipping ADD_ON_JOINED backend copy consistency check because backend repo is absent.\n' +
          '=================================================================================\n',
      );
    }

    const itBackendCopy = backendPresent ? it : it.skip;

    itBackendCopy(
      'verifies ADD_ON_JOINED params and sentences match opencourier-backend copies when present (row 146)',
      () => {
        const backendEnContent = fs.readFileSync(backendEnPath, 'utf-8');
        const backendElContent = fs.readFileSync(backendElPath, 'utf-8');
        const backendMessagesContent = fs.readFileSync(
          backendMessagesPath,
          'utf-8',
        );

        // Extract backend message code params: ADD_ON_JOINED: ['courierId', 'addOnId'],
        const backendCodeMatch = backendMessagesContent.match(
          /ADD_ON_JOINED:\s*\[([^\]]+)\]/,
        );
        expect(backendCodeMatch).not.toBeNull();
        const backendParams = (backendCodeMatch?.[1] ?? '')
          .split(',')
          .map(s => s.trim().replace(/['"]/g, ''));
        expect((EVENT_MESSAGE_CODES as any).ADD_ON_JOINED).toEqual(
          backendParams,
        );

        // Extract backend sentences
        const backendEnSentenceMatch = backendEnContent.match(
          /ADD_ON_JOINED:\s*'([^']+)'/,
        );
        expect(backendEnSentenceMatch).not.toBeNull();
        expect(serverEnEvents.ADD_ON_JOINED).toBe(
          backendEnSentenceMatch?.[1] ?? '',
        );

        const backendElSentenceMatch = backendElContent.match(
          /ADD_ON_JOINED:\s*\n?\s*'([^']+)'/,
        );
        expect(backendElSentenceMatch).not.toBeNull();
        expect(serverElEvents.ADD_ON_JOINED).toBe(
          backendElSentenceMatch?.[1] ?? '',
        );
      },
    );
  });
});
