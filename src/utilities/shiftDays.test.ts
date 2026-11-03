import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import { dayLabel } from './shiftDays';

// Spec 0027: an Athens date as "Sat 7 Nov", which the phone's own time zone must never move.
describe('dayLabel (spec 0027)', () => {
  it.each([
    ['2026-11-07', 'Sat 7 Nov'],
    ['2026-11-08', 'Sun 8 Nov'],
    ['2026-11-02', 'Mon 2 Nov'],
    ['2026-12-31', 'Thu 31 Dec'],
    ['2027-01-01', 'Fri 1 Jan'],
    ['2026-10-25', 'Sun 25 Oct'],
    ['2027-03-28', 'Sun 28 Mar'],
    ['2028-02-29', 'Tue 29 Feb'],
  ])('%s is %s', (date, label) => {
    expect(dayLabel(date)).toBe(label);
  });

  it.each(['', '2026-11-7', '07/11/2026', '2026-11-07T00:00:00Z', 'soon'])(
    'gives back text that is not YYYY-MM-DD unchanged (%p)',
    text => {
      expect(dayLabel(text)).toBe(text);
    },
  );

  // Setting process.env.TZ inside a Jest test does not change the zone (Jest hands each test file a copy
  // of process.env), so the real source runs in a child Node process started in each zone. Kiritimati is
  // UTC+14 and Adak UTC-10 (UTC-9 in summer): between them, every local getter would move the day.
  describe('in the phone zones furthest from UTC', () => {
    const source = readFileSync(path.join(__dirname, 'shiftDays.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2019,
      },
    }).outputText;
    const dates = [
      '2026-11-07',
      '2026-12-31',
      '2027-01-01',
      '2026-07-15',
      '2027-03-28',
      '2026-10-25',
    ];
    const expected = [
      'Sat 7 Nov',
      'Thu 31 Dec',
      'Fri 1 Jan',
      'Wed 15 Jul',
      'Sun 28 Mar',
      'Sun 25 Oct',
    ];

    const labelsIn = (zone: string) => {
      const script = `
        const module = { exports: {} };
        const exports = module.exports;
        ${compiled}
        const offset = new Date(Date.UTC(2026, 10, 7)).getTimezoneOffset();
        process.stdout.write(JSON.stringify({ offset, labels: ${JSON.stringify(
          dates,
        )}.map(module.exports.dayLabel) }));
      `;
      const run = spawnSync(process.execPath, ['-e', script], {
        env: { ...process.env, TZ: zone },
        encoding: 'utf8',
      });
      if (run.status !== 0) {
        throw new Error(run.stderr);
      }
      return JSON.parse(run.stdout) as { offset: number; labels: string[] };
    };

    it('Pacific/Kiritimati (UTC+14)', () => {
      const { offset, labels } = labelsIn('Pacific/Kiritimati');
      // The child really runs in that zone.
      expect(offset).toBe(-14 * 60);
      expect(labels).toEqual(expected);
    });

    it('America/Adak (UTC-10)', () => {
      const { offset, labels } = labelsIn('America/Adak');
      expect(offset).toBe(10 * 60);
      expect(labels).toEqual(expected);
    });
  });
});
