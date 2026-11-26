import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Shape of given-names.json (spec 0053, AC-4, cross check 6; scope row 174):
 * An object with:
 * - `about`: string describing the provenance, spec reference, and folding rules.
 * - `names`: string[] of folded given names (lower case, no accents, every sigma as σ).
 *
 * Scope row 174: "The courier app's given names list is checked against the backend".
 * Done when: a test compares the app's given names list with the backend's, both ways;
 * changing either side fails it; it skips with a warning only when the backend folder is absent,
 * and REQUIRE_BACKEND=1 makes that a failure.
 */
export interface GivenNamesJson {
  about?: string;
  names: string[];
  // Index signature allows accessing arbitrary properties when validating unknown JSON.
  [key: string]: unknown;
}

export interface GivenNamesDifferenceReport {
  missingTopLevelKeysInApp: string[];
  extraTopLevelKeysInApp: string[];
  missingNamesInApp: string[];
  extraNamesInApp: string[];
  mismatchedValues: Array<{
    key: string;
    backend: unknown;
    app: unknown;
  }>;
}

/**
 * Compares parsed JSON from backend and app given-names.json both ways.
 * For the 'names' list key, reports elements missing in app and extra in app.
 * For any scalar or other property (such as 'about'), reports mismatched values.
 */
export function compareGivenNames(
  backendData: Record<string, unknown>,
  appData: Record<string, unknown>,
): GivenNamesDifferenceReport {
  const backendKeys = Object.keys(backendData).sort();
  const appKeys = Object.keys(appData).sort();

  const missingTopLevelKeysInApp = backendKeys.filter(k => !(k in appData));
  const extraTopLevelKeysInApp = appKeys.filter(k => !(k in backendData));
  const mismatchedValues: Array<{
    key: string;
    backend: unknown;
    app: unknown;
  }> = [];

  let missingNamesInApp: string[] = [];
  let extraNamesInApp: string[] = [];

  for (const key of backendKeys) {
    if (key in appData) {
      const bVal = backendData[key];
      const aVal = appData[key];

      if (key === 'names' && Array.isArray(bVal) && Array.isArray(aVal)) {
        const bSet = new Set(bVal);
        const aSet = new Set(aVal);

        missingNamesInApp = bVal.filter(item => !aSet.has(item));
        extraNamesInApp = aVal.filter(item => !bSet.has(item));
      } else if (bVal !== aVal) {
        mismatchedValues.push({
          key,
          backend: bVal,
          app: aVal,
        });
      }
    }
  }

  return {
    missingTopLevelKeysInApp,
    extraTopLevelKeysInApp,
    missingNamesInApp,
    extraNamesInApp,
    mismatchedValues,
  };
}

/**
 * Validates that an object conforms to the expected given-names.json shape.
 */
// 'asserts data is GivenNamesJson' is a TypeScript type assertion signature that narrows data's type if the function does not throw.
export function assertValidGivenNamesShape(
  data: unknown,
  sourceLabel: string,
): asserts data is GivenNamesJson {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error(
      `${sourceLabel} must be an object, but received ${
        Array.isArray(data) ? 'array' : typeof data
      }`,
    );
  }

  const record = data as Record<string, unknown>;

  if (typeof record.about !== 'string' || record.about.trim().length === 0) {
    throw new Error(
      `${sourceLabel} missing or invalid "about" field (expected non-empty string)`,
    );
  }

  if (!Array.isArray(record.names)) {
    throw new Error(
      `${sourceLabel} missing or invalid "names" field (expected array of strings)`,
    );
  }

  if (record.names.length === 0) {
    throw new Error(`${sourceLabel} "names" array must not be empty`);
  }

  for (let i = 0; i < record.names.length; i++) {
    const item = record.names[i];
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new Error(
        `${sourceLabel} name at index ${i} must be a non-empty string`,
      );
    }
  }
}

interface BackendPathsOptions {
  defaultDir?: string;
  env?: Record<string, string | undefined>;
}

/**
 * Resolves backend file locations with support for overrides (e.g. scratch copies in tests).
 * Precedent: src/localization/translationsParity.test.ts (row 163).
 */
export function getBackendPaths(options?: BackendPathsOptions) {
  const env = options?.env ?? process.env;
  const defaultDir =
    options?.defaultDir ??
    path.resolve(__dirname, '../../../../opencourier-backend');

  const hasOverride = Boolean(
    env.OPENCOURIER_BACKEND_DIR || env.BACKEND_GIVEN_NAMES_PATH,
  );

  const allFilesOverridden = Boolean(env.BACKEND_GIVEN_NAMES_PATH);

  const backendDir = env.OPENCOURIER_BACKEND_DIR || defaultDir;

  const backendGivenNamesPath =
    env.BACKEND_GIVEN_NAMES_PATH ||
    path.join(backendDir, 'src/domains/location-note/given-names.json');

  const dirExists = fs.existsSync(backendDir);
  const requireBackend = env.REQUIRE_BACKEND === '1';

  // Skip only when the backend folder itself is absent and no override is set.
  // When REQUIRE_BACKEND=1, never skip (it turns the absence into a failure).
  const shouldSkip = !hasOverride && !dirExists && !requireBackend;

  return {
    backendDir,
    backendGivenNamesPath,
    hasOverride,
    allFilesOverridden,
    dirExists,
    requireBackend,
    shouldSkip,
  };
}

/**
 * Verifies required backend files exist; only checks directory existence when paths are derived from it.
 * Precedent: src/localization/translationsParity.test.ts (row 163).
 */
// 'ReturnType<typeof getBackendPaths>' extracts the object type returned by getBackendPaths.
export function assertBackendFilesExist(
  paths: ReturnType<typeof getBackendPaths>,
) {
  if (paths.requireBackend && !paths.dirExists && !paths.allFilesOverridden) {
    throw new Error(
      `REQUIRE_BACKEND=1 is set, but backend directory was not found under ${paths.backendDir}`,
    );
  }
  if (!paths.dirExists && !paths.allFilesOverridden) {
    throw new Error(
      `Backend directory was not found under ${paths.backendDir}`,
    );
  }
  if (!fs.existsSync(paths.backendGivenNamesPath)) {
    throw new Error(
      `Backend given names file missing: given-names.json (checked ${paths.backendGivenNamesPath})`,
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
        'Skipping given names check because backend repo is absent.\n' +
        '=================================================================================\n',
    );
  }
}

describe('Backend path resolution and skip guard (row 174)', () => {
  it('skips when default backend dir is absent and no override is set', () => {
    const paths = getBackendPaths({
      defaultDir: path.resolve(
        __dirname,
        '../../../../nonexistent-backend-for-test',
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
        '../../../../nonexistent-backend-for-test',
      ),
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
      env: { OPENCOURIER_BACKEND_DIR: '/nonexistent/override/dir' },
    });
    expect(paths.shouldSkip).toBe(false);
    expect(paths.hasOverride).toBe(true);
    expect(paths.dirExists).toBe(false);
    expect(() => assertBackendFilesExist(paths)).toThrow(
      /Backend directory was not found/,
    );
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
      expect(fs.existsSync(paths.backendGivenNamesPath)).toBe(false);
      expect(() => assertBackendFilesExist(paths)).toThrow(
        /Backend given names file missing: given-names\.json/,
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('does not fail existence check when per file override exists even if default dir is absent', () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'oc-scratch-overrides-'),
    );
    try {
      const scratchFile = path.join(tempDir, 'given-names.json');
      fs.writeFileSync(
        scratchFile,
        JSON.stringify({ about: 'test', names: ['alex'] }),
      );

      const paths = getBackendPaths({
        defaultDir: path.resolve(
          __dirname,
          '../../../../nonexistent-backend-for-test',
        ),
        env: {
          BACKEND_GIVEN_NAMES_PATH: scratchFile,
        },
      });
      expect(paths.shouldSkip).toBe(false);
      expect(paths.allFilesOverridden).toBe(true);
      expect(paths.dirExists).toBe(false);
      expect(fs.existsSync(paths.backendGivenNamesPath)).toBe(true);

      expect(() => assertBackendFilesExist(paths)).not.toThrow();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails naming the missing file when per file override points to non-existent file', () => {
    const paths = getBackendPaths({
      env: {
        BACKEND_GIVEN_NAMES_PATH: '/nonexistent/path/to/given-names.json',
      },
    });
    expect(paths.shouldSkip).toBe(false);
    expect(paths.allFilesOverridden).toBe(true);
    expect(() => assertBackendFilesExist(paths)).toThrow(
      /Backend given names file missing: given-names\.json \(checked \/nonexistent\/path\/to\/given-names\.json\)/,
    );
  });
});

describe('compareGivenNames difference reporting logic', () => {
  it('detects missing names in app', () => {
    const backend = { about: 'text', names: ['alex', 'george', 'maria'] };
    const app = { about: 'text', names: ['alex', 'maria'] };

    const diff = compareGivenNames(backend, app);
    expect(diff.missingNamesInApp).toEqual(['george']);
    expect(diff.extraNamesInApp).toEqual([]);
    expect(diff.missingTopLevelKeysInApp).toEqual([]);
    expect(diff.extraTopLevelKeysInApp).toEqual([]);
    expect(diff.mismatchedValues).toEqual([]);
  });

  it('detects extra names in app', () => {
    const backend = { about: 'text', names: ['alex', 'maria'] };
    const app = { about: 'text', names: ['alex', 'george', 'maria'] };

    const diff = compareGivenNames(backend, app);
    expect(diff.missingNamesInApp).toEqual([]);
    expect(diff.extraNamesInApp).toEqual(['george']);
    expect(diff.missingTopLevelKeysInApp).toEqual([]);
    expect(diff.extraTopLevelKeysInApp).toEqual([]);
    expect(diff.mismatchedValues).toEqual([]);
  });

  it('detects missing and extra top-level keys', () => {
    const backend = { about: 'text', names: ['alex'], extraBackendKey: 123 };
    const app = { about: 'text', names: ['alex'], extraAppKey: 'foo' };

    const diff = compareGivenNames(backend, app);
    expect(diff.missingTopLevelKeysInApp).toEqual(['extraBackendKey']);
    expect(diff.extraTopLevelKeysInApp).toEqual(['extraAppKey']);
  });

  it('detects mismatched about text', () => {
    const backend = { about: 'version 2', names: ['alex'] };
    const app = { about: 'version 1', names: ['alex'] };

    const diff = compareGivenNames(backend, app);
    expect(diff.mismatchedValues).toEqual([
      { key: 'about', backend: 'version 2', app: 'version 1' },
    ]);
  });
});

describe("Row 174: The courier app's given names list is checked against the backend", () => {
  const backendPaths = getBackendPaths();
  const appGivenNamesPath = path.resolve(__dirname, 'given-names.json');

  if (backendPaths.shouldSkip) {
    warnBackendAbsentOnce(backendPaths.backendDir);
  }

  const itBackend = backendPaths.shouldSkip ? it.skip : it;

  itBackend('ensures backend directory and given names file exist', () => {
    assertBackendFilesExist(backendPaths);
  });

  it('documents and verifies the shape of given-names.json in the courier app', () => {
    expect(fs.existsSync(appGivenNamesPath)).toBe(true);
    const content = fs.readFileSync(appGivenNamesPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Validate shape
    assertValidGivenNamesShape(parsed, 'app given-names.json');

    // The shape is an object with:
    // 1. "about": descriptive header string
    // 2. "names": array of folded given names
    const keys = Object.keys(parsed).sort();
    expect(keys).toEqual(['about', 'names']);

    expect(typeof parsed.about).toBe('string');
    expect(Array.isArray(parsed.names)).toBe(true);

    // Every name is folded: lowercase, no accents, no uppercase, no final sigma ς
    for (const name of parsed.names) {
      expect(typeof name).toBe('string');
      expect(name).toBe(name.toLowerCase());
      expect(name).toBe(name.trim());
      expect(name).not.toMatch(/[ΆΈΉΊΪΐΌΎΫΰΏάέήίϊΐόύϋΰώς]/);
    }

    // Names list has no duplicates
    const uniqueNames = new Set(parsed.names);
    expect(uniqueNames.size).toBe(parsed.names.length);
  });

  itBackend(
    'verifies the backend original given-names.json matches the expected shape',
    () => {
      expect(fs.existsSync(backendPaths.backendGivenNamesPath)).toBe(true);
      const content = fs.readFileSync(
        backendPaths.backendGivenNamesPath,
        'utf-8',
      );
      const parsed = JSON.parse(content);

      assertValidGivenNamesShape(parsed, 'backend given-names.json');

      const keys = Object.keys(parsed).sort();
      expect(keys).toEqual(['about', 'names']);
      expect(typeof parsed.about).toBe('string');
      expect(Array.isArray(parsed.names)).toBe(true);

      // Every name is folded: lowercase, no accents, no uppercase, no final sigma ς
      for (const name of parsed.names) {
        expect(typeof name).toBe('string');
        expect(name).toBe(name.toLowerCase());
        expect(name).toBe(name.trim());
        expect(name).not.toMatch(/[ΆΈΉΊΪΐΌΎΫΰΏάέήίϊΐόύϋΰώς]/);
      }

      const uniqueNames = new Set(parsed.names);
      expect(uniqueNames.size).toBe(parsed.names.length);
    },
  );

  itBackend(
    'mobile given-names.json matches backend given-names.json byte for byte (spec 0053, cross check 6)',
    () => {
      const appBuffer = fs.readFileSync(appGivenNamesPath);
      const backendBuffer = fs.readFileSync(backendPaths.backendGivenNamesPath);

      if (!appBuffer.equals(backendBuffer)) {
        throw new Error(
          'mobile given-names.json does not match backend given-names.json byte for byte. Fix: run node scripts/copyGivenNames.js',
        );
      }
      expect(appBuffer.equals(backendBuffer)).toBe(true);
    },
  );

  itBackend(
    'compares parsed JSON between app and backend both ways and confirms zero differences',
    () => {
      const appContent = fs.readFileSync(appGivenNamesPath, 'utf-8');
      const backendContent = fs.readFileSync(
        backendPaths.backendGivenNamesPath,
        'utf-8',
      );

      const appJson = JSON.parse(appContent);
      const backendJson = JSON.parse(backendContent);

      const diff = compareGivenNames(backendJson, appJson);

      if (
        diff.missingNamesInApp.length > 0 ||
        diff.extraNamesInApp.length > 0 ||
        diff.missingTopLevelKeysInApp.length > 0 ||
        diff.extraTopLevelKeysInApp.length > 0 ||
        diff.mismatchedValues.length > 0
      ) {
        const details = [
          diff.missingNamesInApp.length > 0
            ? `missing in app: ${diff.missingNamesInApp.join(', ')}`
            : '',
          diff.extraNamesInApp.length > 0
            ? `extra in app: ${diff.extraNamesInApp.join(', ')}`
            : '',
          diff.missingTopLevelKeysInApp.length > 0
            ? `missing keys in app: ${diff.missingTopLevelKeysInApp.join(', ')}`
            : '',
          diff.extraTopLevelKeysInApp.length > 0
            ? `extra keys in app: ${diff.extraTopLevelKeysInApp.join(', ')}`
            : '',
          diff.mismatchedValues.length > 0
            ? `mismatched values: ${JSON.stringify(diff.mismatchedValues)}`
            : '',
        ]
          .filter(Boolean)
          .join('; ');
        throw new Error(
          `given-names.json differences detected (${details}). Fix: run node scripts/copyGivenNames.js`,
        );
      }

      expect(diff.missingTopLevelKeysInApp).toEqual([]);
      expect(diff.extraTopLevelKeysInApp).toEqual([]);
      expect(diff.missingNamesInApp).toEqual([]);
      expect(diff.extraNamesInApp).toEqual([]);
      expect(diff.mismatchedValues).toEqual([]);
      expect(appJson).toEqual(backendJson);
    },
  );

  itBackend(
    'verifies every name entry matches both ways (every entry in backend is in app, and vice versa)',
    () => {
      const appContent = fs.readFileSync(appGivenNamesPath, 'utf-8');
      const backendContent = fs.readFileSync(
        backendPaths.backendGivenNamesPath,
        'utf-8',
      );

      const appJson = JSON.parse(appContent);
      const backendJson = JSON.parse(backendContent);

      const diff = compareGivenNames(backendJson, appJson);

      if (
        diff.missingNamesInApp.length > 0 ||
        diff.extraNamesInApp.length > 0
      ) {
        const details = [
          diff.missingNamesInApp.length > 0
            ? `missing in app: ${diff.missingNamesInApp.join(', ')}`
            : '',
          diff.extraNamesInApp.length > 0
            ? `extra in app: ${diff.extraNamesInApp.join(', ')}`
            : '',
        ]
          .filter(Boolean)
          .join('; ');
        throw new Error(
          `Name entry mismatch (${details}). Fix: run node scripts/copyGivenNames.js`,
        );
      }

      expect(diff.missingNamesInApp).toEqual([]);
      expect(diff.extraNamesInApp).toEqual([]);
      expect(appJson.names.length).toBe(backendJson.names.length);
      expect(appJson.names).toEqual(backendJson.names);
    },
  );
});
