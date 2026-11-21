import React from 'react';
import { Alert } from 'react-native';
import { render, screen, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShifts } from '@app/hooks/useShifts';
import type {
  MyShiftBooking,
  ShiftOfflineRecord,
} from '@app/services/shifts/shiftsApi';
import { ShiftsScreen } from './Shifts';

// The screen asks whether it is in front (the drawer keeps it mounted), as Home does.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));

jest.mock('@app/hooks/useShifts', () => ({
  useShifts: jest.fn(),
}));

jest.mock('@app/services/shifts/shiftsApi', () => ({
  bookShift: jest.fn(),
  actOnBooking: jest.fn(),
}));

// Spec 0049 (row 79, AC-5; decision 79.4): the rider's own "went Offline during a booked shift"
// records on the Shifts screen, worded by the server, each with "This changes nothing about your
// offers or pay." Written from the spec. The section is there only when there is a record.
describe('ShiftsScreen: Recorded on your shifts (spec 0049, AC-5)', () => {
  const HEADING = 'Recorded on your shifts';
  const NO_EFFECT = 'This changes nothing about your offers or pay.';
  let queryClient: QueryClient;
  const navigation = { toggleDrawer: jest.fn() } as any;

  const record = (
    overrides: Partial<ShiftOfflineRecord> = {},
  ): ShiftOfflineRecord => ({
    id: 'event-1',
    offlineAt: '2026-11-20T19:10:00.000Z',
    sentence:
      'You went Offline at 21:10 during your shift on Fri 20 Nov, 20:00 to 24:00: you switched to Offline.',
    noEffect: NO_EFFECT,
    ...overrides,
  });

  const mine: MyShiftBooking = {
    id: 'mine-1',
    shiftSlotId: 'slot-fri',
    date: '2026-11-27',
    startsAt: '2026-11-27T17:00:00.000Z',
    endsAt: '2026-11-27T21:00:00.000Z',
    startTime: '19:00',
    endTime: '23:00',
    swapOfferedAt: null,
    dropUntil: '2026-11-27T05:00:00.000Z',
    dropUntilText: '07:00 today',
    slotRemoved: false,
  };

  // `offlineRecords` is passed as given: a list, or left out entirely (an older server).
  const show = (schedule: Record<string, unknown>) =>
    (useShifts as jest.Mock).mockReturnValue({
      data: {
        serverNow: '',
        myBookings: [],
        occurrences: [],
        clockOffsetMs: 0,
        ...schedule,
      },
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

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      // gcTime Infinity schedules no garbage collection timer, so Jest can exit when the file is done.
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('shows the heading, the server sentence and the no effect line for a record', () => {
    show({ offlineRecords: [record()] });
    renderScreen();
    expect(screen.getByText(HEADING)).toBeTruthy();
    const row = within(screen.getByTestId('shift-offline-event-1'));
    expect(
      row.getByText(
        'You went Offline at 21:10 during your shift on Fri 20 Nov, 20:00 to 24:00: you switched to Offline.',
      ),
    ).toBeTruthy();
    expect(row.getByText(NO_EFFECT)).toBeTruthy();
  });

  it('shows the words the server sent, unchanged: the app words nothing itself', () => {
    show({
      offlineRecords: [
        record({
          sentence: 'A sentence only the server could have written.',
          noEffect: 'A no effect line only the server could have written.',
        }),
      ],
    });
    renderScreen();
    const row = within(screen.getByTestId('shift-offline-event-1'));
    expect(
      row.getByText('A sentence only the server could have written.'),
    ).toBeTruthy();
    expect(
      row.getByText('A no effect line only the server could have written.'),
    ).toBeTruthy();
    expect(screen.queryByText(NO_EFFECT)).toBeNull();
  });

  it('shows every record, each with its own sentence and no effect line, in the order sent', () => {
    show({
      offlineRecords: [
        record({
          id: 'event-2',
          sentence:
            'You went Offline at 22:30 during your shift on Sat 21 Nov, 20:00 to 24:00: an admin set you Offline.',
        }),
        record(),
      ],
    });
    renderScreen();
    expect(screen.getAllByText(HEADING)).toHaveLength(1);
    expect(screen.getAllByText(NO_EFFECT)).toHaveLength(2);
    const rows = screen.getAllByTestId(/^shift-offline-/);
    expect(rows.map(node => node.props.testID)).toEqual([
      'shift-offline-event-2',
      'shift-offline-event-1',
    ]);
    expect(
      within(rows[0]).getByText(/22:30.*an admin set you Offline\.$/),
    ).toBeTruthy();
    expect(
      within(rows[1]).getByText(/21:10.*you switched to Offline\.$/),
    ).toBeTruthy();
  });

  it('shows nothing of it when the list is empty', () => {
    show({ offlineRecords: [] });
    renderScreen();
    expect(screen.queryByText(HEADING)).toBeNull();
    expect(screen.queryByText(NO_EFFECT)).toBeNull();
    expect(screen.queryAllByTestId(/^shift-offline-/)).toHaveLength(0);
    // The rest of the screen is there.
    expect(screen.getByText('Your shifts')).toBeTruthy();
    expect(screen.getByText('Next 14 days')).toBeTruthy();
  });

  it('shows nothing of it, and does not crash, when an older server sends no offlineRecords', () => {
    show({});
    renderScreen();
    expect(screen.queryByText(HEADING)).toBeNull();
    expect(screen.queryByText(NO_EFFECT)).toBeNull();
    expect(screen.queryAllByTestId(/^shift-offline-/)).toHaveLength(0);
    expect(screen.getByText('Your shifts')).toBeTruthy();
    expect(screen.getByText('Next 14 days')).toBeTruthy();
  });

  it("sits with the rider's own shifts: a booking is still listed beside a record", () => {
    show({ myBookings: [mine], offlineRecords: [record()] });
    renderScreen();
    expect(screen.getByTestId('shift-offline-event-1')).toBeTruthy();
    expect(screen.getByText('Your shifts')).toBeTruthy();
    expect(screen.queryByText('No shifts booked.')).toBeNull();
  });

  // Value 5: a record, never a tally or a mark against the rider.
  it('shows no count of the records and nothing to tap on them', () => {
    show({
      offlineRecords: [
        record({ id: 'a', sentence: 'First sentence.' }),
        record({ id: 'b', sentence: 'Second sentence.' }),
        record({ id: 'c', sentence: 'Third sentence.' }),
      ],
    });
    renderScreen();
    const heading = screen.getByText(HEADING);
    expect(heading.props.children).toBe(HEADING);
    expect(screen.queryByText(/\b3\b/)).toBeNull();
    for (const node of screen.getAllByTestId(/^shift-offline-/)) {
      expect(within(node).queryAllByRole('button')).toHaveLength(0);
      expect(node.props.onPress).toBeUndefined();
    }
  });
});
