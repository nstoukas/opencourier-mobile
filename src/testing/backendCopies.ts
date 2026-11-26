import fs from 'fs';
import path from 'path';

/**
 * Shared by the tests that compare a copy in the app with its source in the backend
 * (src/localization/translationsParity.test.ts, src/utilities/addressNotes/givenNamesParity.test.ts,
 * src/utilities/backendCopiesParity.test.ts). Only tests import it; the app never does.
 *
 * The skip rules (rows 163, 174 and 180): skip only when the backend folder is absent and no
 * override is set; REQUIRE_BACKEND=1 turns that absence into a failure; a present folder with a
 * missing file fails and names the file and the path it looked at.
 */

// The backend beside this app in the workspace: src/testing, then src, then the app's folder.
export const DEFAULT_BACKEND_DIR = path.resolve(
  __dirname,
  '../../../opencourier-backend',
);

export type BackendEnv = Record<string, string | undefined>;

export interface BackendLocationOptions {
  // The folder to look in when OPENCOURIER_BACKEND_DIR is not set (tests point it somewhere absent).
  defaultDir?: string;
  env?: BackendEnv;
  // Variables that each point at one backend file directly (a scratch copy in a test).
  fileOverrideVars?: readonly string[];
}

export interface BackendLocation {
  backendDir: string;
  hasOverride: boolean;
  // True when every file has its own variable, so the folder itself is not needed.
  allFilesOverridden: boolean;
  dirExists: boolean;
  requireBackend: boolean;
  shouldSkip: boolean;
}

// Where the backend is, and whether the comparisons should be skipped.
export function resolveBackendLocation(
  options?: BackendLocationOptions,
): BackendLocation {
  const env = options?.env ?? process.env;
  const defaultDir = options?.defaultDir ?? DEFAULT_BACKEND_DIR;
  const fileOverrideVars = options?.fileOverrideVars ?? [];

  const hasOverride =
    Boolean(env.OPENCOURIER_BACKEND_DIR) ||
    fileOverrideVars.some(name => Boolean(env[name]));
  const allFilesOverridden =
    fileOverrideVars.length > 0 &&
    fileOverrideVars.every(name => Boolean(env[name]));

  const backendDir = env.OPENCOURIER_BACKEND_DIR || defaultDir;
  const dirExists = fs.existsSync(backendDir);
  const requireBackend = env.REQUIRE_BACKEND === '1';

  // Skip only when the backend folder itself is absent and no override is set.
  // When REQUIRE_BACKEND=1, never skip (it turns the absence into a failure).
  const shouldSkip = !hasOverride && !dirExists && !requireBackend;

  return {
    backendDir,
    hasOverride,
    allFilesOverridden,
    dirExists,
    requireBackend,
    shouldSkip,
  };
}

export interface BackendFile {
  // The start of the failure message, e.g. "Backend given names file missing: given-names.json".
  missingMessage: string;
  filePath: string;
}

// Throws, naming what is missing, unless the backend folder (when it is needed) and every file exist.
export function assertBackendFilesPresent(
  location: BackendLocation,
  files: readonly BackendFile[],
) {
  const needsDir = !location.allFilesOverridden;
  if (needsDir && location.requireBackend && !location.dirExists) {
    throw new Error(
      `REQUIRE_BACKEND=1 is set, but backend directory was not found under ${location.backendDir}`,
    );
  }
  if (needsDir && !location.dirExists) {
    throw new Error(
      `Backend directory was not found under ${location.backendDir}`,
    );
  }
  for (const file of files) {
    if (!fs.existsSync(file.filePath)) {
      throw new Error(`${file.missingMessage} (checked ${file.filePath})`);
    }
  }
}

// Each test file has its own copy of this module in Jest, so this warns once per test file.
let loggedSkipWarning = false;

// One loud line in the output when the comparisons are skipped, so a skip is never silent.
export function warnBackendAbsentOnce(backendDir: string, skipped: string) {
  if (!loggedSkipWarning) {
    loggedSkipWarning = true;
    console.warn(
      '\n=================================================================================\n' +
        `WARNING: Backend folder not found under ${backendDir}.\n` +
        `Skipping ${skipped} because backend repo is absent.\n` +
        '=================================================================================\n',
    );
  }
}
