// The hard coded text check (spec 0054, AC-8), run by `yarn lint:i18n` (scripts/i18n-lint-ratchet.js),
// not by `yarn lint`. Its one rule lives in scripts/eslint-rules (no package). The count may only go
// down (i18n-lint-baseline.json).
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  // Loaded (with every rule off) only so the files' own eslint-disable comments for its rules resolve.
  plugins: ['react-hooks'],
  rules: { 'no-literal-jsx-text': 'error' },
  ignorePatterns: ['**/*.test.tsx', 'node_modules/**'],
};
