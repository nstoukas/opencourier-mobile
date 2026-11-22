#!/usr/bin/env node
/**
 * The hard coded text ratchet (spec 0054, AC-8): `yarn lint:i18n`.
 *
 * Runs ESLint with only the hard coded JSX text rule (.eslintrc.i18n.js, scripts/eslint-rules) over
 * src and App.tsx, and compares the count with `i18n-lint-baseline.json`, the way typecheck-baseline.js
 * does for type errors:
 *   - more than the file says  -> fail (exit 1) and list them: new words go in src/localization
 *   - the same                 -> pass
 *   - fewer                    -> pass, and lower the number in the file (commit it)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(ROOT, 'i18n-lint-baseline.json');

const result = spawnSync(
  process.execPath,
  [
    path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js'),
    '--no-eslintrc',
    '-c',
    '.eslintrc.i18n.js',
    '--rulesdir',
    'scripts/eslint-rules',
    '--ext',
    '.tsx',
    '-f',
    'json',
    'src',
    'App.tsx',
  ],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
let files;
try {
  files = JSON.parse(result.stdout);
} catch {
  // ESLint itself failed (a broken config): never read that as "no hard coded text".
  console.error(result.stdout, result.stderr);
  process.exit(2);
}
// Only this rule's reports: anything else (an unknown rule in a disable comment) is not hard coded text.
const found = files.flatMap(file =>
  file.messages
    .filter(message => message.ruleId === 'no-literal-jsx-text')
    .map(
      message =>
        `${path.relative(ROOT, file.filePath)}:${message.line}  ${
          message.message
        }`,
    ),
);
const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
if (found.length > baseline.count) {
  console.error(found.join('\n'));
  console.error(
    `\n${found.length} hard coded texts, baseline ${baseline.count}: put the new ones in src/localization.`,
  );
  process.exit(1);
}
if (found.length < baseline.count) {
  fs.writeFileSync(
    BASELINE,
    `${JSON.stringify(
      { count: found.length, updated: new Date().toISOString().slice(0, 10) },
      null,
      2,
    )}\n`,
  );
  console.log(
    `${found.length} hard coded texts, down from ${baseline.count}: i18n-lint-baseline.json lowered.`,
  );
} else {
  console.log(`${found.length} hard coded texts, the same as the baseline.`);
}
