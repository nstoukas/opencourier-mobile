#!/usr/bin/env node
/**
 * Typecheck ratchet for the courier app (`yarn typecheck:baseline`).
 *
 * The app still has old type errors, so "tsc passes" can't be the gate. Instead the
 * number of errors is written in `typecheck-baseline.json`, and this script makes sure
 * that number only ever goes down:
 *
 *   - more errors than the file says  -> fail (exit 1) and print the errors
 *   - the same number                 -> pass (exit 0)
 *   - fewer errors                    -> pass, and rewrite the file with the new number
 *
 * Plain Node, no dependencies. The functions are exported so tests can feed in made up
 * tsc output instead of running the real compiler.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_BASELINE_PATH = path.join(ROOT, 'typecheck-baseline.json');

/**
 * Picks the real error lines out of tsc's output.
 * Each error starts at the beginning of a line ("src/a.ts(1,2): error TS2322: ...", or
 * "error TS5023: ..." for a config error). tsc also prints indented continuation lines
 * under some errors; those are explanation, not extra errors, so they are not counted.
 */
function findErrorLines(output) {
  return output
    .split(/\r?\n/)
    .filter(line => /^\S/.test(line) && /\berror TS\d+:/.test(line));
}

/**
 * Picks out the error lines that mean tsc could not check the app at all: an error with no
 * "file(line,col):" in front ("error TS6053: File 'tsconfig.json' not found."), or one
 * pointing into a .json file (a broken tsconfig). Counting those as type errors would let a
 * broken config look like "1 error, down from 15" and lower the baseline.
 */
function findConfigErrors(errorLines) {
  return errorLines.filter(
    line =>
      !/^[^(]+\(\d+,\d+\): error TS\d+:/.test(line) ||
      /^[^(]+\.json\(/.test(line),
  );
}

/** Runs `tsc --noEmit` in the app folder and returns its exit status and output. */
function runTsc(cwd = ROOT) {
  const tscPath = require.resolve('typescript/bin/tsc', { paths: [cwd] });
  const result = spawnSync(
    process.execPath,
    [tscPath, '--noEmit', '--pretty', 'false', '-p', 'tsconfig.json'],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

/** Today as 'YYYY-MM-DD' in local time (the date the baseline was last lowered). */
function localDate(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}`;
}

/** Reads the baseline file and checks it holds a whole, non negative error count. */
function readBaseline(baselinePath) {
  const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  if (!Number.isInteger(parsed.errors) || parsed.errors < 0) {
    throw new Error(
      `${baselinePath} must hold a whole number "errors", got ${JSON.stringify(
        parsed.errors,
      )}`,
    );
  }
  return parsed;
}

/**
 * The whole check. Everything it touches can be swapped out, so a test can run it
 * against fake tsc output and a temporary baseline file.
 * Returns the exit code (0 pass, 1 fail) instead of exiting, for the same reason.
 */
function main({
  baselinePath = DEFAULT_BASELINE_PATH,
  run = runTsc,
  today = localDate,
  log = console.log,
  error = console.error,
} = {}) {
  let baseline;
  try {
    baseline = readBaseline(baselinePath);
  } catch (e) {
    error(`Could not read the typecheck baseline: ${e.message}`);
    return 1;
  }

  const { status, output } = run();
  const errorLines = findErrorLines(output);
  const count = errorLines.length;

  // tsc exits non zero when it finds errors. Non zero with no error lines means tsc
  // itself broke (bad install, crash), which must not read as "0 errors, all fixed".
  if (status !== 0 && count === 0) {
    error('tsc failed without reporting any type errors. Its output:');
    error(output);
    return 1;
  }

  // A config error means the count below is not a count of type errors, so stop here and
  // leave the baseline file alone.
  const configErrors = findConfigErrors(errorLines);
  if (configErrors.length > 0) {
    error('tsc could not check the app; fix its configuration first:');
    error(configErrors.join('\n'));
    return 1;
  }

  if (count > baseline.errors) {
    error(errorLines.join('\n'));
    error(
      `\nTypecheck: ${count} errors, the baseline allows ${baseline.errors}. ` +
        `This change adds ${count - baseline.errors} new type error(s). ` +
        'Fix them; the baseline only goes down.',
    );
    return 1;
  }

  if (count < baseline.errors) {
    const updated = { errors: count, updated: today() };
    fs.writeFileSync(baselinePath, `${JSON.stringify(updated, null, 2)}\n`);
    log(
      `Typecheck: ${count} errors, down from ${baseline.errors}. ` +
        `Lowered the baseline in ${path.basename(
          baselinePath,
        )} to ${count}; commit it.`,
    );
    return 0;
  }

  log(`Typecheck: ${count} errors, same as the baseline. OK.`);
  return 0;
}

module.exports = {
  findErrorLines,
  findConfigErrors,
  runTsc,
  localDate,
  readBaseline,
  main,
};

// Only run the check when called as a script, not when a test requires this file.
if (require.main === module) {
  process.exitCode = main();
}
