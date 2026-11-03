import fs from 'fs';
import path from 'path';

// Row 105: on Android notifee reads a notification's title and body as HTML, so every notice that
// carries a restaurant's name (text from outside the app) must pass it through the shared helper
// (`notificationText`, or `escapeHtml` where the code escapes on Android itself). This scan fails
// when a file that posts a notification and names a restaurant does not.
describe('Source scan: notices with outside text are escaped (row 105)', () => {
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
        /\.(ts|tsx|js|jsx)$/.test(entry.name) &&
        !/\.test\.(ts|tsx|js|jsx)$/.test(entry.name)
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const relative = (file: string) =>
    `src/${path.relative(srcDir, file).split(path.sep).join('/')}`;

  // A file that posts a notification and handles a restaurant's name.
  const noticeFilesWithOutsideText = () =>
    getSourceFiles(srcDir).filter(file => {
      const content = fs.readFileSync(file, 'utf-8');
      return (
        /\.displayNotification\s*\(/.test(content) &&
        /restaurant|pickupBusinessName|businessName/i.test(content)
      );
    });

  // Row 100's offer alert keeps its own copy of escapeHtml on this branch (row 21's branch moves it
  // to the shared one). It is accepted only while it still both defines and calls that copy.
  const LOCAL_ESCAPE_ALLOWED = new Set([
    'src/services/offerPush/offerAlert.ts',
  ]);

  const importsSharedHelper = (content: string) =>
    /import\s*\{[^}]*\b(notificationText|escapeHtml)\b[^}]*\}\s*from\s*['"](@app\/utilities|\.{1,2}(\/[\w.]+)*)\/(notificationText|escapeHtml)['"]/.test(
      content,
    );

  const definesLocalEscape = (content: string) =>
    /const\s+escapeHtml\s*=/.test(content);

  // A call, not just an import or the definition: `notificationText(` or `escapeHtml(`, or
  // `.map(escapeHtml)`.
  const callsHelper = (content: string) =>
    content
      .split('\n')
      .filter(line => !/^\s*import\b/.test(line))
      .filter(line => !/const\s+escapeHtml\s*=/.test(line))
      .some(line =>
        /\b(notificationText|escapeHtml)\s*\(|\(\s*(notificationText|escapeHtml)\s*\)/.test(
          line,
        ),
      );

  it('finds the notices that carry a restaurant name (the scan is not empty)', () => {
    const found = noticeFilesWithOutsideText().map(relative);
    expect(found).toEqual(
      expect.arrayContaining([
        'src/services/cancelledJobs/cancelledJobs.ts',
        'src/services/offerPush/autoAccepted.ts',
        'src/services/offerPush/offerAlert.ts',
      ]),
    );
  });

  it('every such file escapes through notificationText or escapeHtml', () => {
    const violations: string[] = [];
    for (const file of noticeFilesWithOutsideText()) {
      const rel = relative(file);
      const content = fs.readFileSync(file, 'utf-8');
      const hasHelper =
        importsSharedHelper(content) ||
        (LOCAL_ESCAPE_ALLOWED.has(rel) && definesLocalEscape(content));
      if (!hasHelper) {
        violations.push(
          `${rel}: does not import notificationText or escapeHtml`,
        );
      } else if (!callsHelper(content)) {
        violations.push(
          `${rel}: has the helper but never passes text through it`,
        );
      }
    }
    expect(violations).toEqual([]);
  });
});
