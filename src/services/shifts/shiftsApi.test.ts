import { client } from '@app/services/Client';
import { actOnBooking, bookShift, fetchShifts } from './shiftsApi';

jest.mock('@app/services/Client', () => ({
  client: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Spec 0027: the shift calls, and the server's clock as an offset from the phone's.
describe('shiftsApi (spec 0027)', () => {
  const schedule = {
    serverNow: '2026-11-06T10:00:05.000Z',
    occurrences: [],
    myBookings: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchShifts', () => {
    it("GETs 'shifts' and answers data.result", async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: schedule },
      });
      const result = await fetchShifts();
      expect(client.get).toHaveBeenCalledWith('shifts');
      expect(result.serverNow).toBe(schedule.serverNow);
      expect(result.occurrences).toEqual([]);
      expect(result.myBookings).toEqual([]);
    });

    it("clockOffsetMs is the server's clock minus the request's midpoint on the phone", async () => {
      // Sent at 10:00:00.000 and answered at 10:00:02.000 by the phone's clock: midpoint 10:00:01.000.
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(Date.parse('2026-11-06T10:00:00.000Z'))
        .mockReturnValueOnce(Date.parse('2026-11-06T10:00:02.000Z'));
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: schedule },
      });
      const result = await fetchShifts();
      expect(nowSpy).toHaveBeenCalledTimes(2);
      // The server said 10:00:05: four seconds ahead of the phone.
      expect(result.clockOffsetMs).toBe(4000);
    });

    it('a phone clock ahead of the server gives a negative offset', async () => {
      jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(Date.parse('2026-11-06T10:05:00.000Z'))
        .mockReturnValueOnce(Date.parse('2026-11-06T10:05:00.000Z'));
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: schedule },
      });
      expect((await fetchShifts()).clockOffsetMs).toBe(-(5 * 60_000 - 5000));
    });

    it('an unreadable serverNow gives an offset of 0', async () => {
      (client.get as jest.Mock).mockResolvedValue({
        data: { error: null, result: { ...schedule, serverNow: 'nope' } },
      });
      expect((await fetchShifts()).clockOffsetMs).toBe(0);
    });
  });

  describe('changes', () => {
    it("bookShift POSTs 'shifts/bookings' with the slot and the date", async () => {
      (client.post as jest.Mock).mockResolvedValue({
        data: { result: { id: 'b1' } },
      });
      const result = await bookShift('slot-1', '2026-11-06');
      expect(client.post).toHaveBeenCalledWith('shifts/bookings', {
        shiftSlotId: 'slot-1',
        date: '2026-11-06',
      });
      expect(result).toEqual({ id: 'b1' });
    });

    it.each(['drop', 'swap', 'swap/withdraw', 'take'] as const)(
      "actOnBooking POSTs 'shifts/bookings/<id>/%s'",
      async action => {
        (client.post as jest.Mock).mockResolvedValue({
          data: { result: { id: 'b1' } },
        });
        await actOnBooking('b1', action);
        expect(client.post).toHaveBeenCalledWith(
          `shifts/bookings/b1/${action}`,
        );
      },
    );

    it('escapes the booking id in the path', async () => {
      (client.post as jest.Mock).mockResolvedValue({ data: { result: {} } });
      await actOnBooking('a/b?c', 'drop');
      expect(client.post).toHaveBeenCalledWith(
        'shifts/bookings/a%2Fb%3Fc/drop',
      );
    });
  });
});
