const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  findErrorLines,
  localDate,
  readBaseline,
  main,
} = require('./typecheck-baseline');

describe('typecheck-baseline script', () => {
  let tempDir;
  let baselinePath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'typecheck-test-'));
    baselinePath = path.join(tempDir, 'typecheck-baseline.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('findErrorLines', () => {
    it('finds error lines starting with a file path or error TS', () => {
      const output = [
        "src/App.tsx(10,5): error TS2322: Type 'string' is not assignable to type 'number'.",
        "error TS5023: Unknown compiler option 'target'.",
        'Starting compilation in watch mode...',
      ].join('\n');

      const lines = findErrorLines(output);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe(
        "src/App.tsx(10,5): error TS2322: Type 'string' is not assignable to type 'number'.",
      );
      expect(lines[1]).toBe("error TS5023: Unknown compiler option 'target'.");
    });

    it('ignores continuation lines indented under an error even if they mention an error code', () => {
      const output = [
        "src/index.ts(1,1): error TS2322: Type 'A' is not assignable to type 'B'.",
        '  Indented context line explaining error TS2322 in detail',
        '\tAnother tab-indented line error TS9999: details',
        "src/other.ts(5,2): error TS2339: Property 'foo' does not exist.",
      ].join('\n');

      const lines = findErrorLines(output);
      expect(lines).toHaveLength(2);
      expect(lines).toEqual([
        "src/index.ts(1,1): error TS2322: Type 'A' is not assignable to type 'B'.",
        "src/other.ts(5,2): error TS2339: Property 'foo' does not exist.",
      ]);
    });
  });

  describe('localDate', () => {
    it('formats a date as YYYY-MM-DD in local time', () => {
      const date = new Date(2026, 9, 25); // Oct 25, 2026
      expect(localDate(date)).toBe('2026-10-25');
    });
  });

  describe('readBaseline', () => {
    it('reads and parses a valid baseline file', () => {
      fs.writeFileSync(
        baselinePath,
        JSON.stringify({ errors: 15, updated: '2026-10-25' }),
      );
      const parsed = readBaseline(baselinePath);
      expect(parsed).toEqual({ errors: 15, updated: '2026-10-25' });
    });

    it('throws if the baseline file contains negative or non-integer errors', () => {
      fs.writeFileSync(baselinePath, JSON.stringify({ errors: -1 }));
      expect(() => readBaseline(baselinePath)).toThrow(
        /must hold a whole number "errors"/,
      );

      fs.writeFileSync(baselinePath, JSON.stringify({ errors: '15' }));
      expect(() => readBaseline(baselinePath)).toThrow(
        /must hold a whole number "errors"/,
      );
    });

    it('throws if the baseline file does not exist or has invalid JSON', () => {
      expect(() =>
        readBaseline(path.join(tempDir, 'nonexistent.json')),
      ).toThrow();

      fs.writeFileSync(baselinePath, 'not json');
      expect(() => readBaseline(baselinePath)).toThrow();
    });
  });

  describe('main', () => {
    it('fails (exit code 1) when baseline file is missing', () => {
      const logs = [];
      const errors = [];
      const code = main({
        baselinePath: path.join(tempDir, 'missing.json'),
        run: () => ({ status: 0, output: '' }),
        log: msg => logs.push(msg),
        error: msg => errors.push(msg),
      });

      expect(code).toBe(1);
      expect(errors[0]).toMatch(/Could not read the typecheck baseline/);
    });

    it('fails (exit code 1) when baseline file is malformed', () => {
      fs.writeFileSync(baselinePath, 'invalid json');
      const errors = [];
      const code = main({
        baselinePath,
        run: () => ({ status: 0, output: '' }),
        error: msg => errors.push(msg),
      });

      expect(code).toBe(1);
      expect(errors[0]).toMatch(/Could not read the typecheck baseline/);
    });

    it('fails (exit code 1) when tsc exits non-zero with zero error lines (compiler crash)', () => {
      fs.writeFileSync(
        baselinePath,
        JSON.stringify({ errors: 10, updated: '2026-10-25' }),
      );
      const errors = [];
      const code = main({
        baselinePath,
        run: () => ({
          status: 2,
          output: 'Internal TypeScript compiler error',
        }),
        error: msg => errors.push(msg),
      });

      expect(code).toBe(1);
      expect(errors[0]).toMatch(/tsc failed without reporting any type errors/);
    });

    it('fails (exit code 1) when error count is above the baseline, leaving file unchanged', () => {
      const initialContent = JSON.stringify({
        errors: 5,
        updated: '2026-10-20',
      });
      fs.writeFileSync(baselinePath, `${initialContent}\n`);

      const errors = [];
      // Exactly 1 error above baseline (6 errors against baseline of 5)
      const fakeOutput = Array.from(
        { length: 6 },
        (_, i) => `src/file${i}.ts(1,1): error TS2322: Type mismatch`,
      ).join('\n');

      const code = main({
        baselinePath,
        run: () => ({ status: 1, output: fakeOutput }),
        error: msg => errors.push(msg),
      });

      expect(code).toBe(1);
      expect(
        errors.some(e => e.includes('6 errors, the baseline allows 5')),
      ).toBe(true);
      // File must be unchanged
      expect(fs.readFileSync(baselinePath, 'utf8')).toBe(`${initialContent}\n`);
    });

    it('passes (exit code 0) when error count equals the baseline, leaving file unchanged', () => {
      const initialContent = JSON.stringify({
        errors: 2,
        updated: '2026-10-20',
      });
      fs.writeFileSync(baselinePath, `${initialContent}\n`);

      const logs = [];
      const fakeOutput = [
        'src/a.ts(1,1): error TS2322: Error 1',
        'src/b.ts(1,1): error TS2322: Error 2',
      ].join('\n');

      const code = main({
        baselinePath,
        run: () => ({ status: 1, output: fakeOutput }),
        log: msg => logs.push(msg),
      });

      expect(code).toBe(0);
      expect(logs[0]).toMatch(/2 errors, same as the baseline/);
      expect(fs.readFileSync(baselinePath, 'utf8')).toBe(`${initialContent}\n`);
    });

    it('passes (exit code 0) and rewrites the file when error count is below baseline', () => {
      fs.writeFileSync(
        baselinePath,
        JSON.stringify({ errors: 10, updated: '2026-10-20' }),
      );

      const logs = [];
      const fakeOutput = [
        'src/a.ts(1,1): error TS2322: Error 1',
        'src/b.ts(1,1): error TS2322: Error 2',
      ].join('\n');

      const code = main({
        baselinePath,
        run: () => ({ status: 1, output: fakeOutput }),
        today: () => '2026-10-25',
        log: msg => logs.push(msg),
      });

      expect(code).toBe(0);
      expect(logs[0]).toMatch(/2 errors, down from 10\. Lowered the baseline/);

      // Baseline file must be rewritten with lower count and new date
      const rewritten = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      expect(rewritten).toEqual({
        errors: 2,
        updated: '2026-10-25',
      });
    });
  });
});
