import fs from 'fs';
import path from 'path';

// AC-2 guard (spec 0039): fails if any non-test source file under src/ or App.tsx,
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

const DELETED_IMPORT_REGEX = new RegExp(
  `import\\s+[\\s\\S]*?\\b(${DELETED_MODULE_NAMES.map(n => n.replace('/', '\\/')).join(
    '|',
  )})\\b[\\s\\S]*?from\\s+['"]|from\\s+['"][^'"]*\\b(${DELETED_MODULE_NAMES.map(n =>
    n.replace('/', '\\/'),
  ).join('|')})\\b`,
);

const OLD_URL_KEYS_REGEX = /\b(BASE_URL|SOCKET_BASE_URL)\b/;

describe('AC-2 guard: no instance screens or old address keys in source (spec 0039)', () => {
  const sourceFiles = [...getSourceFiles(srcDir), path.join(rootDir, 'App.tsx')];

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
      const match = content.match(DELETED_IMPORT_REGEX);
      if (match) {
        violations.push(
          `${relative} imports deleted module: ${match[1] || match[2]}`,
        );
      }
    }
    expect(violations).toEqual([]);
  });
});
