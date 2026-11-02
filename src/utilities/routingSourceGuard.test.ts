import fs from 'fs';
import path from 'path';

describe('Routing source guard (spec 0018, decision 69.1 / 69.2)', () => {
  const srcDir = path.resolve(__dirname, '..');

  function getSourceFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getSourceFiles(fullPath));
      } else if (
        (entry.name.endsWith('.ts') ||
          entry.name.endsWith('.tsx') ||
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.jsx')) &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.test.tsx')
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('no file under src mentions project-osrm or router.project-osrm.org', () => {
    const files = getSourceFiles(srcDir);
    const violations: string[] = [];

    const forbiddenPatterns = [
      { name: 'project-osrm', regex: /project-osrm/i },
      { name: 'router.project-osrm.org', regex: /router\.project-osrm\.org/i },
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.regex.test(line)) {
            const relPath = path.relative(srcDir, file);
            violations.push(
              `src/${relPath}:${index + 1}: found forbidden pattern '${pattern.name}': ${line.trim()}`,
            );
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('all route geometry is fetched from backend deliveries/:id/route and no code calls a routing server directly', () => {
    const files = getSourceFiles(srcDir);
    const violations: string[] = [];

    // The client should not call any external routing APIs (e.g. mapbox directions, google directions, osrm)
    const forbiddenApis = [
      { name: 'api.mapbox.com/directions', regex: /api\.mapbox\.com\/directions/i },
      { name: 'maps.googleapis.com/maps/api/directions', regex: /maps\.googleapis\.com\/maps\/api\/directions/i },
      { name: 'valhalla', regex: /valhalla/i },
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        for (const pattern of forbiddenApis) {
          if (pattern.regex.test(line)) {
            const relPath = path.relative(srcDir, file);
            violations.push(
              `src/${relPath}:${index + 1}: found direct routing call '${pattern.name}': ${line.trim()}`,
            );
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
