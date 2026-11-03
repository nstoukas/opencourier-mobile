import React from 'react';
import { Alert, AlertButton } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import i18n from '@app/localization/i18n';
import { useShifts } from '@app/hooks/useShifts';
import { actOnBooking, bookShift } from '@app/services/shifts/shiftsApi';
import type {
  MyShiftBooking,
  ShiftOccurrence,
} from '@app/services/shifts/shiftsApi';
import { ShiftsScreen } from './Shifts';

jest.mock('@app/hooks/useShifts', () => ({
  useShifts: jest.fn(),
}));

jest.mock('@app/services/shifts/shiftsApi', () => ({
  bookShift: jest.fn(),
  actOnBooking: jest.fn(),
}));

// Spec 0027 (AC-10): the rider's shifts and the next 14 days, with the actions each state allows.
describe('ShiftsScreen (spec 0027, AC-10)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;
  const navigation = { toggleDrawer: jest.fn() } as any;

  const mine = (overrides: Partial<MyShiftBooking> = {}): MyShiftBooking => ({
    id: 'mine-1',
    shiftSlotId: 'slot-fri',
    date: '2026-11-06',
    startsAt: '2026-11-06T17:00:00.000Z',
    endsAt: '2026-11-06T21:00:00.000Z',
    startTime: '19:00',
    endTime: '23:00',
    swapOfferedAt: null,
    dropUntil: '2026-11-06T05:00:00.000Z',
    dropUntilText: '07:00 today',
    slotRemoved: false,
    ...overrides,
  });

  const occurrence = (
    shiftSlotId: string,
    date: string,
    overrides: Partial<ShiftOccurrence> = {},
  ): ShiftOccurrence => ({
    shiftSlotId,
    date,
    startsAt: `${date}T17:00:00.000Z`,
    endsAt: `${date}T21:00:00.000Z`,
    startTime: '19:00',
    endTime: '23:00',
    riderCap: 3,
    placesTaken: 0,
    myBookingId: null,
    openSwap: null,
    ...overrides,
  });

  const show = (myBookings: MyShiftBooking[], occurrences: ShiftOccurrence[]) =>
    (useShifts as jest.Mock).mockReturnValue({
      data: { serverNow: '', myBookings, occurrences, clockOffsetMs: 0 },
      isFetching: false,
      isLoading: false,
      refetch: jest.fn(),
      shiftsOn: true,
    });

  const renderScreen = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ShiftsScreen navigation={navigation} route={{} as any} />
      </QueryClientProvider>,
    );

  const row = (testID: string) => within(screen.getByTestId(testID));

  const refusal = (status: number, message?: string) => {
    const error = new AxiosError('refused');
    error.response = {
      status,
      statusText: '',
      headers: {},
      config: {} as any,
      data: message ? { result: [{ message, statusCode: status }] } : {},
    };
    return error;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      // gcTime Infinity schedules no garbage collection timer, so Jest can exit when the file is done.
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (bookShift as jest.Mock).mockResolvedValue({ id: 'new' });
    (actOnBooking as jest.Mock).mockResolvedValue({ id: 'mine-1' });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    queryClient.clear();
  });

  it("shows the two sections, the rider's shifts and the next 14 days, by date", () => {
    show(
      [mine()],
      [
        occurrence('slot-fri', '2026-11-06'),
        occurrence('slot-sat', '2026-11-07'),
      ],
    );
    renderScreen();
    expect(screen.getByText('Your shifts')).toBeTruthy();
    expect(screen.getByText('Next 14 days')).toBeTruthy();
    // The Athens date as a label, never formatted from an instant.
    expect(screen.getByText('Fri 6 Nov')).toBeTruthy();
    expect(screen.getByText('Sat 7 Nov')).toBeTruthy();
    expect(
      row('my-shift-mine-1').getByText(/Fri 6 Nov · 19:00–\s*23:00/),
    ).toBeTruthy();
    expect(
      row('my-shift-mine-1').getByText('You can drop it until 07:00 today.'),
    ).toBeTruthy();
  });

  it('shows the empty sentences when there is nothing', () => {
    show([], []);
    renderScreen();
    expect(screen.getByText('No shifts booked.')).toBeTruthy();
    expect(screen.getByText('No shifts on the schedule.')).toBeTruthy();
  });

  describe('actions per state', () => {
    it('a booked shift: Drop and Offer swap, no Withdraw', () => {
      show([mine()], []);
      renderScreen();
      const r = row('my-shift-mine-1');
      expect(r.getByText('Drop')).toBeTruthy();
      expect(r.getByText('Offer swap')).toBeTruthy();
      expect(r.queryByText('Withdraw swap')).toBeNull();
    });

    it('an offered shift: Drop and Withdraw swap, and the offered sentence', () => {
      show([mine({ swapOfferedAt: '2026-11-02T00:00:00.000Z' })], []);
      renderScreen();
      const r = row('my-shift-mine-1');
      expect(r.getByText('Drop')).toBeTruthy();
      expect(r.getByText('Withdraw swap')).toBeTruthy();
      expect(r.queryByText('Offer swap')).toBeNull();
      expect(
        r.getByText('Offered as a swap. Another rider can take it.'),
      ).toBeTruthy();
    });

    it("a removed slot's booking: Drop only, no Offer swap", () => {
      show([mine({ slotRemoved: true })], []);
      renderScreen();
      const r = row('my-shift-mine-1');
      expect(r.getByText('Drop')).toBeTruthy();
      expect(r.queryByText('Offer swap')).toBeNull();
    });

    it("a removed slot's offered booking can still be withdrawn", () => {
      show(
        [
          mine({
            slotRemoved: true,
            swapOfferedAt: '2026-11-02T00:00:00.000Z',
          }),
        ],
        [],
      );
      renderScreen();
      expect(row('my-shift-mine-1').getByText('Withdraw swap')).toBeTruthy();
    });

    it('an occurrence the rider booked: "Booked", no button', () => {
      show(
        [],
        [occurrence('slot-fri', '2026-11-06', { myBookingId: 'mine-1' })],
      );
      renderScreen();
      const r = row('occurrence-slot-fri-2026-11-06');
      expect(r.getByText('Booked')).toBeTruthy();
      expect(r.queryByText('Book')).toBeNull();
      expect(r.queryByText('Take swap')).toBeNull();
    });

    it('an occurrence the rider booked shows no Take swap even with an open swap on it', () => {
      show(
        [],
        [
          occurrence('slot-fri', '2026-11-06', {
            myBookingId: 'mine-1',
            openSwap: { bookingId: 'swap-9' },
          }),
        ],
      );
      renderScreen();
      expect(
        row('occurrence-slot-fri-2026-11-06').queryByText('Take swap'),
      ).toBeNull();
    });

    it('an open swap: Take swap (even when full)', () => {
      show(
        [],
        [
          occurrence('slot-fri', '2026-11-06', {
            placesTaken: 3,
            openSwap: { bookingId: 'swap-9' },
          }),
        ],
      );
      renderScreen();
      const r = row('occurrence-slot-fri-2026-11-06');
      expect(r.getByText('Take swap')).toBeTruthy();
      expect(r.queryByText('Book')).toBeNull();
    });

    it('a free occurrence: Book', () => {
      show([], [occurrence('slot-fri', '2026-11-06', { placesTaken: 1 })]);
      renderScreen();
      const r = row('occurrence-slot-fri-2026-11-06');
      expect(r.getByText('Book')).toBeTruthy();
      expect(r.getByText('2 places left')).toBeTruthy();
    });

    it('a full occurrence: "Full" and no button', () => {
      show([], [occurrence('slot-fri', '2026-11-06', { placesTaken: 3 })]);
      renderScreen();
      const r = row('occurrence-slot-fri-2026-11-06');
      expect(r.getByText('Full')).toBeTruthy();
      expect(r.queryByText('Book')).toBeNull();
      expect(r.queryByText('Take swap')).toBeNull();
    });

    it('a lowered cap below the places taken still reads Full', () => {
      show(
        [],
        [occurrence('slot-fri', '2026-11-06', { riderCap: 2, placesTaken: 3 })],
      );
      renderScreen();
      expect(
        row('occurrence-slot-fri-2026-11-06').getByText('Full'),
      ).toBeTruthy();
    });
  });

  it('counts places per occurrence only: "1 place left" and "2 places left" (i18next v3 plurals)', () => {
    show(
      [],
      [
        occurrence('slot-a', '2026-11-06', { riderCap: 3, placesTaken: 2 }),
        occurrence('slot-b', '2026-11-06', { riderCap: 3, placesTaken: 1 }),
      ],
    );
    renderScreen();
    expect(
      row('occurrence-slot-a-2026-11-06').getByText('1 place left'),
    ).toBeTruthy();
    expect(
      row('occurrence-slot-b-2026-11-06').getByText('2 places left'),
    ).toBeTruthy();
    expect(i18n.t('translations:shift_places_left', { count: 1 })).toBe(
      '1 place left',
    );
    expect(i18n.t('translations:shift_places_left', { count: 5 })).toBe(
      '5 places left',
    );
  });

  describe('each action calls its route', () => {
    it('Book calls bookShift with the slot and the date', async () => {
      show([], [occurrence('slot-fri', '2026-11-13')]);
      renderScreen();
      fireEvent.press(row('occurrence-slot-fri-2026-11-13').getByText('Book'));
      await waitFor(() =>
        expect(bookShift).toHaveBeenCalledWith('slot-fri', '2026-11-13'),
      );
      expect(actOnBooking).not.toHaveBeenCalled();
    });

    it("Take swap calls take on the open swap's booking id", async () => {
      show(
        [],
        [
          occurrence('slot-fri', '2026-11-06', {
            openSwap: { bookingId: 'swap-9' },
          }),
        ],
      );
      renderScreen();
      fireEvent.press(screen.getByText('Take swap'));
      await waitFor(() =>
        expect(actOnBooking).toHaveBeenCalledWith('swap-9', 'take'),
      );
    });

    it('Offer swap calls swap', async () => {
      show([mine()], []);
      renderScreen();
      fireEvent.press(screen.getByText('Offer swap'));
      await waitFor(() =>
        expect(actOnBooking).toHaveBeenCalledWith('mine-1', 'swap'),
      );
    });

    it('Withdraw swap calls swap/withdraw', async () => {
      show([mine({ swapOfferedAt: '2026-11-02T00:00:00.000Z' })], []);
      renderScreen();
      fireEvent.press(screen.getByText('Withdraw swap'));
      await waitFor(() =>
        expect(actOnBooking).toHaveBeenCalledWith('mine-1', 'swap/withdraw'),
      );
    });

    it('reads the schedule again after a change', async () => {
      const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
      show([mine()], []);
      renderScreen();
      fireEvent.press(screen.getByText('Offer swap'));
      await waitFor(() =>
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['shifts'] }),
      );
    });
  });

  describe('Drop asks first', () => {
    it('pressing Drop shows the confirm and calls nothing yet', () => {
      show([mine()], []);
      renderScreen();
      fireEvent.press(screen.getByText('Drop'));
      expect(alertSpy).toHaveBeenCalledTimes(1);
      const [title, body] = alertSpy.mock.calls[0];
      expect(title).toBe('Drop this shift?');
      expect(body).toBe(
        'Fri 6 Nov, 19:00–23:00. Its place goes back on the schedule.',
      );
      expect(actOnBooking).not.toHaveBeenCalled();
    });

    it('Cancel calls nothing; the Drop button in the confirm calls drop', async () => {
      show([mine()], []);
      renderScreen();
      fireEvent.press(screen.getByText('Drop'));
      const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
      const cancel = buttons.find(button => button.style === 'cancel')!;
      const confirm = buttons.find(button => button.style === 'destructive')!;
      expect(confirm.text).toBe('Drop');
      cancel.onPress?.();
      expect(actOnBooking).not.toHaveBeenCalled();
      confirm.onPress?.();
      await waitFor(() =>
        expect(actOnBooking).toHaveBeenCalledWith('mine-1', 'drop'),
      );
    });
  });

  describe("refusals show the server's sentence", () => {
    it.each([
      'This swap was just taken.',
      'This shift just filled up.',
      'This shift can no longer be dropped. You could drop it until 07:00 today; you can still offer it as a swap.',
    ])('%s', async sentence => {
      (actOnBooking as jest.Mock).mockRejectedValue(refusal(409, sentence));
      (bookShift as jest.Mock).mockRejectedValue(refusal(409, sentence));
      show([mine()], [occurrence('slot-fri', '2026-11-13')]);
      renderScreen();
      fireEvent.press(screen.getByText('Book'));
      expect(await screen.findByTestId('shift-message')).toBeTruthy();
      expect(screen.getByTestId('shift-message').props.children).toBe(sentence);
    });

    it('a 404 sentence shows too', async () => {
      (actOnBooking as jest.Mock).mockRejectedValue(
        refusal(404, 'No open swap here.'),
      );
      show(
        [],
        [
          occurrence('slot-fri', '2026-11-06', {
            openSwap: { bookingId: 'swap-9' },
          }),
        ],
      );
      renderScreen();
      fireEvent.press(screen.getByText('Take swap'));
      expect(await screen.findByText('No open swap here.')).toBeTruthy();
    });

    it("no answer from the server shows the app's own sentence", async () => {
      (actOnBooking as jest.Mock).mockRejectedValue(
        new AxiosError('Network Error'),
      );
      show([mine()], []);
      renderScreen();
      fireEvent.press(screen.getByText('Offer swap'));
      expect(
        await screen.findByText(
          "Couldn't reach the co-op. Try again when you have signal.",
        ),
      ).toBeTruthy();
    });
  });
});
