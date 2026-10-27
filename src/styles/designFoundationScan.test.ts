import fs from 'fs';
import path from 'path';

describe('AC-2, AC-3, AC-4: design foundation source scan', () => {
  const srcRoot = path.resolve(__dirname, '..');

  function getSourceFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getSourceFiles(fullPath));
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.test.tsx')
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allSourceFiles = getSourceFiles(srcRoot);

  it('contains no hex, rgb or rgba literals outside theme.ts and colors.ts', () => {
    // Exclude theme.ts and colors.ts (and any test files, already excluded by file finder)
    const filesToScan = allSourceFiles.filter(file => {
      const relative = path.relative(srcRoot, file);
      return relative !== 'styles/theme.ts' && relative !== 'styles/colors.ts';
    });

    const hexOrRgbRegex =
      /'#[0-9a-fA-F]{3,8}'|"#[0-9a-fA-F]{3,8}"|`#[0-9a-fA-F]{3,8}`|\brgba?\s*\(/;
    const violations: string[] = [];

    for (const file of filesToScan) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (hexOrRgbRegex.test(line)) {
          const relative = path.relative(srcRoot, file);
          violations.push(
            `src/${relative}:${
              index + 1
            }: ${line.trim()} [Color literal found]`,
          );
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('contains no numeric fontSize or corner borderRadius outside theme.ts (shadowRadius allowed)', () => {
    // Exclude theme.ts (and any test files)
    const filesToScan = allSourceFiles.filter(file => {
      const relative = path.relative(srcRoot, file);
      return relative !== 'styles/theme.ts';
    });

    const numericRadiusOrFontSizeRegex =
      /\b(fontSize|borderRadius|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius)\s*:\s*\d+/;
    const violations: string[] = [];

    for (const file of filesToScan) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (numericRadiusOrFontSizeRegex.test(line)) {
          const relative = path.relative(srcRoot, file);
          violations.push(
            `src/${relative}:${
              index + 1
            }: ${line.trim()} [Numeric size/radius found]`,
          );
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
