import React from 'react';
import {
  render,
  screen,
  fireEvent,
  act,
  within,
} from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { TimeWorkedSection } from './TimeWorkedSection';
import { useTimeWorkedPages, useCoopTotals } from '@app/hooks/useTimeWorked';
import { useNavigation } from '@react-navigation/native';
import {
  CoopTotals,
  TimeWorkedRange,
  WorkedDay,
  WorkedShift,
} from '@app/types/timeWorked';

jest.mock('@app/hooks/useTimeWorked', () => ({
  useTimeWorkedPages: jest.fn(),
  useCoopTotals: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

describe('TimeWorkedSection (spec 0040, AC-8, AC-11, AC-12)', () => {
  let mockFocusListener: (() => void) | undefined;
  const mockRefetchPages = jest.fn();
  const mockRefetchCoop = jest.fn();
  const mockFetchNextPage = jest.fn();

  const defaultNavigation = {
    addListener: jest.fn((event: string, callback: () => void) => {
      if (event === 'focus') {
        mockFocusListener = callback;
      }
      return jest.fn();
    }),
  };

  const sampleCoop: CoopTotals = {
    thisWeek: {
      weekStart: '2026-11-16',
      tooFewRiders: false,
      workSeconds: 152100, // 42h15
      unpaidShare: 0.25, // 25%
      centsPerHour: 1250, // €12.50/h
    },
    lastWeek: {
      weekStart: '2026-11-09',
      tooFewRiders: true,
    },
  };

  const sampleShift: WorkedShift = {
    startedAt: '2026-11-20T10:00:00.000Z',
    startedBeforeRange: false,
    endedAt: '2026-11-20T13:12:00.000Z',
    onBreakSince: null,
    workSeconds: 11520, // 3h12
    jobSeconds: 7200, // 2h00
    paidWaitSeconds: 720, // 12 min
    unpaidSeconds: 3600, // 1h00
    breaks: [
      {
        startedAt: '2026-11-20T11:00:00.000Z',
        endedAt: '2026-11-20T11:15:00.000Z',
      },
    ],
    moneyCents: 3850,
    lateMoneyCents: 0,
    centsPerHour: 1203,
    currencyCode: 'EUR',
    statusChanges: [
      {
        at: '2026-11-20T10:00:00.000Z',
        fromStatus: 'OFFLINE',
        toStatus: 'ONLINE',
        cause: 'RIDER',
        byAdmin: false,
      },
      {
        at: '2026-11-20T13:12:00.000Z',
        fromStatus: 'ONLINE',
        toStatus: 'OFFLINE',
        cause: 'ADMIN',
        byAdmin: true,
      },
      {
        at: '2026-11-20T13:15:00.000Z',
        fromStatus: 'ONLINE',
        toStatus: 'OFFLINE',
        cause: 'CUT_OFF',
        byAdmin: true,
      },
      {
        at: '2026-11-20T13:20:00.000Z',
        fromStatus: 'ONLINE',
        toStatus: 'OFFLINE',
        cause: 'CUT_OFF',
        byAdmin: false,
      },
      {
        at: '2026-11-20T13:25:00.000Z',
        fromStatus: 'LAST_CALL',
        toStatus: 'OFFLINE',
        cause: 'LAST_CALL_ACCEPTED',
        byAdmin: false,
      },
      {
        at: '2026-11-20T13:30:00.000Z',
        fromStatus: 'OFFLINE',
        toStatus: 'ONLINE',
        cause: 'SYSTEM_START',
        byAdmin: false,
      },
    ],
    jobs: [
      {
        deliveryId: 'del-1',
        pickupName: 'Souvlaki Bar',
        acceptedAt: '2026-11-20T10:10:00.000Z',
        endedAt: '2026-11-20T10:45:00.000Z',
        endEventType: 'DROPPED_OFF',
        droppedOff: true,
        deliveryMoneyCents: 500,
        paidWaitSeconds: 300,
        compensations: [
          {
            id: 'comp-1',
            reason: 'WAITING',
            amountCents: 150,
            createdAt: '2026-11-20T10:30:00.000Z',
            addedLater: false,
          },
          {
            id: 'comp-2',
            reason: 'REVIEW',
            amountCents: 200,
            createdAt: '2026-11-22T10:00:00.000Z',
            addedLater: true,
          },
        ],
      },
      {
        deliveryId: 'del-2',
        pickupName: 'Burger House',
        acceptedAt: '2026-11-20T11:30:00.000Z',
        endedAt: '2026-11-20T12:00:00.000Z',
        endEventType: 'CANCELED',
        droppedOff: false,
        deliveryMoneyCents: 0,
        paidWaitSeconds: 0,
        compensations: [],
      },
    ],
  };

  const sampleDay: WorkedDay = {
    date: '2026-11-20',
    workSeconds: 11520, // 3h12
    jobSeconds: 7200, // 2h00
    paidWaitSeconds: 720, // 12 min
    unpaidSeconds: 3600, // 1h00
    moneyCents: 3850,
    centsPerHour: 1203,
    unlinkedMoneyCents: 0,
  };

  const samplePage: TimeWorkedRange = {
    recordedFrom: '2026-11-19T00:00:00.000Z',
    currencyCode: 'EUR',
    days: [sampleDay],
    shifts: [sampleShift],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusListener = undefined;
    (useNavigation as jest.Mock).mockReturnValue(defaultNavigation);

    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: { pages: [samplePage] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    (useCoopTotals as jest.Mock).mockReturnValue({
      data: sampleCoop,
      refetch: mockRefetchCoop,
    });
  });

  it('renders "Time worked is recorded from <date>." when recordedFrom is provided', () => {
    render(<TimeWorkedSection />);
    expect(
      screen.getByText('Time worked is recorded from 19 Nov 2026.'),
    ).toBeTruthy();
  });

  it('renders "Time worked is recorded from today." when recordedFrom is null', () => {
    const pageNullRecorded: TimeWorkedRange = {
      ...samplePage,
      recordedFrom: null,
    };
    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: { pages: [pageNullRecorded] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    render(<TimeWorkedSection />);
    expect(
      screen.getByText(i18n.t('translations:time_worked_recorded_from_today')),
    ).toBeTruthy();
  });

  it('renders day block with total, split, and break lines', () => {
    render(<TimeWorkedSection />);

    // Day total line
    expect(screen.getByText(/3h12 worked · €38\.50/)).toBeTruthy();
    // Day split line (rendered for day total and for shift)
    expect(
      screen.getAllByText('Jobs 2h00 · Paid waiting 12 min · Unpaid 1h00')
        .length,
    ).toBeGreaterThanOrEqual(1);

    // Shift break line
    expect(screen.getByText(/Break \d{2}:\d{2} to \d{2}:\d{2}/)).toBeTruthy();
  });

  it('renders "Started before these days" when shift has startedBeforeRange: true', () => {
    const shiftStartedBefore: WorkedShift = {
      ...sampleShift,
      startedBeforeRange: true,
    };
    const pageWithStartedBefore: TimeWorkedRange = {
      ...samplePage,
      shifts: [shiftStartedBefore],
    };
    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: { pages: [pageWithStartedBefore] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    render(<TimeWorkedSection />);
    expect(
      screen.getByText(i18n.t('translations:time_worked_started_before')),
    ).toBeTruthy();
  });

  it('tapping on a shift opens its details with status changes in words and job pay/compensations', () => {
    render(<TimeWorkedSection />);

    // Initially details are not visible
    expect(screen.queryByTestId('time-worked-shift-details')).toBeNull();

    // Tap to expand shift details
    const shiftButton = screen.getByTestId('time-worked-shift');
    fireEvent.press(shiftButton);

    // Details are now visible
    expect(screen.getByTestId('time-worked-shift-details')).toBeTruthy();

    // Status changes in words (never an admin's name or email)
    expect(
      screen.getByText(/\d{2}:\d{2} Offline to Online, by you/),
    ).toBeTruthy();
    expect(
      screen.getByText(/\d{2}:\d{2} Online to Offline, by an admin/),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /\d{2}:\d{2} Online to Offline, when an admin changed your password/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /\d{2}:\d{2} Online to Offline, when your password changed/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /\d{2}:\d{2} Last call to Offline, when you accepted your last job/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/\d{2}:\d{2} Offline to Online, when recording began/),
    ).toBeTruthy();

    // Security/Privacy: Verify no email addresses or names are rendered
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.queryByText(/admin@/)).toBeNull();

    // Jobs details
    expect(screen.getByText(/Souvlaki Bar/)).toBeTruthy();
    expect(screen.getByText('Delivery pay €5.00')).toBeTruthy();
    expect(screen.getByText('Waiting €1.50')).toBeTruthy();
    expect(
      screen.getByText('Review correction €2.00, added 22 Nov'),
    ).toBeTruthy();

    // Non-delivered job
    expect(screen.getByText(/Burger House/)).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:time_worked_job_not_delivered')),
    ).toBeTruthy();
  });

  it('shows "Earlier" button only while useTimeWorkedPages has a next page and calls fetchNextPage on tap', () => {
    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: { pages: [samplePage] },
      isLoading: false,
      isError: false,
      hasNextPage: true,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    render(<TimeWorkedSection />);

    const earlierButton = screen.getByTestId('time-worked-earlier');
    expect(earlierButton).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:time_worked_earlier')),
    ).toBeTruthy();

    fireEvent.press(earlierButton);
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('hides "Earlier" button when hasNextPage is false', () => {
    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: { pages: [samplePage] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    render(<TimeWorkedSection />);
    expect(screen.queryByTestId('time-worked-earlier')).toBeNull();
  });

  it('Co-op this week card: shows "Too few riders this week to show figures" and no figures for small week, work hours/unpaid share/rate for normal week', () => {
    render(<TimeWorkedSection />);

    const coopCard = screen.getByTestId('coop-week-card');
    expect(coopCard).toBeTruthy();

    // Normal week (thisWeek):
    // 152100 s = 42h15, share = 25%, rate = €12.50/h
    expect(
      screen.getByText(/42h15 worked · 25% unpaid · €12\.50\/h/),
    ).toBeTruthy();

    // Small week (lastWeek):
    expect(
      screen.getByText(i18n.t('translations:time_worked_too_few')),
    ).toBeTruthy();
  });

  it('renders "<amount> paid for work outside a recorded shift" when day has unlinkedMoneyCents > 0', () => {
    const dayWithUnlinked: WorkedDay = {
      ...sampleDay,
      unlinkedMoneyCents: 150, // €1.50
    };
    const pageWithUnlinked: TimeWorkedRange = {
      ...samplePage,
      days: [dayWithUnlinked],
    };

    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: { pages: [pageWithUnlinked] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    render(<TimeWorkedSection />);

    expect(
      screen.getByText('€1.50 paid for work outside a recorded shift'),
    ).toBeTruthy();
  });

  it('groups a shift by Athens day (decision 36.48) and shows clock times in Athens time', () => {
    // 2026-11-18T22:30:00Z in UTC:
    // In Europe/Athens (UTC+2 in Nov): it is 2026-11-19 00:30.
    // If phone/machine timezone is UTC, moment().format('YYYY-MM-DD') would be 2026-11-18.
    // coopDate and coopClock ensure it is grouped under 2026-11-19 and starts at 00:30.
    const athensShift: WorkedShift = {
      ...sampleShift,
      startedAt: '2026-11-18T22:30:00.000Z',
      endedAt: '2026-11-19T02:00:00.000Z', // 04:00 in Athens
      startedBeforeRange: false,
    };

    const day19: WorkedDay = {
      ...sampleDay,
      date: '2026-11-19',
    };

    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            ...samplePage,
            days: [day19],
            shifts: [athensShift],
          },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    render(<TimeWorkedSection />);

    const dayBlock = screen.getByTestId('time-worked-day');
    expect(dayBlock).toBeTruthy();
    expect(within(dayBlock).getByText('Thu 19 Nov')).toBeTruthy();

    // The shift must be listed inside this day block, starting at 00:30
    const shiftRow = within(dayBlock).getByTestId('time-worked-shift');
    expect(shiftRow).toBeTruthy();
    expect(within(shiftRow).getByText(/00:30 to 04:00/)).toBeTruthy();
  });

  it('deduplicates shifts: two pages that both list the same shift (same startedAt) show it once (AC-11)', () => {
    const page1: TimeWorkedRange = {
      ...samplePage,
      days: [sampleDay],
      shifts: [sampleShift],
    };
    const page2: TimeWorkedRange = {
      ...samplePage,
      days: [{ ...sampleDay, date: '2026-11-13' }],
      shifts: [sampleShift],
    };

    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: { pages: [page1, page2] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    render(<TimeWorkedSection />);

    const shifts = screen.getAllByTestId('time-worked-shift');
    expect(shifts).toHaveLength(1);
  });

  it('renders orphan shifts AFTER every day block, with multiple orphans sorted newest first (AC-11)', () => {
    // todayShift starts at 10:00 UTC (12:00 Athens) on 2026-11-20
    const todayShift: WorkedShift = {
      ...sampleShift,
      startedAt: '2026-11-20T10:00:00.000Z',
      endedAt: '2026-11-20T11:00:00.000Z',
    };

    // orphanNewer starts at 08:00 UTC (10:00 Athens) on 2026-11-10
    const orphanNewer: WorkedShift = {
      ...sampleShift,
      startedAt: '2026-11-10T08:00:00.000Z',
      endedAt: '2026-11-10T10:00:00.000Z',
    };

    // orphanOlder starts at 07:00 UTC (09:00 Athens) on 2026-11-05
    const orphanOlder: WorkedShift = {
      ...sampleShift,
      startedAt: '2026-11-05T07:00:00.000Z',
      endedAt: '2026-11-05T08:30:00.000Z',
    };

    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            ...samplePage,
            days: [sampleDay], // only day 2026-11-20
            shifts: [todayShift, orphanOlder, orphanNewer],
          },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    render(<TimeWorkedSection />);

    const shiftRows = screen.getAllByTestId('time-worked-shift');
    expect(shiftRows).toHaveLength(3);

    // Day block must contain todayShift, so shiftRows[0] is today's shift (12:00 to 13:00 Athens)
    expect(within(shiftRows[0]).getByText(/12:00 to 13:00/)).toBeTruthy();
    expect(
      within(screen.getByTestId('time-worked-day')).getByText(/12:00 to 13:00/),
    ).toBeTruthy();

    // After all day blocks come the orphans, sorted newest first:
    // shiftRows[1] is orphanNewer (10:00 to 12:00 Athens, Nov 10)
    expect(within(shiftRows[1]).getByText(/10:00 to 12:00/)).toBeTruthy();
    // shiftRows[2] is orphanOlder (09:00 to 10:30 Athens, Nov 5)
    expect(within(shiftRows[2]).getByText(/09:00 to 10:30/)).toBeTruthy();
  });

  it('shows "could not be loaded" line when pages.isError is true and no page is loaded (AC-11)', () => {
    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    render(<TimeWorkedSection />);

    expect(
      screen.getByText(i18n.t('translations:time_worked_failed')),
    ).toBeTruthy();
  });

  it('shows "no time worked" line when first page has no days and no shifts (AC-11)', () => {
    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            recordedFrom: '2026-11-19T00:00:00.000Z',
            currencyCode: 'EUR',
            days: [],
            shifts: [],
          },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    render(<TimeWorkedSection />);

    expect(
      screen.getByText(i18n.t('translations:time_worked_none')),
    ).toBeTruthy();
  });

  it('shows "added later" line when a shift has lateMoneyCents > 0 (AC-11)', () => {
    const shiftWithLateMoney: WorkedShift = {
      ...sampleShift,
      lateMoneyCents: 250, // €2.50
    };

    (useTimeWorkedPages as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            ...samplePage,
            shifts: [shiftWithLateMoney],
          },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetchPages,
    });

    render(<TimeWorkedSection />);

    expect(
      screen.getByText(
        i18n.t('translations:time_worked_added_later', { amount: '€2.50' }),
      ),
    ).toBeTruthy();
  });

  it('refetches pages and coop totals when the screen gains focus', () => {
    render(<TimeWorkedSection />);

    expect(defaultNavigation.addListener).toHaveBeenCalledWith(
      'focus',
      expect.any(Function),
    );
    expect(mockFocusListener).toBeDefined();

    act(() => {
      mockFocusListener!();
    });

    expect(mockRefetchPages).toHaveBeenCalledTimes(1);
    expect(mockRefetchCoop).toHaveBeenCalledTimes(1);
  });
});
