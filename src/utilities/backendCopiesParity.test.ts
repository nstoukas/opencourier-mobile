import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  foldForNameCheck as appFoldForNameCheck,
  findPersonalData as appFindPersonalData,
} from './addressNotes/personalDataCheck';
import { COMPLAINT_CATEGORIES as APP_COMPLAINT_CATEGORIES } from './complaints';
import {
  OFFER_PUSH_KEYS,
  parseOfferMessage,
} from '../services/offerPush/offerMessage';

// Babel runtime helper mock: enables Jest's Babel transform to evaluate files loaded outside the mobile repo.
jest.mock(
  '@babel/runtime/helpers/interopRequireDefault',
  () => (obj: any) => obj && obj.__esModule ? obj : { default: obj },
  { virtual: true },
);

/**
 * Scope row 180: "The courier app's other copies are checked against the backend".
 * Checks three copies against backend sources of truth:
 * 1. src/utilities/addressNotes/personalDataCheck.ts (logic copy of personal-data-check.ts)
 * 2. COMPLAINT_CATEGORIES in src/utilities/complaints.ts (copy of complaint-rules.ts)
 * 3. OFFER_PUSH_KEYS in src/services/offerPush/offerMessage.ts (copy of offer-card-payload.ts)
 */

interface BackendPathsOptions {
  defaultDir?: string;
  env?: Record<string, string | undefined>;
}

// Strips single-line (//...) and multi-line (/*...*/) comments from source code before regex parsing.
export function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
}

/**
 * Extracts COMPLAINT_CATEGORIES from backend complaint-rules.ts source code without requiring @prisma/types.
 */
export function parseBackendComplaintCategories(
  source: string,
): Record<string, string[]> {
  const clean = stripComments(source);
  // Match the COMPLAINT_CATEGORIES object declaration
  const matchObj = clean.match(
    /COMPLAINT_CATEGORIES[\s\S]*?=\s*\{([\s\S]*?)\}\s*as\s+const/,
  );
  if (!matchObj) {
    throw new Error(
      'Could not find COMPLAINT_CATEGORIES declaration in complaint-rules.ts',
    );
  }
  const body = matchObj[1];
  const result: Record<string, string[]> = {};

  // Matches [EnumComplaintAbout.SOMETHING]: [ ... ]
  const sectionRegex =
    /\[\s*EnumComplaintAbout\.([A-Za-z0-9_]+)\s*\]\s*:\s*\[([\s\S]*?)\]/g;
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionRegex.exec(body)) !== null) {
    const aboutKey = sectionMatch[1];
    const arrayBody = sectionMatch[2];
    const categories: string[] = [];
    const catRegex = /EnumComplaintCategory\.([A-Za-z0-9_]+)/g;
    let catMatch: RegExpExecArray | null;
    while ((catMatch = catRegex.exec(arrayBody)) !== null) {
      categories.push(catMatch[1]);
    }
    result[aboutKey] = categories;
  }

  return result;
}

/**
 * Extracts OFFER_CARD_PAYLOAD_KEYS from backend offer-card-payload.ts source code without requiring Nest/Prisma.
 */
export function parseBackendOfferCardPayloadKeys(source: string): string[] {
  const clean = stripComments(source);
  const matchObj = clean.match(
    /OFFER_CARD_PAYLOAD_KEYS[\s\S]*?=\s*\[([\s\S]*?)\]\s*as\s+const/,
  );
  if (!matchObj) {
    throw new Error(
      'Could not find OFFER_CARD_PAYLOAD_KEYS declaration in offer-card-payload.ts',
    );
  }
  const body = matchObj[1];
  const keys: string[] = [];
  const stringRegex = /'([^']+)'|"([^"]+)"|`([^`]+)`/g;
  let strMatch: RegExpExecArray | null;
  while ((strMatch = stringRegex.exec(body)) !== null) {
    keys.push(strMatch[1] || strMatch[2] || strMatch[3]);
  }
  return keys;
}

export interface ComplaintCategoriesDiff {
  missingAboutsInApp: string[];
  extraAboutsInApp: string[];
  mismatchedCategories: Array<{
    about: string;
    backend: readonly string[];
    app: readonly string[];
  }>;
}

// Compares complaint categories between backend and app both ways and in order.
export function compareComplaintCategories(
  backendCats: Record<string, string[]>,
  appCats: Record<string, readonly string[]>,
): ComplaintCategoriesDiff {
  const backendAbouts = Object.keys(backendCats);
  const appAbouts = Object.keys(appCats);

  const missingAboutsInApp = backendAbouts.filter(a => !(a in appCats));
  const extraAboutsInApp = appAbouts.filter(a => !(a in backendCats));
  const mismatchedCategories: Array<{
    about: string;
    backend: readonly string[];
    app: readonly string[];
  }> = [];

  for (const about of backendAbouts) {
    if (about in appCats) {
      const bList = backendCats[about];
      const aList = appCats[about];
      if (
        bList.length !== aList.length ||
        bList.some((val, idx) => val !== aList[idx])
      ) {
        mismatchedCategories.push({
          about,
          backend: bList,
          app: aList,
        });
      }
    }
  }

  return {
    missingAboutsInApp,
    extraAboutsInApp,
    mismatchedCategories,
  };
}

export interface KeysDiff {
  missingInApp: string[];
  extraInApp: string[];
  orderMismatches: Array<{ index: number; backend: string; app: string }>;
}

// Compares push payload keys between backend and app both ways and in order.
export function compareOfferPushKeys(
  backendKeys: string[],
  appKeys: readonly string[],
): KeysDiff {
  const backendSet = new Set(backendKeys);
  const appSet = new Set(appKeys);

  const missingInApp = backendKeys.filter(k => !appSet.has(k));
  const extraInApp = appKeys.filter(k => !backendSet.has(k));
  const orderMismatches: Array<{
    index: number;
    backend: string;
    app: string;
  }> = [];

  const maxLen = Math.max(backendKeys.length, appKeys.length);
  for (let i = 0; i < maxLen; i++) {
    if (backendKeys[i] !== appKeys[i]) {
      orderMismatches.push({
        index: i,
        backend: backendKeys[i] ?? '<missing>',
        app: appKeys[i] ?? '<missing>',
      });
    }
  }

  return {
    missingInApp,
    extraInApp,
    orderMismatches,
  };
}

/**
 * Resolves backend directory and target file paths following row 174's skip rules.
 * Default directory is 4 levels up from src/utilities/addressNotes (workspace root) plus opencourier-backend.
 */
export function getBackendPaths(options?: BackendPathsOptions) {
  const env = options?.env ?? process.env;
  // Four levels up from addressNotes corresponds to three levels up from src/utilities (workspace root)
  const defaultDir =
    options?.defaultDir ??
    path.resolve(__dirname, '../../../opencourier-backend');

  const hasOverride = Boolean(env.OPENCOURIER_BACKEND_DIR);
  const backendDir = env.OPENCOURIER_BACKEND_DIR || defaultDir;

  const backendPersonalDataCheckPath = path.join(
    backendDir,
    'src/domains/location-note/personal-data-check.ts',
  );
  const backendComplaintRulesPath = path.join(
    backendDir,
    'src/domains/complaint/complaint-rules.ts',
  );
  const backendOfferCardPayloadPath = path.join(
    backendDir,
    'src/domains/delivery/offer-card-payload.ts',
  );

  const dirExists = fs.existsSync(backendDir);
  const requireBackend = env.REQUIRE_BACKEND === '1';

  // Skip only when the backend folder itself is absent and no override is set.
  // When REQUIRE_BACKEND=1, never skip (it turns absence into a failure).
  const shouldSkip = !hasOverride && !dirExists && !requireBackend;

  return {
    backendDir,
    backendPersonalDataCheckPath,
    backendComplaintRulesPath,
    backendOfferCardPayloadPath,
    hasOverride,
    dirExists,
    requireBackend,
    shouldSkip,
  };
}

/**
 * Asserts backend directory and all three required parity files exist.
 */
// 'ReturnType<typeof getBackendPaths>' extracts the return type of getBackendPaths function.
export function assertBackendFilesExist(
  paths: ReturnType<typeof getBackendPaths>,
) {
  if (paths.requireBackend && !paths.dirExists) {
    throw new Error(
      `REQUIRE_BACKEND=1 is set, but backend directory was not found under ${paths.backendDir}`,
    );
  }
  if (!paths.dirExists) {
    throw new Error(
      `Backend directory was not found under ${paths.backendDir}`,
    );
  }
  if (!fs.existsSync(paths.backendPersonalDataCheckPath)) {
    throw new Error(
      `Backend personal data check file missing: personal-data-check.ts (checked ${paths.backendPersonalDataCheckPath})`,
    );
  }
  if (!fs.existsSync(paths.backendComplaintRulesPath)) {
    throw new Error(
      `Backend complaint rules file missing: complaint-rules.ts (checked ${paths.backendComplaintRulesPath})`,
    );
  }
  if (!fs.existsSync(paths.backendOfferCardPayloadPath)) {
    throw new Error(
      `Backend offer card payload file missing: offer-card-payload.ts (checked ${paths.backendOfferCardPayloadPath})`,
    );
  }
}

let loggedSkipWarning = false;
export function warnBackendAbsentOnce(backendDir: string) {
  if (!loggedSkipWarning) {
    loggedSkipWarning = true;
    console.warn(
      '\n=================================================================================\n' +
        `WARNING: Backend folder not found under ${backendDir}.\n` +
        'Skipping other copies parity checks because backend repo is absent.\n' +
        '=================================================================================\n',
    );
  }
}

// Dynamically loads the backend's personal-data-check.ts module while invalidating cache.
export function loadBackendPersonalDataCheck(filePath: string) {
  try {
    delete require.cache[require.resolve(filePath)];
  } catch {
    // Ignore if not previously cached
  }
  return require(filePath);
}

describe('Backend path resolution and skip guard (row 180)', () => {
  it('skips when default backend dir is absent and no override is set', () => {
    const paths = getBackendPaths({
      defaultDir: path.resolve(__dirname, '../../../nonexistent-backend-dir'),
      env: {},
    });
    expect(paths.shouldSkip).toBe(true);
    expect(paths.dirExists).toBe(false);
  });

  it('turns skip into failure when REQUIRE_BACKEND=1 even if backend dir is absent', () => {
    const paths = getBackendPaths({
      defaultDir: path.resolve(__dirname, '../../../nonexistent-backend-dir'),
      env: { REQUIRE_BACKEND: '1' },
    });
    expect(paths.shouldSkip).toBe(false);
    expect(paths.requireBackend).toBe(true);
    expect(paths.dirExists).toBe(false);
    expect(() => assertBackendFilesExist(paths)).toThrow(
      /REQUIRE_BACKEND=1 is set, but backend directory was not found/,
    );
  });

  it('does not skip when an override path is set, even if the directory does not exist', () => {
    const paths = getBackendPaths({
      env: { OPENCOURIER_BACKEND_DIR: '/nonexistent/override/backend' },
    });
    expect(paths.shouldSkip).toBe(false);
    expect(paths.hasOverride).toBe(true);
    expect(paths.dirExists).toBe(false);
    expect(() => assertBackendFilesExist(paths)).toThrow(
      /Backend directory was not found under \/nonexistent\/override\/backend/,
    );
  });

  it('detects missing personal-data-check.ts in present directory naming file and path', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-scratch-check-'));
    try {
      const paths = getBackendPaths({
        env: { OPENCOURIER_BACKEND_DIR: tempDir },
      });
      expect(paths.dirExists).toBe(true);
      expect(() => assertBackendFilesExist(paths)).toThrow(
        /Backend personal data check file missing: personal-data-check\.ts \(checked .*personal-data-check\.ts\)/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('detects missing complaint-rules.ts in present directory naming file and path', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-scratch-check-'));
    try {
      // Create personal-data-check.ts in directory structure
      const locDir = path.join(tempDir, 'src/domains/location-note');
      fs.mkdirSync(locDir, { recursive: true });
      fs.writeFileSync(path.join(locDir, 'personal-data-check.ts'), '// dummy');

      const paths = getBackendPaths({
        env: { OPENCOURIER_BACKEND_DIR: tempDir },
      });
      expect(() => assertBackendFilesExist(paths)).toThrow(
        /Backend complaint rules file missing: complaint-rules\.ts \(checked .*complaint-rules\.ts\)/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('detects missing offer-card-payload.ts in present directory naming file and path', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-scratch-check-'));
    try {
      // Create personal-data-check.ts and complaint-rules.ts
      const locDir = path.join(tempDir, 'src/domains/location-note');
      const compDir = path.join(tempDir, 'src/domains/complaint');
      fs.mkdirSync(locDir, { recursive: true });
      fs.mkdirSync(compDir, { recursive: true });
      fs.writeFileSync(path.join(locDir, 'personal-data-check.ts'), '// dummy');
      fs.writeFileSync(path.join(compDir, 'complaint-rules.ts'), '// dummy');

      const paths = getBackendPaths({
        env: { OPENCOURIER_BACKEND_DIR: tempDir },
      });
      expect(() => assertBackendFilesExist(paths)).toThrow(
        /Backend offer card payload file missing: offer-card-payload\.ts \(checked .*offer-card-payload\.ts\)/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('verifies assertBackendFilesExist succeeds when directory and all files exist', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-scratch-check-'));
    try {
      const locDir = path.join(tempDir, 'src/domains/location-note');
      const compDir = path.join(tempDir, 'src/domains/complaint');
      const delivDir = path.join(tempDir, 'src/domains/delivery');
      fs.mkdirSync(locDir, { recursive: true });
      fs.mkdirSync(compDir, { recursive: true });
      fs.mkdirSync(delivDir, { recursive: true });
      fs.writeFileSync(path.join(locDir, 'personal-data-check.ts'), '// dummy');
      fs.writeFileSync(path.join(compDir, 'complaint-rules.ts'), '// dummy');
      fs.writeFileSync(
        path.join(delivDir, 'offer-card-payload.ts'),
        '// dummy',
      );

      const paths = getBackendPaths({
        env: { OPENCOURIER_BACKEND_DIR: tempDir },
      });
      expect(() => assertBackendFilesExist(paths)).not.toThrow();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Parser and comparison difference reporting logic', () => {
  it('proves stripComments removes both line comments and block comments', () => {
    const raw = `
      // line comment
      const a = 1; /* inline block */ const b = 2;
      /*
       * multi-line
       * comment
       */
      const c = 3;
    `;
    const cleaned = stripComments(raw);
    expect(cleaned).not.toContain('line comment');
    expect(cleaned).not.toContain('inline block');
    expect(cleaned).not.toContain('multi-line');
    expect(cleaned).toContain('const a = 1;');
    expect(cleaned).toContain('const b = 2;');
    expect(cleaned).toContain('const c = 3;');
  });

  it('proves parseBackendComplaintCategories parses about keys and category lists in order', () => {
    const scratch = `
      // Header comment
      export const COMPLAINT_CATEGORIES = {
        [EnumComplaintAbout.RESTAURANT]: [
          EnumComplaintCategory.LONG_WAIT,
          // note
          EnumComplaintCategory.FOOD_NOT_READY,
          EnumComplaintCategory.OTHER,
        ],
        [EnumComplaintAbout.CUSTOMER]: [
          EnumComplaintCategory.ABUSE_OR_THREAT,
          EnumComplaintCategory.OTHER,
        ],
      } as const satisfies Record<EnumComplaintAbout, readonly EnumComplaintCategory[]>
    `;
    const parsed = parseBackendComplaintCategories(scratch);
    expect(Object.keys(parsed)).toEqual(['RESTAURANT', 'CUSTOMER']);
    expect(parsed.RESTAURANT).toEqual(['LONG_WAIT', 'FOOD_NOT_READY', 'OTHER']);
    expect(parsed.CUSTOMER).toEqual(['ABUSE_OR_THREAT', 'OTHER']);
  });

  it('proves parseBackendOfferCardPayloadKeys parses payload keys in order', () => {
    const scratch = `
      /* Header comment */
      export const OFFER_CARD_PAYLOAD_KEYS = [
        'deliveryId',
        // comment
        'offeredAt',
        'payTotal',
      ] as const
    `;
    const parsed = parseBackendOfferCardPayloadKeys(scratch);
    expect(parsed).toEqual(['deliveryId', 'offeredAt', 'payTotal']);
  });

  it('detects missing, extra, and mismatched complaint categories in compareComplaintCategories', () => {
    const backend = {
      RESTAURANT: ['LONG_WAIT', 'OTHER'],
      CUSTOMER: ['ABUSE_OR_THREAT'],
    };
    const appWithDiff = {
      RESTAURANT: ['OTHER', 'LONG_WAIT'], // reordered
      RIDER: ['LATE'], // extra about, missing CUSTOMER
    };

    const diff = compareComplaintCategories(backend, appWithDiff);
    expect(diff.missingAboutsInApp).toEqual(['CUSTOMER']);
    expect(diff.extraAboutsInApp).toEqual(['RIDER']);
    expect(diff.mismatchedCategories).toEqual([
      {
        about: 'RESTAURANT',
        backend: ['LONG_WAIT', 'OTHER'],
        app: ['OTHER', 'LONG_WAIT'],
      },
    ]);
  });

  it('detects missing, extra, and out-of-order keys in compareOfferPushKeys', () => {
    const backend = ['a', 'b', 'c'];
    const app = ['a', 'c', 'd'];

    const diff = compareOfferPushKeys(backend, app);
    expect(diff.missingInApp).toEqual(['b']);
    expect(diff.extraInApp).toEqual(['d']);
    expect(diff.orderMismatches).toEqual([
      { index: 1, backend: 'b', app: 'c' },
      { index: 2, backend: 'c', app: 'd' },
    ]);
  });
});

describe('App-side contracts and invariants (independent of backend)', () => {
  it('documents and verifies the shape of COMPLAINT_CATEGORIES in the courier app', () => {
    expect(APP_COMPLAINT_CATEGORIES).toBeDefined();
    const abouts = Object.keys(APP_COMPLAINT_CATEGORIES);
    expect(abouts).toEqual(['RESTAURANT', 'CUSTOMER', 'RIDER']);

    for (const about of abouts) {
      const categories =
        APP_COMPLAINT_CATEGORIES[
          about as keyof typeof APP_COMPLAINT_CATEGORIES
        ];
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      const unique = new Set(categories);
      expect(unique.size).toBe(categories.length);
      for (const cat of categories) {
        expect(typeof cat).toBe('string');
        expect(cat).toBe(cat.toUpperCase());
      }
    }
  });

  it('documents and verifies the shape of OFFER_PUSH_KEYS in the courier app', () => {
    expect(Array.isArray(OFFER_PUSH_KEYS)).toBe(true);
    expect(OFFER_PUSH_KEYS.length).toBeGreaterThan(0);
    const unique = new Set(OFFER_PUSH_KEYS);
    expect(unique.size).toBe(OFFER_PUSH_KEYS.length);

    expect(OFFER_PUSH_KEYS).toContain('deliveryId');
    expect(OFFER_PUSH_KEYS).toContain('offeredAt');
    expect(OFFER_PUSH_KEYS).toContain('payTotal');
  });

  it('verifies parseOfferMessage reads no keys outside OFFER_PUSH_KEYS plus "type" on NEW_DELIVERY_OFFER', () => {
    const readKeys = new Set<string>();
    const dummyPayload: Record<string, string> = {
      type: 'NEW_DELIVERY_OFFER',
      deliveryId: 'del-101',
      offeredAt: '2026-11-26T10:00:00.000Z',
      offerExpiresAt: '2026-11-26T10:02:00.000Z',
      serverNow: '2026-11-26T10:00:00.000Z',
      payTotal: '450',
      currencyCode: 'EUR',
      restaurantName: 'Volos Kitchen',
      dropoffArea: 'Port',
      distanceKm: '2.5',
      toPickupMetres: '400',
      toDropoffMetres: '2100',
      minutes: '12',
      insistent: '0',
      boxSize: 'MEDIUM',
      legNumber: '1',
      legCount: '1',
      offerGroupId: '',
      partnerDeliveryId: '',
      addOn: '0',
      calm: '0',
    };

    // 'Proxy' wraps the target object to intercept and log property access ('get').
    const proxy = new Proxy(dummyPayload, {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          readKeys.add(prop);
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    const parsed = parseOfferMessage(proxy);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe('offer');

    // Allowed keys are 'type' plus OFFER_PUSH_KEYS
    const allowedKeys = new Set<string>(['type', ...OFFER_PUSH_KEYS]);
    const disallowedKeysRead: string[] = [];

    for (const key of readKeys) {
      if (!allowedKeys.has(key)) {
        disallowedKeysRead.push(key);
      }
    }

    expect(disallowedKeysRead).toEqual([]);
  });
});

describe("Row 180: The courier app's other copies are checked against the backend", () => {
  const backendPaths = getBackendPaths();

  if (backendPaths.shouldSkip) {
    warnBackendAbsentOnce(backendPaths.backendDir);
  }

  const itBackend = backendPaths.shouldSkip ? it.skip : it;

  itBackend('ensures backend directory and all three files exist', () => {
    assertBackendFilesExist(backendPaths);
  });

  itBackend(
    'compares personalDataCheck logic with backend on fixed test table (Latin, Greek, phones, emails, marks)',
    () => {
      const backendMod = loadBackendPersonalDataCheck(
        backendPaths.backendPersonalDataCheckPath,
      );
      const backendFold = backendMod.foldForNameCheck;
      const backendFind = backendMod.findPersonalData;

      // Table of diverse test inputs covering plain Latin, Greek, accents, final sigma, special names, marks, phones, emails
      const testCases = [
        // Plain Latin names in various cases and accent forms
        'alex',
        'Alex',
        'ALEX',
        'maria',
        'Maria',
        'MARIA',
        'élena',
        'Élena',
        'ÉLENA',
        'chloé',
        'CHLOÉ',
        // Plain Greek names in various cases and accent forms, final sigma
        'γιώργος',
        'Γιώργος',
        'ΓΙΩΡΓΟΣ',
        'γιωργοσ',
        'νίκος',
        'Νίκος',
        'ΝΙΚΟΣ',
        'νικοσ',
        'κώστας',
        'Κώστας',
        'ΚΩΣΤΑΣ',
        'κωστασ',
        'μαρία',
        'Μαρία',
        'ΜΑΡΙΑ',
        'δημητρησ',
        'Δημήτρης',
        'ΔΗΜΗΤΡΗΣ',
        // Specific foreign names and letters outside Latin/Greek
        'ømaria',
        'Łukasz',
        'maria李',
        'ma\u20d0ria', // Combining left arrow above (outside U+0300..U+036F)
        // Cyrillic letters glued to names
        'бmaria',
        'mariaг',
        'дΓιώργος',
        'Γιώργοςж',
        // Phone numbers
        '+30 694 123 4567',
        '6941234567',
        '2421 012345',
        '694 - 123 - 4567',
        '+1 (555) 123-4567',
        // Email addresses
        'test@example.com',
        'rider.volos@domain.gr',
        'contact_me@company.org',
        // Digits and punctuation around names
        '4 floor, door 12',
        'maria, 2nd floor',
        'Call George at: 6941234567',
        'door code 1234 for maria!',
        'ring bell - Kostas',
        'floor 3 - maria - apt 4b',
        // Benign place/delivery notes
        'leave at door',
        'blue gate, second bell',
        'ring three times',
      ];

      const disagreements: string[] = [];

      for (const input of testCases) {
        const appFolded = appFoldForNameCheck(input);
        const backFolded = backendFold(input);
        if (appFolded !== backFolded) {
          disagreements.push(
            `fold mismatch on "${input}": app="${appFolded}", backend="${backFolded}"`,
          );
        }

        const appFound = appFindPersonalData(input);
        const backFound = backendFind(input);
        if (appFound.join(',') !== backFound.join(',')) {
          disagreements.push(
            `find mismatch on "${input}": app=[${appFound.join(
              ', ',
            )}], backend=[${backFound.join(', ')}]`,
          );
        }
      }

      if (disagreements.length > 0) {
        throw new Error(
          `Personal data check disagreements on fixed table (${disagreements.join(
            '; ',
          )}). Fix: copy the backend's logic from src/domains/location-note/personal-data-check.ts into src/utilities/addressNotes/personalDataCheck.ts`,
        );
      }

      expect(disagreements).toEqual([]);
    },
  );

  itBackend(
    'compares personalDataCheck logic with backend on full code point sweep U+0000..U+2FFFF',
    () => {
      const backendMod = loadBackendPersonalDataCheck(
        backendPaths.backendPersonalDataCheckPath,
      );
      const backendFind = backendMod.findPersonalData;

      const disagreements: string[] = [];

      for (let cp = 0; cp <= 0x2ffff; cp++) {
        // Exclude surrogate pair code points U+D800..U+DFFF
        if (cp >= 0xd800 && cp <= 0xdfff) {
          continue;
        }

        const c = String.fromCodePoint(cp);
        const candidates = [
          c + 'maria',
          'maria' + c,
          'ma' + c + 'ria',
          c + 'Γιώργος',
          'Γιώργος' + c,
          'Γι' + c + 'ώργος',
        ];

        for (const candidate of candidates) {
          const appRes = appFindPersonalData(candidate);
          const backRes = backendFind(candidate);
          if (appRes.join(',') !== backRes.join(',')) {
            disagreements.push(
              `"${candidate}" (U+${cp
                .toString(16)
                .toUpperCase()}): app=[${appRes.join(
                ', ',
              )}] backend=[${backRes.join(', ')}]`,
            );
            if (disagreements.length >= 10) {
              break;
            }
          }
        }

        if (disagreements.length >= 10) {
          break;
        }
      }

      if (disagreements.length > 0) {
        throw new Error(
          `Personal data check sweep disagreements detected (${disagreements.join(
            '; ',
          )}). Fix: copy the backend's logic from src/domains/location-note/personal-data-check.ts into src/utilities/addressNotes/personalDataCheck.ts`,
        );
      }

      expect(disagreements).toEqual([]);
    },
    30000,
  );

  itBackend(
    'compares COMPLAINT_CATEGORIES with backend complaint-rules.ts (same abouts, same categories, same order)',
    () => {
      const content = fs.readFileSync(
        backendPaths.backendComplaintRulesPath,
        'utf-8',
      );
      const backendCategories = parseBackendComplaintCategories(content);

      const diff = compareComplaintCategories(
        backendCategories,
        APP_COMPLAINT_CATEGORIES,
      );

      const backendAboutOrder = Object.keys(backendCategories);
      const appAboutOrder = Object.keys(APP_COMPLAINT_CATEGORIES);
      const orderMismatch =
        backendAboutOrder.length !== appAboutOrder.length ||
        backendAboutOrder.some((k, i) => k !== appAboutOrder[i]);

      if (
        diff.missingAboutsInApp.length > 0 ||
        diff.extraAboutsInApp.length > 0 ||
        diff.mismatchedCategories.length > 0 ||
        orderMismatch
      ) {
        const details = [
          diff.missingAboutsInApp.length > 0
            ? `missing abouts in app: ${diff.missingAboutsInApp.join(', ')}`
            : '',
          diff.extraAboutsInApp.length > 0
            ? `extra abouts in app: ${diff.extraAboutsInApp.join(', ')}`
            : '',
          orderMismatch
            ? `about order mismatch: backend=[${backendAboutOrder.join(
                ', ',
              )}], app=[${appAboutOrder.join(', ')}]`
            : '',
          diff.mismatchedCategories.length > 0
            ? `category mismatches: ${JSON.stringify(
                diff.mismatchedCategories,
              )}`
            : '',
        ]
          .filter(Boolean)
          .join('; ');

        throw new Error(
          `COMPLAINT_CATEGORIES differences detected (${details}). Fix: copy the backend's COMPLAINT_CATEGORIES from src/domains/complaint/complaint-rules.ts into src/utilities/complaints.ts`,
        );
      }

      expect(diff.missingAboutsInApp).toEqual([]);
      expect(diff.extraAboutsInApp).toEqual([]);
      expect(diff.mismatchedCategories).toEqual([]);
      expect(appAboutOrder).toEqual(backendAboutOrder);
      expect(APP_COMPLAINT_CATEGORIES).toEqual(backendCategories);
    },
  );

  itBackend(
    'compares OFFER_PUSH_KEYS with backend offer-card-payload.ts OFFER_CARD_PAYLOAD_KEYS (same keys, same order)',
    () => {
      const content = fs.readFileSync(
        backendPaths.backendOfferCardPayloadPath,
        'utf-8',
      );
      const backendKeys = parseBackendOfferCardPayloadKeys(content);

      const diff = compareOfferPushKeys(backendKeys, OFFER_PUSH_KEYS);

      if (
        diff.missingInApp.length > 0 ||
        diff.extraInApp.length > 0 ||
        diff.orderMismatches.length > 0
      ) {
        const details = [
          diff.missingInApp.length > 0
            ? `missing keys in app: ${diff.missingInApp.join(', ')}`
            : '',
          diff.extraInApp.length > 0
            ? `extra keys in app: ${diff.extraInApp.join(', ')}`
            : '',
          diff.orderMismatches.length > 0
            ? `order mismatches: ${JSON.stringify(diff.orderMismatches)}`
            : '',
        ]
          .filter(Boolean)
          .join('; ');

        throw new Error(
          `OFFER_PUSH_KEYS differences detected (${details}). Fix: copy OFFER_CARD_PAYLOAD_KEYS from src/domains/delivery/offer-card-payload.ts to OFFER_PUSH_KEYS in src/services/offerPush/offerMessage.ts`,
        );
      }

      expect(diff.missingInApp).toEqual([]);
      expect(diff.extraInApp).toEqual([]);
      expect(diff.orderMismatches).toEqual([]);
      expect([...OFFER_PUSH_KEYS]).toEqual(backendKeys);
    },
  );

  itBackend(
    'proves a backend-side complaint category change in a scratch copy fails comparison',
    () => {
      const originalContent = fs.readFileSync(
        backendPaths.backendComplaintRulesPath,
        'utf-8',
      );
      // Inject an extra category into backend source
      const modifiedContent = originalContent.replace(
        'EnumComplaintCategory.LONG_WAIT,',
        'EnumComplaintCategory.LONG_WAIT, EnumComplaintCategory.SCRATCH_EXTRA,',
      );
      const parsed = parseBackendComplaintCategories(modifiedContent);
      const diff = compareComplaintCategories(parsed, APP_COMPLAINT_CATEGORIES);
      expect(diff.mismatchedCategories.length).toBeGreaterThan(0);
      expect(diff.mismatchedCategories[0].about).toBe('RESTAURANT');
    },
  );

  itBackend(
    'proves a backend-side offer card payload key change in a scratch copy fails comparison',
    () => {
      const originalContent = fs.readFileSync(
        backendPaths.backendOfferCardPayloadPath,
        'utf-8',
      );
      // Inject an extra key into backend source
      const modifiedContent = originalContent.replace(
        "'deliveryId',",
        "'deliveryId', 'scratchExtraKey',",
      );
      const parsed = parseBackendOfferCardPayloadKeys(modifiedContent);
      const diff = compareOfferPushKeys(parsed, OFFER_PUSH_KEYS);
      expect(diff.missingInApp).toContain('scratchExtraKey');
    },
  );

  itBackend(
    'proves a backend-side personal-data-check change in a scratch copy fails comparison',
    () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'oc-scratch-backend-change-'),
      );
      try {
        const scratchCheckFile = path.join(tempDir, 'personal-data-check.ts');
        const scratchNamesFile = path.join(tempDir, 'given-names.json');

        const originalCode = fs.readFileSync(
          backendPaths.backendPersonalDataCheckPath,
          'utf-8',
        );
        const givenNamesDir = path.dirname(
          backendPaths.backendPersonalDataCheckPath,
        );
        fs.copyFileSync(
          path.join(givenNamesDir, 'given-names.json'),
          scratchNamesFile,
        );

        // Drop the \p{M} replacement in foldForNameCheck
        const modifiedCode = originalCode.replace(
          ".replace(/\\p{M}/gu, '')",
          '',
        );
        fs.writeFileSync(scratchCheckFile, modifiedCode);

        const scratchBackendMod =
          loadBackendPersonalDataCheck(scratchCheckFile);
        const scratchFold = scratchBackendMod.foldForNameCheck;

        // A word with a combining mark will now fold differently
        const markInput = 'ma\u20d0ria';
        const appFolded = appFoldForNameCheck(markInput);
        const scratchFolded = scratchFold(markInput);
        expect(appFolded).not.toBe(scratchFolded);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    },
  );
});
