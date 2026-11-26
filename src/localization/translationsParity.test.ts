import fs from 'fs';
import path from 'path';
import os from 'os';
import vm from 'vm';
import ts from 'typescript';
import {
  assertBackendFilesPresent,
  BackendLocationOptions,
  resolveBackendLocation,
  warnBackendAbsentOnce,
} from '../testing/backendCopies';
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

// Every leaf of a nested translation object as `a.b.c` -> string.
// Note: leaves() keeps string values only; the per-group toEqual assertions catch any other value types.
function leaves(node: unknown, prefix = ''): Map<string, string> {
  const found = new Map<string, string>();
  if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      const name = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        // Collect leaf nodes from sub-objects using forEach to avoid downlevelIteration issues
        leaves(value, name).forEach((subVal, subKey) => {
          found.set(subKey, subVal);
        });
      } else if (typeof value === 'string') {
        found.set(name, value);
      }
    }
  }
  return found;
}

interface DifferenceReport {
  missingInApp: string[];
  extraInApp: string[];
  mismatches: Array<{ code: string; backend: string; app: string }>;
}

// Compares flattened key-value leaves between backend and mobile translations
function compareLeaves(
  backendLeaves: Map<string, string>,
  appLeaves: Map<string, string>,
): DifferenceReport {
  const backendKeys = Array.from(backendLeaves.keys()).sort();
  const appKeys = Array.from(appLeaves.keys()).sort();

  const missingInApp = backendKeys.filter(k => !appLeaves.has(k));
  const extraInApp = appKeys.filter(k => !backendLeaves.has(k));
  const mismatches: Array<{ code: string; backend: string; app: string }> = [];

  for (const key of backendKeys) {
    if (appLeaves.has(key)) {
      const bVal = backendLeaves.get(key);
      const aVal = appLeaves.get(key);
      if (bVal !== aVal) {
        mismatches.push({
          code: key,
          backend: bVal ?? '',
          app: aVal ?? '',
        });
      }
    }
  }

  return { missingInApp, extraInApp, mismatches };
}

// Runs the transpiled file in a bare context (no require): this executes the co-op's own backend file
// and is not a security boundary. It is fine while the backend's files are plain data; if the evaluated
// file calls require (a value import), the test fails with a clear message naming the file, not a bare
// ReferenceError.
function loadTypeScriptFile<T = Record<string, unknown>>(filePath: string): T {
  const code = fs.readFileSync(filePath, 'utf-8');
  // Transpile TypeScript source down to CommonJS JavaScript
  const js = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const exportsObj: Record<string, unknown> = {};
  const moduleObj = { exports: exportsObj };
  const customRequire = (id: string) => {
    throw new Error(
      `Evaluating ${filePath} attempted to call require('${id}'). ` +
        'This loader runs the co-op plain data files and does not support value imports.',
    );
  };
  const context = vm.createContext({
    exports: exportsObj,
    module: moduleObj,
    require: customRequire,
  });
  try {
    vm.runInContext(js, context);
  } catch (err: any) {
    if (
      err &&
      err.message &&
      err.message.includes('attempted to call require')
    ) {
      throw err;
    }
    throw new Error(
      `Failed to evaluate ${filePath}: ${err ? err.message : String(err)}`,
    );
  }
  // Type assertion: trust the exported module shape for test comparison
  return moduleObj.exports as T;
}

// Where the backend's three localization files are, under the shared skip rules
// (src/testing/backendCopies.ts). Each BACKEND_*_PATH points at one file directly (a scratch copy in a test).
function getBackendPaths(options?: BackendLocationOptions) {
  const env = options?.env ?? process.env;
  const location = resolveBackendLocation({
    ...options,
    env,
    fileOverrideVars: [
      'BACKEND_EN_PATH',
      'BACKEND_EL_PATH',
      'BACKEND_MESSAGES_PATH',
    ],
  });
  const { backendDir } = location;
  return {
    ...location,
    backendEnPath:
      env.BACKEND_EN_PATH || path.join(backendDir, 'src/localization/en.ts'),
    backendElPath:
      env.BACKEND_EL_PATH || path.join(backendDir, 'src/localization/el.ts'),
    backendMessagesPath:
      env.BACKEND_MESSAGES_PATH ||
      path.join(backendDir, 'src/shared-types/event-messages.ts'),
  };
}

// Verifies required backend files exist; only checks directory existence when paths are derived from it.
function assertBackendFilesExist(paths: ReturnType<typeof getBackendPaths>) {
  assertBackendFilesPresent(
    paths,
    (
      [
        ['en.ts', paths.backendEnPath],
        ['el.ts', paths.backendElPath],
        ['event-messages.ts', paths.backendMessagesPath],
      ] as const
    ).map(([name, filePath]) => ({
      missingMessage: `Backend localization file missing: ${name}`,
      filePath,
    })),
  );
}

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

      expect(enMap.location_off_hint).toBe(
        "Opens the phone's location settings",
      );
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
      expect(codeNames.length).toBe(85); // 85 since ACCEPT_GIVEN_BACK (row 172 reviews)

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

    const backendPaths = getBackendPaths();
    if (backendPaths.shouldSkip) {
      warnBackendAbsentOnce(backendPaths.backendDir, 'server copy checks');
    }

    const itBackendCopy = backendPaths.shouldSkip ? it.skip : it;

    itBackendCopy(
      'verifies ADD_ON_JOINED params and sentences match opencourier-backend copies when present (row 146)',
      () => {
        const backendEnContent = fs.readFileSync(
          backendPaths.backendEnPath,
          'utf-8',
        );
        const backendElContent = fs.readFileSync(
          backendPaths.backendElPath,
          'utf-8',
        );
        const backendMessagesContent = fs.readFileSync(
          backendPaths.backendMessagesPath,
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

describe('Backend path resolution and skip guard', () => {
  it('skips when default backend dir is absent and no override is set', () => {
    const paths = getBackendPaths({
      defaultDir: path.resolve(
        __dirname,
        '../../../nonexistent-backend-for-test',
      ),
      env: {},
    });
    expect(paths.shouldSkip).toBe(true);
    expect(paths.dirExists).toBe(false);
  });

  it('turns skip into failure when REQUIRE_BACKEND=1 even if backend dir is absent', () => {
    const paths = getBackendPaths({
      defaultDir: path.resolve(
        __dirname,
        '../../../nonexistent-backend-for-test',
      ),
      env: { REQUIRE_BACKEND: '1' },
    });
    expect(paths.shouldSkip).toBe(false);
    expect(paths.requireBackend).toBe(true);
    expect(paths.dirExists).toBe(false);
  });

  it('does not skip when an override path is set, even if the directory does not exist', () => {
    const paths = getBackendPaths({
      env: { OPENCOURIER_BACKEND_DIR: '/nonexistent/override/dir' },
    });
    expect(paths.shouldSkip).toBe(false);
    expect(paths.hasOverride).toBe(true);
    expect(paths.dirExists).toBe(false);
  });

  it('detects missing required file in present directory', () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'oc-scratch-backend-'),
    );
    try {
      const paths = getBackendPaths({
        env: { OPENCOURIER_BACKEND_DIR: tempDir },
      });
      expect(paths.shouldSkip).toBe(false);
      expect(paths.dirExists).toBe(true);
      expect(fs.existsSync(paths.backendEnPath)).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('does not fail existence check when all three per file overrides exist even if default dir is absent', () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'oc-scratch-overrides-'),
    );
    try {
      const enPath = path.join(tempDir, 'en.ts');
      const elPath = path.join(tempDir, 'el.ts');
      const msgPath = path.join(tempDir, 'event-messages.ts');
      fs.writeFileSync(enPath, 'export const en = {};');
      fs.writeFileSync(elPath, 'export const el = {};');
      fs.writeFileSync(
        msgPath,
        'export const EVENT_MESSAGE_CODES = {}; export const EVENT_PART_CODES = {};',
      );

      const paths = getBackendPaths({
        defaultDir: path.resolve(
          __dirname,
          '../../../nonexistent-backend-for-test',
        ),
        env: {
          BACKEND_EN_PATH: enPath,
          BACKEND_EL_PATH: elPath,
          BACKEND_MESSAGES_PATH: msgPath,
        },
      });
      expect(paths.shouldSkip).toBe(false);
      expect(paths.allFilesOverridden).toBe(true);
      expect(paths.dirExists).toBe(false);
      expect(fs.existsSync(paths.backendEnPath)).toBe(true);
      expect(fs.existsSync(paths.backendElPath)).toBe(true);
      expect(fs.existsSync(paths.backendMessagesPath)).toBe(true);

      expect(() => assertBackendFilesExist(paths)).not.toThrow();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Row 163: Every copied server sentence is checked against the backend', () => {
  const backendPaths = getBackendPaths();

  if (backendPaths.shouldSkip) {
    warnBackendAbsentOnce(backendPaths.backendDir, 'server copy checks');
  }

  const itRow163 = backendPaths.shouldSkip ? it.skip : it;

  itRow163('ensures backend directory and localization files exist', () => {
    assertBackendFilesExist(backendPaths);
  });

  it('fails with a clear message naming the file if an evaluated file calls require', () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'oc-scratch-require-'),
    );
    const scratchRequireFile = path.join(tempDir, 'scratch-require.ts');
    fs.writeFileSync(
      scratchRequireFile,
      'const crypto = require("crypto"); export const data = { crypto };',
    );
    try {
      expect(() => loadTypeScriptFile(scratchRequireFile)).toThrow(
        /attempted to call require\('crypto'\)/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  let cachedBackendEn: { en: { server: Record<string, unknown> } } | null =
    null;
  let cachedBackendEl: { el: { server: Record<string, unknown> } } | null =
    null;
  let cachedBackendMessages: {
    EVENT_MESSAGE_CODES: Record<string, readonly string[]>;
    EVENT_PART_CODES: Record<string, readonly string[]>;
  } | null = null;

  function getBackendEn() {
    if (!cachedBackendEn) {
      if (!fs.existsSync(backendPaths.backendEnPath)) {
        throw new Error(
          `Backend localization file missing: en.ts (checked ${backendPaths.backendEnPath})`,
        );
      }
      cachedBackendEn = loadTypeScriptFile<{
        en: { server: Record<string, unknown> };
      }>(backendPaths.backendEnPath);
    }
    return cachedBackendEn;
  }

  function getBackendEl() {
    if (!cachedBackendEl) {
      if (!fs.existsSync(backendPaths.backendElPath)) {
        throw new Error(
          `Backend localization file missing: el.ts (checked ${backendPaths.backendElPath})`,
        );
      }
      cachedBackendEl = loadTypeScriptFile<{
        el: { server: Record<string, unknown> };
      }>(backendPaths.backendElPath);
    }
    return cachedBackendEl;
  }

  function getBackendMessages() {
    if (!cachedBackendMessages) {
      if (!fs.existsSync(backendPaths.backendMessagesPath)) {
        throw new Error(
          `Backend localization file missing: event-messages.ts (checked ${backendPaths.backendMessagesPath})`,
        );
      }
      cachedBackendMessages = loadTypeScriptFile<{
        EVENT_MESSAGE_CODES: Record<string, readonly string[]>;
        EVENT_PART_CODES: Record<string, readonly string[]>;
      }>(backendPaths.backendMessagesPath);
    }
    return cachedBackendMessages;
  }

  itRow163(
    'ensures backend and app define the exact same set of server groups',
    () => {
      const backendEnModule = getBackendEn();
      const backendElModule = getBackendEl();

      const expectedEnGroups = Object.keys(backendEnModule.en.server).sort();
      const expectedElGroups = Object.keys(backendElModule.el.server).sort();

      expect(Object.keys(serverEn.server).sort()).toEqual(expectedEnGroups);
      expect(Object.keys(serverEl.server).sort()).toEqual(expectedElGroups);
    },
  );

  itRow163(
    'compares every copied English server sentence with the backend word for word',
    () => {
      const backendEnModule = getBackendEn();
      const backendLeaves = leaves(backendEnModule.en.server);
      const appLeaves = leaves(serverEn.server);

      const { missingInApp, extraInApp, mismatches } = compareLeaves(
        backendLeaves,
        appLeaves,
      );

      expect(missingInApp).toEqual([]);
      expect(extraInApp).toEqual([]);
      expect(mismatches).toEqual([]);
    },
  );

  itRow163(
    'compares every copied Greek server sentence with the backend word for word',
    () => {
      const backendElModule = getBackendEl();
      const backendLeaves = leaves(backendElModule.el.server);
      const appLeaves = leaves(serverEl.server);

      const { missingInApp, extraInApp, mismatches } = compareLeaves(
        backendLeaves,
        appLeaves,
      );

      expect(missingInApp).toEqual([]);
      expect(extraInApp).toEqual([]);
      expect(mismatches).toEqual([]);
    },
  );

  // Check each server group individually so test failure output pinpoints the exact group
  // 'as const' tells TypeScript the array items are literal string values, not generic strings
  const copiedGroups = [
    'event',
    'eventPart',
    'enum',
    'error',
    'notice',
    'board',
    'mail',
  ] as const;

  for (const group of copiedGroups) {
    itRow163(
      `matches English server.${group} sentences word for word with backend`,
      () => {
        const backendEnModule = getBackendEn();
        const backendGroup = backendEnModule.en.server[group];
        const appGroup = (serverEn.server as Record<string, unknown>)[group];

        const backendLeaves = leaves(backendGroup);
        const appLeaves = leaves(appGroup || {});

        const { missingInApp, extraInApp, mismatches } = compareLeaves(
          backendLeaves,
          appLeaves,
        );

        expect(missingInApp).toEqual([]);
        expect(extraInApp).toEqual([]);
        expect(mismatches).toEqual([]);
        expect(appGroup).toEqual(backendGroup);
      },
    );

    itRow163(
      `matches Greek server.${group} sentences word for word with backend`,
      () => {
        const backendElModule = getBackendEl();
        const backendGroup = backendElModule.el.server[group];
        const appGroup = (serverEl.server as Record<string, unknown>)[group];

        const backendLeaves = leaves(backendGroup);
        const appLeaves = leaves(appGroup || {});

        const { missingInApp, extraInApp, mismatches } = compareLeaves(
          backendLeaves,
          appLeaves,
        );

        expect(missingInApp).toEqual([]);
        expect(extraInApp).toEqual([]);
        expect(mismatches).toEqual([]);
        expect(appGroup).toEqual(backendGroup);
      },
    );
  }

  itRow163(
    'ensures EVENT_MESSAGE_CODES and EVENT_PART_CODES match the backend exactly',
    () => {
      const backendMsgModule = getBackendMessages();

      // EVENT_MESSAGE_CODES comparison
      const backendMsgCodes = Object.keys(
        backendMsgModule.EVENT_MESSAGE_CODES,
      ).sort();
      const appMsgCodes = Object.keys(EVENT_MESSAGE_CODES).sort();

      const missingMsgCodes = backendMsgCodes.filter(
        c => !(c in EVENT_MESSAGE_CODES),
      );
      const extraMsgCodes = appMsgCodes.filter(
        c => !(c in backendMsgModule.EVENT_MESSAGE_CODES),
      );

      expect(missingMsgCodes).toEqual([]);
      expect(extraMsgCodes).toEqual([]);
      expect(EVENT_MESSAGE_CODES).toEqual(backendMsgModule.EVENT_MESSAGE_CODES);

      // EVENT_PART_CODES comparison
      const backendPartCodes = Object.keys(
        backendMsgModule.EVENT_PART_CODES,
      ).sort();
      const appPartCodes = Object.keys(EVENT_PART_CODES).sort();

      const missingPartCodes = backendPartCodes.filter(
        c => !(c in EVENT_PART_CODES),
      );
      const extraPartCodes = appPartCodes.filter(
        c => !(c in backendMsgModule.EVENT_PART_CODES),
      );

      expect(missingPartCodes).toEqual([]);
      expect(extraPartCodes).toEqual([]);
      expect(EVENT_PART_CODES).toEqual(backendMsgModule.EVENT_PART_CODES);
    },
  );
});
