import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import '@app/localization/i18n';
import { useShifts } from '@app/hooks/useShifts';
import { ShiftBanner } from './ShiftBanner';

jest.mock('@app/hooks/useShifts', () => ({
  useShifts: jest.fn(),
}));

// Spec 0027 (AC-8): "ON SHIFT until 23:00" or "FREE (no shift)", switching on its own at a start or end.
describe('ShiftBanner (spec 0027, AC-8)', () => {
  const MIN = 60_000;
  // The phone's clock in every test: Friday 6 Nov 2026, 16:59 UTC.
  const phoneNow = Date.parse('2026-11-06T16:59:00.000Z');

  const booking = (startsAt: number, endsAt: number, endTime = '23:00') => ({
    id: 'b1',
    shiftSlotId: 'slot-1',
    date: '2026-11-06',
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    startTime: '19:00',
    endTime,
    swapOfferedAt: null,
    dropUntil: '2026-11-06T05:00:00.000Z',
    dropUntilText: '07:00 today',
    slotRemoved: false,
  });

  const shifts = (
    myBookings: ReturnType<typeof booking>[],
    { shiftsOn = true, clockOffsetMs = 0 } = {},
  ) =>
    (useShifts as jest.Mock).mockReturnValue({
      shiftsOn,
      data: shiftsOn
        ? { serverNow: '', occurrences: [], myBookings, clockOffsetMs }
        : undefined,
    });

  const text = () => screen.getByTestId('shift-banner');

  beforeEach(() => {
    jest.useFakeTimers({ now: phoneNow });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is hidden while Shifts are off', () => {
    shifts([], { shiftsOn: false });
    const { toJSON } = render(<ShiftBanner />);
    expect(toJSON()).toBeNull();
  });

  it('is hidden while Shifts are off even with saved bookings', () => {
    (useShifts as jest.Mock).mockReturnValue({
      shiftsOn: false,
      data: {
        serverNow: '',
        occurrences: [],
        myBookings: [booking(phoneNow - MIN, phoneNow + MIN)],
        clockOffsetMs: 0,
      },
    });
    const { toJSON } = render(<ShiftBanner />);
    expect(toJSON()).toBeNull();
  });

  it('reads "FREE (no shift)" with no booking now', () => {
    shifts([booking(phoneNow + 60 * MIN, phoneNow + 300 * MIN)]);
    render(<ShiftBanner />);
    expect(screen.getByText('FREE (no shift)')).toBeTruthy();
    expect(screen.queryByText(/ON SHIFT/)).toBeNull();
  });

  it('shows nothing with Shifts on and no schedule read yet, rather than a FREE that may be wrong (row 78 review)', () => {
    (useShifts as jest.Mock).mockReturnValue({
      shiftsOn: true,
      data: undefined,
    });
    const { toJSON } = render(<ShiftBanner />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByText('FREE (no shift)')).toBeNull();
    expect(screen.queryByTestId('shift-banner')).toBeNull();
  });

  it('reads "ON SHIFT until {endTime}" during a booking, with the server\'s text', () => {
    shifts([booking(phoneNow - MIN, phoneNow + 240 * MIN)]);
    render(<ShiftBanner />);
    expect(screen.getByText('ON SHIFT until 23:00')).toBeTruthy();
  });

  it('reads "ON SHIFT until 24:00" for a midnight end', () => {
    shifts([booking(phoneNow - MIN, phoneNow + 60 * MIN, '24:00')]);
    render(<ShiftBanner />);
    expect(screen.getByText('ON SHIFT until 24:00')).toBeTruthy();
  });

  it("uses the server's clock: a booking that started by the server's clock but not the phone's", () => {
    // The server is 5 minutes ahead; the booking began 2 minutes ago on the server.
    shifts([booking(phoneNow + 3 * MIN, phoneNow + 240 * MIN)], {
      clockOffsetMs: 5 * MIN,
    });
    render(<ShiftBanner />);
    expect(screen.getByText('ON SHIFT until 23:00')).toBeTruthy();
  });

  it('reads FREE at the exact end instant (half open)', () => {
    shifts([booking(phoneNow - 240 * MIN, phoneNow)]);
    render(<ShiftBanner />);
    expect(screen.getByText('FREE (no shift)')).toBeTruthy();
  });

  it('switches to ON SHIFT at the start and back to FREE at the end on its own (no polling)', () => {
    const start = phoneNow + MIN;
    const end = phoneNow + 61 * MIN;
    shifts([booking(start, end)]);
    render(<ShiftBanner />);
    expect(text()).toBeTruthy();
    expect(screen.getByText('FREE (no shift)')).toBeTruthy();

    // Just before the start: still free.
    act(() => {
      jest.advanceTimersByTime(MIN - 10);
    });
    expect(screen.getByText('FREE (no shift)')).toBeTruthy();

    // Past the start (the timer fires 50 ms after it).
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByText('ON SHIFT until 23:00')).toBeTruthy();

    // Past the end.
    act(() => {
      jest.advanceTimersByTime(60 * MIN);
    });
    expect(screen.getByText('FREE (no shift)')).toBeTruthy();
    expect(useShifts).toHaveBeenCalled();
  });

  it('passes inFront to useShifts', () => {
    shifts([]);
    render(<ShiftBanner inFront={false} />);
    expect(useShifts).toHaveBeenCalledWith(false);
  });
});
