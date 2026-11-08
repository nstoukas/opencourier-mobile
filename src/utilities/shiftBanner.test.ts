import type { MyShiftBooking } from '@app/services/shifts/shiftsApi';
import { bookingInProgress, nextBannerChange } from './shiftBanner';

// Spec 0027 (AC-8): which booking the home banner shows, and when its words next change.
describe('shiftBanner (spec 0027, AC-8)', () => {
  const booking = (
    id: string,
    startsAt: string,
    endsAt: string,
  ): MyShiftBooking => ({
    id,
    shiftSlotId: 'slot-1',
    date: '2026-11-06',
    startsAt,
    endsAt,
    startTime: '19:00',
    endTime: '23:00',
    swapOfferedAt: null,
    dropUntil: '2026-11-06T05:00:00.000Z',
    dropUntilText: '07:00 today',
    slotRemoved: false,
  });

  // 19:00 to 23:00 Athens on Friday 6 Nov 2026.
  const evening = booking(
    'evening',
    '2026-11-06T17:00:00.000Z',
    '2026-11-06T21:00:00.000Z',
  );
  // 23:00 to 02:00, touching the evening one.
  const night = booking(
    'night',
    '2026-11-06T21:00:00.000Z',
    '2026-11-07T00:00:00.000Z',
  );
  const start = Date.parse(evening.startsAt);
  const end = Date.parse(evening.endsAt);

  describe('bookingInProgress: half open [startsAt, endsAt)', () => {
    it('is the booking at its start instant', () => {
      expect(bookingInProgress([evening], start)).toBe(evening);
    });

    it('is the booking 1 ms before its end', () => {
      expect(bookingInProgress([evening], end - 1)).toBe(evening);
    });

    it('is null at the end instant: a shift ending at 23:00 is over at 23:00', () => {
      expect(bookingInProgress([evening], end)).toBeNull();
    });

    it('is null 1 ms before the start', () => {
      expect(bookingInProgress([evening], start - 1)).toBeNull();
    });

    it('hands over to the next shift at the shared instant', () => {
      expect(bookingInProgress([evening, night], end)).toBe(night);
      expect(bookingInProgress([night, evening], end - 1)).toBe(evening);
    });

    it('is null with no bookings', () => {
      expect(bookingInProgress([], start)).toBeNull();
    });
  });

  describe('nextBannerChange', () => {
    it('is the soonest start ahead', () => {
      expect(nextBannerChange([night, evening], start - 1000)).toBe(start);
    });

    it('is the end while a shift runs', () => {
      expect(nextBannerChange([evening], start)).toBe(end);
    });

    it('never answers the present instant (strictly ahead)', () => {
      expect(nextBannerChange([evening, night], end)).toBe(
        Date.parse(night.endsAt),
      );
    });

    it('is null once every start and end has passed', () => {
      expect(nextBannerChange([evening], end)).toBeNull();
      expect(nextBannerChange([], start)).toBeNull();
    });

    it('ignores a booking with an unreadable instant', () => {
      const broken = booking('broken', 'not a date', 'nor this');
      expect(nextBannerChange([broken, evening], start - 1)).toBe(start);
      expect(nextBannerChange([broken], start)).toBeNull();
    });
  });
});
