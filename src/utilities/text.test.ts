import { validateEmail } from './text';

describe('validateEmail', () => {
  describe('Accepts valid email addresses', () => {
    it('accepts the seeded courier login email', () => {
      expect(validateEmail('opencourier-courier-testing@opencourier.com')).toBe(
        true,
      );
    });

    it('accepts the shortest valid email format', () => {
      expect(validateEmail('a@b.co')).toBe(true);
    });

    it('accepts standard domain emails', () => {
      expect(validateEmail('user@example.com')).toBe(true);
    });

    it('accepts dots in the local part', () => {
      expect(validateEmail('first.last@example.com')).toBe(true);
    });

    it('accepts hyphens in the local part', () => {
      expect(validateEmail('first-last@example.com')).toBe(true);
    });

    it('accepts hyphens in the domain part', () => {
      expect(validateEmail('user@my-domain.com')).toBe(true);
    });

    it('accepts multiple dotted domain labels', () => {
      expect(validateEmail('user@sub.domain.co.uk')).toBe(true);
    });

    it('accepts underscores and numbers in address', () => {
      expect(validateEmail('user_name@example.com')).toBe(true);
      expect(validateEmail('user123@example123.com')).toBe(true);
    });
  });

  describe('Rejects invalid email addresses', () => {
    it('rejects empty string', () => {
      expect(validateEmail('')).toBe(false);
    });

    it('rejects addresses without @ symbol', () => {
      expect(validateEmail('plainaddress')).toBe(false);
    });

    it('rejects addresses missing local or domain part', () => {
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });

    it('rejects domain missing a dot or TLD', () => {
      expect(validateEmail('user@example')).toBe(false);
    });

    it('rejects TLD with fewer than 2 characters', () => {
      expect(validateEmail('user@example.c')).toBe(false);
    });

    it('rejects doubled separators in local or domain part', () => {
      expect(validateEmail('user..name@example.com')).toBe(false);
      expect(validateEmail('user@example..com')).toBe(false);
    });

    it('rejects leading or trailing separators in the local part', () => {
      expect(validateEmail('.user@example.com')).toBe(false);
      expect(validateEmail('user.@example.com')).toBe(false);
      // The pattern treats '.' and '-' symmetrically, so check the hyphen too.
      expect(validateEmail('-user@example.com')).toBe(false);
      expect(validateEmail('user-@example.com')).toBe(false);
    });

    it('rejects domain labels starting with a separator', () => {
      expect(validateEmail('user@-example.com')).toBe(false);
    });

    it('rejects addresses containing whitespace', () => {
      expect(validateEmail('user name@example.com')).toBe(false);
    });
  });

  describe('ReDoS regression prevention', () => {
    it('executes keystroke-by-keystroke prefix validation in linear time (< 100ms)', () => {
      const fullAddress = 'opencourier-courier-testing@opencourier.com';
      // Measure execution time across all keystroke prefixes to verify linear time performance
      const startTime = Date.now();
      for (let i = 1; i <= fullAddress.length; i++) {
        validateEmail(fullAddress.slice(0, i));
      }
      const durationMs = Date.now() - startTime;

      expect(durationMs).toBeLessThan(100);
    });

    it('handles long unmatchable word-character strings in linear time (< 100ms)', () => {
      // Long input with no valid parse was the worst-case scenario for catastrophic backtracking.
      // Length is deliberate: the old pattern's cost doubles per character, so 32 takes it to
      // ~2.9s — far above the 100ms bar, so a regression is caught decisively — while 40 took
      // 750s and would hang a CI runner rather than failing it. Do not lower this below ~28:
      // at 25 the old pattern finishes in 84ms and this test would pass against the bug.
      const longWord = 'a'.repeat(32);
      const startTime = Date.now();

      const res1 = validateEmail(longWord);
      const res2 = validateEmail(`${longWord}@`);
      const durationMs = Date.now() - startTime;

      expect(res1).toBe(false);
      expect(res2).toBe(false);
      expect(durationMs).toBeLessThan(100);
    });
  });
});
