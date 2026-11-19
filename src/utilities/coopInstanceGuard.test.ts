import fs from 'fs';
import path from 'path';

// AC-2 guard (spec 0039, Clause 10): fails if any non-test source file under src/ or App.tsx,
// other than src/services/upgradeGate.ts, contains BASE_URL or SOCKET_BASE_URL,
// or imports any deleted screen or module.

const rootDir = path.resolve(__dirname, '../..');
const srcDir = path.resolve(__dirname, '..');

function getSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getSourceFiles(full));
    } else if (
      /\.(ts|tsx|js|jsx)$/.test(entry.name) &&
      !/\.test\.(ts|tsx|js|jsx)$/.test(entry.name)
    ) {
      files.push(full);
    }
  }
  return files;
}

const DELETED_MODULE_NAMES = [
  'Landing',
  'Welcome',
  'ChooseInstance',
  'InstanceDetails',
  'LoginInstance',
  'SelectOrganizationModal',
  'navigation/onboarding',
  'instanceService',
  'useInstance',
  'InstanceCell',
  'InstanceHeader',
  'PopularNearbyInstances',
  'InstanceTabs',
  'OrganizationSelect',
  'OrganizationCell',
];

const DELETED_NAME_PATTERN = new RegExp(
  `\\b(${DELETED_MODULE_NAMES.map(n => n.replace('/', '\\/')).join('|')})\\b`,
);

// Matches import and require statements per statement, never lazily across statements
export function findDeletedImportStatements(content: string): string[] {
  const statementPatterns = [
    // import ... from '...' (including multiline named imports with braces)
    /import\s+(?:type\s+)?(?:[^;{}]*\{[^}]*\}|[^;{}]+)?\s*from\s*['"][^'"]+['"]/g,
    // side-effect import '...'
    /import\s*['"][^'"]+['"]/g,
    // require('...')
    /require\s*\(\s*['"][^'"]+['"]\s*\)/g,
    // dynamic import('...')
    /import\s*\(\s*['"][^'"]+['"]\s*\)/g,
  ];

  const found: string[] = [];
  for (const pattern of statementPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      for (const statement of matches) {
        const match = statement.match(DELETED_NAME_PATTERN);
        if (match) {
          found.push(match[1]);
        }
      }
    }
  }
  return found;
}

const OLD_URL_KEYS_REGEX = /\b(BASE_URL|SOCKET_BASE_URL)\b/;

describe('AC-2 guard: no instance screens or old address keys in source (spec 0039, Clause 10)', () => {
  const sourceFiles = [
    ...getSourceFiles(srcDir),
    path.join(rootDir, 'App.tsx'),
  ];

  it('scans a substantial number of source files including App.tsx', () => {
    expect(sourceFiles.length).toBeGreaterThan(60);
    expect(sourceFiles).toContain(path.join(rootDir, 'App.tsx'));
  });

  it('no non-test source file (except upgradeGate.ts) contains BASE_URL or SOCKET_BASE_URL', () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const relative = path.relative(rootDir, file);
      if (relative === 'src/services/upgradeGate.ts') {
        continue;
      }
      const content = fs.readFileSync(file, 'utf-8');
      if (OLD_URL_KEYS_REGEX.test(content)) {
        violations.push(`${relative} contains BASE_URL or SOCKET_BASE_URL`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('no non-test source file imports any deleted screen or module', () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const relative = path.relative(rootDir, file);
      const content = fs.readFileSync(file, 'utf-8');
      const matches = findDeletedImportStatements(content);
      for (const m of matches) {
        violations.push(`${relative} imports deleted module: ${m}`);
      }
    }
    expect(violations).toEqual([]);
  });

  describe('guard behavior checks (Clause 10)', () => {
    it('fails on require("...navigation/onboarding...")', () => {
      const sample = `const x = require('@app/navigation/onboarding/Landing');`;
      const violations = findDeletedImportStatements(sample);
      expect(violations).toContain('navigation/onboarding');
    });

    it('matches import patterns per statement and does NOT fail when a deleted name appears in a comment between imports', () => {
      const sample = `
import { Button } from '@app/components/Button/Button';
// Welcome comment between imports must not trigger a false positive
import { Text } from 'react-native';
`;
      const violations = findDeletedImportStatements(sample);
      expect(violations).toEqual([]);
    });

    it('fails when an import statement explicitly imports a deleted screen or module', () => {
      const sample = `import { Welcome } from '@app/screens/Welcome';`;
      const violations = findDeletedImportStatements(sample);
      expect(violations).toContain('Welcome');
    });
  });
});
