import moment from 'moment';
import { APP_LOCALE, FALLBACK_CURRENCY } from './locale';
import { formatEarnings, formatShift, formatTime } from './dates';
import { formatDistance } from './geo';

describe('Locale, dates, and distance formatting (Row 66, Clause 4)', () => {
  describe('locale settings', () => {
    it('uses en-GB as APP_LOCALE and EUR as FALLBACK_CURRENCY', () => {
      expect(APP_LOCALE).toBe('en-GB');
      expect(FALLBACK_CURRENCY).toBe('EUR');
    });

    it('sets moment locale to en-gb so weeks start on Monday (not US Sunday)', () => {
      expect(moment.locale()).toBe('en-gb');
      // In en-gb locale, Monday is the start of the week (day 1)
      const weekStart = moment('2026-10-27').startOf('week'); // Tuesday Oct 27
      expect(weekStart.format('dddd')).toBe('Monday');
      expect(weekStart.day()).toBe(1);
    });
  });

  describe('dates formatting', () => {
    it('formatEarnings puts day first as "D MMM" (e.g. 27 Oct, not US Oct 27)', () => {
      expect(formatEarnings).toBe('D MMM');
      const formatted = moment('2026-10-27T14:30:00Z').format(formatEarnings);
      expect(formatted).toBe('27 Oct');
    });

    it('formatShift uses 24-hour time "HH:mm" (e.g. 14:30, not US 02:30 PM)', () => {
      expect(formatShift).toBe('HH:mm');
      const formatted = moment.utc('2026-10-27T14:30:00Z').format(formatShift);
      expect(formatted).toBe('14:30');
    });

    it('formatTime formats times in 24-hour style without AM/PM in APP_LOCALE', () => {
      const timeStr = '2026-10-27T14:30:00Z';
      const formatted = formatTime(timeStr);
      // In en-GB, short time style is HH:mm (e.g. 14:30), never contains AM or PM
      expect(formatted).not.toMatch(/AM|PM|am|pm/);
      expect(formatted).toMatch(/14:30|15:30|16:30|17:30/); // depending on runner timezone
    });
  });

  describe('geo distance formatting', () => {
    it('formatDistance formats meters to km with one decimal place and "km" unit', () => {
      expect(formatDistance(3100)).toBe('3.1 km');
      expect(formatDistance(300)).toBe('0.3 km');
      expect(formatDistance(1000)).toBe('1 km');
      expect(formatDistance(12500)).toBe('12.5 km');
    });

    it('formatDistance never includes miles or "mi"', () => {
      const result = formatDistance(5000);
      expect(result).toContain('km');
      expect(result).not.toContain('mi');
      expect(result).not.toContain('miles');
    });
  });
});
