import moment from 'moment';
import { appLocale, setAppLocale, FALLBACK_CURRENCY } from './locale';
import { formatShift } from './dates';
import { coopClock } from './timeWorked';
import { formatDistance } from './geo';

describe('Locale, dates, and distance formatting (Row 66, Clause 4)', () => {
  describe('locale settings', () => {
    it('uses en-GB as appLocale in English and EUR as FALLBACK_CURRENCY', () => {
      setAppLocale('en');
      expect(appLocale()).toBe('en-GB');
      expect(FALLBACK_CURRENCY).toBe('EUR');
    });

    it('uses el-GR as appLocale in Greek', () => {
      setAppLocale('el');
      expect(appLocale()).toBe('el-GR');
      setAppLocale('en');
    });

    it('sets moment locale to en-gb so weeks start on Monday (not US Sunday)', () => {
      setAppLocale('en');
      expect(moment.locale()).toBe('en-gb');
      // In en-gb locale, Monday is the start of the week (day 1)
      const weekStart = moment('2026-10-27').startOf('week'); // Tuesday Oct 27
      expect(weekStart.format('dddd')).toBe('Monday');
      expect(weekStart.day()).toBe(1);
    });
  });

  describe('dates formatting', () => {
    it('formats dates with day first as "D MMM" (e.g. 27 Oct, not US Oct 27)', () => {
      setAppLocale('en');
      const formatted = moment('2026-10-27T14:30:00Z').format('D MMM');
      expect(formatted).toBe('27 Oct');
    });

    it('formatShift uses 24-hour time "HH:mm" (e.g. 14:30, not US 02:30 PM)', () => {
      expect(formatShift).toBe('HH:mm');
      const formatted = moment.utc('2026-10-27T14:30:00Z').format(formatShift);
      expect(formatted).toBe('14:30');
    });

    it('coopClock formats times in 24-hour style without AM/PM in Europe/Athens (e.g. 14:30, never 2:30 PM)', () => {
      // 12:30 UTC is 14:30 in Athens (winter time UTC+2)
      const timeMs = Date.parse('2026-10-27T12:30:00Z');
      const formatted = coopClock(timeMs);
      expect(formatted).not.toMatch(/AM|PM|am|pm/);
      expect(formatted).toBe('14:30');
    });
  });

  describe('geo distance formatting', () => {
    it('formatDistance formats meters to km with one decimal place and "km" unit', () => {
      setAppLocale('en');
      expect(formatDistance(3100)).toBe('3.1 km');
      expect(formatDistance(300)).toBe('0.3 km');
      expect(formatDistance(1000)).toBe('1.0 km');
      expect(formatDistance(12500)).toBe('12.5 km');
    });

    it('formatDistance formats meters with Greek comma decimal mark in Greek', () => {
      setAppLocale('el');
      expect(formatDistance(3100)).toBe('3,1 km');
      expect(formatDistance(300)).toBe('0,3 km');
      expect(formatDistance(1000)).toBe('1,0 km');
      expect(formatDistance(12500)).toBe('12,5 km');
      setAppLocale('en');
    });

    it('formatDistance never includes miles or "mi"', () => {
      setAppLocale('en');
      const result = formatDistance(5000);
      expect(result).toContain('km');
      expect(result).not.toContain('mi');
      expect(result).not.toContain('miles');
    });
  });
});
