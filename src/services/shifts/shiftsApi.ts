import { client } from '@app/services/Client';

// Spec 0027 (row 78): the rider's shifts. Every time the app shows comes from the server as Athens text
// (startTime, endTime, date, dropUntilText): the phone never formats an instant in its own zone.

export type ShiftOccurrence = {
  shiftSlotId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  startTime: string;
  endTime: string;
  riderCap: number;
  placesTaken: number;
  myBookingId: string | null;
  // Another rider's open swap: its booking id only, never who offered it (value 5).
  openSwap: { bookingId: string } | null;
};

export type MyShiftBooking = {
  id: string;
  shiftSlotId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  startTime: string;
  endTime: string;
  swapOfferedAt: string | null;
  dropUntil: string;
  dropUntilText: string;
  slotRemoved: boolean;
};

export type ShiftSchedule = {
  serverNow: string;
  occurrences: ShiftOccurrence[];
  myBookings: MyShiftBooking[];
  // The server's clock minus the phone's at the moment the answer was built (the request's midpoint),
  // so the banner and the reminders use the server's time whatever the phone's clock says.
  clockOffsetMs: number;
};

export const fetchShifts = async (): Promise<ShiftSchedule> => {
  const sentAt = Date.now();
  const { data } = await client.get('shifts');
  const receivedAt = Date.now();
  // Every response is wrapped by the backend as { error, result }.
  const result = data.result as Omit<ShiftSchedule, 'clockOffsetMs'>;
  const serverNow = Date.parse(result.serverNow);
  const clockOffsetMs = Number.isNaN(serverNow)
    ? 0
    : serverNow - (sentAt + receivedAt) / 2;
  return { ...result, clockOffsetMs };
};

export const bookShift = async (
  shiftSlotId: string,
  date: string,
): Promise<MyShiftBooking> => {
  const { data } = await client.post('shifts/bookings', { shiftSlotId, date });
  return data.result;
};

export type BookingAction = 'drop' | 'swap' | 'swap/withdraw' | 'take';

export const actOnBooking = async (
  bookingId: string,
  action: BookingAction,
): Promise<MyShiftBooking> => {
  const { data } = await client.post(
    `shifts/bookings/${encodeURIComponent(bookingId)}/${action}`,
  );
  return data.result;
};
