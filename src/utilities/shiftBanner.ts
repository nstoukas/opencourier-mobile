import type { MyShiftBooking } from '@app/services/shifts/shiftsApi';

// Spec 0027 (AC-8): the rider's booking in progress at `serverNowMs`, if any. Half open: a shift
// ending at 23:00 is over at 23:00, and one starting then has begun.
export const bookingInProgress = (
  bookings: MyShiftBooking[],
  serverNowMs: number,
): MyShiftBooking | null =>
  bookings.find(
    booking =>
      Date.parse(booking.startsAt) <= serverNowMs &&
      serverNowMs < Date.parse(booking.endsAt),
  ) ?? null;

// The next moment the banner's words change: the soonest start or end still ahead, or null.
export const nextBannerChange = (
  bookings: MyShiftBooking[],
  serverNowMs: number,
): number | null => {
  const ahead = bookings
    .flatMap(booking => [
      Date.parse(booking.startsAt),
      Date.parse(booking.endsAt),
    ])
    .filter(moment => !Number.isNaN(moment) && moment > serverNowMs);
  return ahead.length > 0 ? Math.min(...ahead) : null;
};
