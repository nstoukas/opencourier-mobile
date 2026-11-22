import fs from 'fs';
import path from 'path';

// Spec 0052 (AC-8, Value 5): Complaints are never counted, scored, or ranked per rider.
// Nothing turns complaints into a count or metric anywhere in the app.
describe('Value 5 complaint guard (spec 0052, AC-8)', () => {
  const srcDir = path.resolve(__dirname, '..');

  function getSourceFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__mocks__') {
          files.push(...getSourceFiles(fullPath));
        }
      } else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        !/\.test\.(ts|tsx)$/.test(entry.name)
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('no source file introduces complaintCount, complaintsCount, complaintScore, or complaintRank', () => {
    const files = getSourceFiles(srcDir);
    const forbiddenPatterns = [
      /\bcomplaintCount\b/i,
      /\bcomplaintsCount\b/i,
      /\bcomplaintScore\b/i,
      /\bcomplaintRating\b/i,
      /\bcomplaintRank\b/i,
    ];

    const violations: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(line)) {
            const rel = path.relative(srcDir, file);
            violations.push(`src/${rel}:${index + 1}: ${line.trim()}`);
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('SideMenu does not attach an unread dot or badge to Complaints', () => {
    const sideMenuFile = path.join(srcDir, 'screens/SideMenu/SideMenu.tsx');
    const content = fs.readFileSync(sideMenuFile, 'utf-8');

    // Chat has dot={chatUnseen}, but Complaints must never have a dot or badge
    expect(content).not.toMatch(/item\s*===\s*SideMenuItem\.Complaints[^}]+dot/);
  });
});
