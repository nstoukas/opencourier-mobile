import React from 'react';
import { RefreshControl } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { AxiosError } from 'axios';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { Earnings } from './Earnings';
import { useEarningsMonth, useEarningsMonths } from '@app/hooks/useEarnings';
import { useCoopTotals } from '@app/hooks/useTimeWorked';
import { useReviewRequests } from '@app/hooks/useReviewRequests';
import { useReviewSeen } from '@app/services/reviewSeen';
import { queryClient } from '@app/services/queryClient';
import { MainScreens } from '@app/navigation/main/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  EarningsDay,
  EarningsJob,
  EarningsMonth,
  EarningsShift,
  EarningsWeek,
} from '@app/types/earnings';

jest.mock('@app/hooks/useEarnings', () => {
  const actual = jest.requireActual('@app/hooks/useEarnings');
  return {
    ...actual,
    useEarningsMonth: jest.fn(),
    useEarningsMonths: jest.fn(),
  };
});
jest.mock('@app/hooks/useTimeWorked');
jest.mock('@app/hooks/useReviewRequests');
jest.mock('@app/services/reviewSeen');

describe('Earnings screen (spec 0042 AC-1, AC-2, AC-6, AC-8, AC-9, AC-13)', () => {
  let focusCallback: (() => void) | undefined;
  const mockNavigation: any = {
    navigate: jest.fn(),
    toggleDrawer: jest.fn(),
    addListener: jest.fn((event: string, cb: () => void) => {
      if (event === 'focus') {
        focusCallback = cb;
      }
      return jest.fn();
    }),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
  };

  const sampleJobDelivered: EarningsJob = {
    deliveryId: 'del-job-1',
    acceptedAt: '2026-11-20T12:00:00.000Z', // 14:00 Athens
    endedAt: '2026-11-20T12:20:00.000Z',
    endEventType: 'DROPPED_OFF',
    droppedOff: true,
    deliveryMoneyCents: 400,
    paidWaitSeconds: 66,
    compensations: [
      {
        id: 'comp-1',
        reason: 'WAITING',
        amountCents: 50,
        createdAt: '2026-11-20T12:15:00.000Z',
        addedLater: false,
      },
    ],
    paidKm: 2.482,
    dropoffArea: 'Center Area',
    pickupWaitSeconds: 66,
    cancelledAfterPickup: false,
    endLabel: null, // Delivered
    pickupName: 'Souvlaki House',
  };

  const sampleJobCancelled: EarningsJob = {
    deliveryId: 'del-job-2',
    acceptedAt: '2026-11-20T13:00:00.000Z', // 15:00 Athens
    endedAt: '2026-11-20T13:10:00.000Z',
    endEventType: 'CANCELED',
    droppedOff: false,
    deliveryMoneyCents: 0,
    paidWaitSeconds: 0,
    compensations: [
      {
        id: 'comp-2',
        reason: 'CANCELLATION',
        amountCents: 200,
        createdAt: '2026-11-20T13:10:00.000Z',
        addedLater: false,
      },
    ],
    paidKm: null,
    dropoffArea: null,
    pickupWaitSeconds: null,
    cancelledAfterPickup: true,
    endLabel: 'CANCELLED_AFTER_PICKUP',
    pickupName: 'Pizza Bistro',
  };

  const sampleShift: EarningsShift = {
    startedAt: '2026-11-20T10:00:00.000Z', // In Athens: Nov 20 12:00
    startedBeforeRange: false,
    endedAt: '2026-11-20T15:00:00.000Z', // In Athens: Nov 20 17:00
    onBreakSince: null,
    workSeconds: 18000,
    jobSeconds: 7200,
    paidWaitSeconds: 300,
    unpaidSeconds: 10500,
    breaks: [],
    moneyCents: 650,
    lateMoneyCents: 0,
    centsPerHour: 1300,
    currencyCode: 'EUR',
    statusChanges: [],
    jobs: [sampleJobDelivered, sampleJobCancelled],
  };

  const sampleDay: EarningsDay = {
    date: '2026-11-20',
    workSeconds: 18000,
    jobSeconds: 7200,
    paidWaitSeconds: 300,
    unpaidSeconds: 10500,
    moneyCents: 750,
    unlinkedMoneyCents: 100,
    noJobMoneyCents: 100,
    centsPerHour: 1500,
    activeCentsPerHour: 2200,
    paidKm: 2.5,
    centsPerPaidKm: 339,
    medianPickupWaitSeconds: 66,
    pickupWaitCount: 1,
    dropOffCount: 1,
  };

  const sampleWeek: EarningsWeek = {
    weekStart: '2026-11-16',
    soFar: true,
    cutAtReach: false,
    workSeconds: 36000,
    jobSeconds: 14400,
    paidWaitSeconds: 600,
    unpaidSeconds: 21000,
    moneyCents: 1500,
    unlinkedMoneyCents: 100,
    noJobMoneyCents: 100,
    centsPerHour: 1500,
    activeCentsPerHour: 2200,
    paidKm: 5.0,
    centsPerPaidKm: 340,
    medianPickupWaitSeconds: 66,
    pickupWaitCount: 2,
    dropOffCount: 2,
  };

  const sampleMonthData: EarningsMonth = {
    month: '2026-11',
    from: '2026-11-01',
    to: '2026-11-20',
    reachFrom: '2026-09-20',
    recordedFrom: '2026-10-01T00:00:00.000Z',
    currencyCode: 'EUR',
    days: [sampleDay],
    weeks: [sampleWeek],
    shifts: [sampleShift],
    jobsInNoShift: [],
  };

  const mockCoopRefetch = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-20T12:00:00.000Z'));
    jest.clearAllMocks();
    queryClient.clear();
    focusCallback = undefined;

    (useEarningsMonths as jest.Mock).mockReturnValue([
      {
        data: sampleMonthData,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
        dataUpdatedAt: Date.parse('2026-11-20T11:46:00.000Z'),
      },
    ]);

    (useEarningsMonth as jest.Mock).mockReturnValue({
      data: sampleMonthData,
      isLoading: false,
    });

    (useCoopTotals as jest.Mock).mockReturnValue({
      data: null,
      refetch: mockCoopRefetch,
    });

    (useReviewRequests as jest.Mock).mockReturnValue({
      data: { pages: [] },
    });

    (useReviewSeen as jest.Mock).mockReturnValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('AC-1: Figures card', () => {
    it('shows the server figures: money, dropOffCount, work time, centsPerHour, activeCentsPerHour, centsPerPaidKm ("/km"), medianPickupWaitSeconds in minutes with count', () => {
      render(<Earnings {...defaultProps} />);

      expect(screen.getByTestId('earnings-figures')).toBeTruthy();

      // Total money
      expect(screen.getByText('€7.50')).toBeTruthy();

      // Drop offs and work time note
      expect(screen.getByText(/1 drop off · 5h00 worked/)).toBeTruthy();

      // Per hour worked
      const perHour = screen.getByTestId('figure-per-hour');
      expect(perHour).toBeTruthy();
      expect(screen.getByText('€15.00/h')).toBeTruthy();

      // Per hour on job (active)
      const perHourOnJob = screen.getByTestId('figure-per-hour-on-job');
      expect(perHourOnJob).toBeTruthy();
      expect(screen.getByText('€22.00/h')).toBeTruthy();

      // Per paid km
      const perKm = screen.getByTestId('figure-per-km');
      expect(perKm).toBeTruthy();
      expect(screen.getByText('€3.39/km')).toBeTruthy();

      // Median pickup wait
      const pickupWait = screen.getByTestId('figure-pickup-wait');
      expect(pickupWait).toBeTruthy();
      expect(screen.getByText('1 min')).toBeTruthy();
      expect(screen.getByText(/typical pickup wait, of 1 wait/i)).toBeTruthy();

      // Time split
      expect(
        screen.getAllByText(/Jobs 2h00 · Paid waiting 5 min · Unpaid 2h55/)
          .length,
      ).toBeGreaterThanOrEqual(1);

      // noJobMoneyCents shows apart when > 0
      expect(
        screen.getByText(
          i18n.t('translations:earnings_money_no_job', {
            amount: '€1.00',
          }),
        ),
      ).toBeTruthy();
    });

    it('shows "—" for each null rate or wait figure, and hides noJobMoneyCents when 0', () => {
      const dayWithNullFigures: EarningsDay = {
        ...sampleDay,
        centsPerHour: null,
        activeCentsPerHour: null,
        centsPerPaidKm: null,
        medianPickupWaitSeconds: null,
        pickupWaitCount: 0,
        noJobMoneyCents: 0,
      };

      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            days: [dayWithNullFigures],
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      // All 4 figures show "—"
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(4);

      // noJobMoneyCents is not shown
      expect(screen.queryByText(/not linked to a job/i)).toBeNull();
    });

    it('shows formatted amount for noJobMoneyCents when positive (150) and hides "not linked to a job" when 0', () => {
      // 1. With 150 cents: shows formatted amount in "not linked to a job" sentence
      const dayWith150: EarningsDay = {
        ...sampleDay,
        noJobMoneyCents: 150,
      };

      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            days: [dayWith150],
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      const { rerender } = render(<Earnings {...defaultProps} />);

      expect(
        screen.getByText(
          i18n.t('translations:earnings_money_no_job', {
            amount: '€1.50',
          }),
        ),
      ).toBeTruthy();

      // 2. With 0 cents: "not linked to a job" sentence is absent
      const dayWith0: EarningsDay = {
        ...sampleDay,
        noJobMoneyCents: 0,
      };

      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            days: [dayWith0],
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      rerender(<Earnings {...defaultProps} />);
      expect(screen.queryByText(/not linked to a job/i)).toBeNull();
    });
  });

  describe('AC-2 & AC-8: Co-op timezone and Job rows', () => {
    it('displays accept time in Europe/Athens time, restaurant -> area, km, minutes, money and label', () => {
      render(<Earnings {...defaultProps} />);

      const jobRows = screen.getAllByTestId('earnings-job');
      expect(jobRows.length).toBe(2);

      // Job 1: accepted at 12:00 UTC -> 14:00 Athens
      expect(screen.getByText('14:00')).toBeTruthy();
      expect(screen.getByText('Souvlaki House → Center Area')).toBeTruthy();
      expect(screen.getByText(/2.5 km/)).toBeTruthy();
      expect(screen.getByText(/20 min/)).toBeTruthy();
      expect(screen.getByText('€4.50')).toBeTruthy(); // 400 + 50 cents

      // Job 2: accepted at 13:00 UTC -> 15:00 Athens
      expect(screen.getByText('15:00')).toBeTruthy();
      expect(screen.getByText('Pizza Bistro → —')).toBeTruthy(); // null area shows "—"
      expect(screen.getByText(/— · 10 min/)).toBeTruthy(); // null km shows "—"
      expect(screen.getByText('€2.00')).toBeTruthy(); // 200 cents
      expect(
        screen.getByText(
          new RegExp(
            i18n.t('translations:earnings_end_cancelled_after_pickup'),
          ),
        ),
      ).toBeTruthy();
    });

    it('pressing a job navigates to EarningsDelivery with deliveryId', () => {
      render(<Earnings {...defaultProps} />);

      const jobRows = screen.getAllByTestId('earnings-job');
      fireEvent.press(jobRows[0]);

      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        MainScreens.EarningsDelivery,
        { deliveryId: 'del-job-1' },
      );
    });
  });

  describe('AC-6: Day view and Week view grouping (decision 75.37)', () => {
    it('shows "Continues from <day>" when a shift began the day before', () => {
      const shiftFromYesterday: EarningsShift = {
        ...sampleShift,
        startedAt: '2026-11-19T21:00:00.000Z', // Nov 19 23:00 Athens
        endedAt: '2026-11-20T03:00:00.000Z', // Nov 20 05:00 Athens
        jobs: [sampleJobDelivered],
      };

      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            shifts: [shiftFromYesterday],
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      expect(
        screen.getByText(
          i18n.t('translations:earnings_continues_from', {
            day: 'Thu 19 Nov',
          }),
        ),
      ).toBeTruthy();
    });

    it('groups jobs in no recorded shift under "Not in a recorded shift"', () => {
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            shifts: [],
            jobsInNoShift: [sampleJobDelivered],
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:earnings_not_in_shift')),
      ).toBeTruthy();
      expect(screen.getByText('Souvlaki House → Center Area')).toBeTruthy();
    });

    it('shows "No work this day" when day has no shifts and no jobs', () => {
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            shifts: [],
            jobsInNoShift: [],
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:earnings_no_work_day')),
      ).toBeTruthy();
    });

    it('switching to Week view lists days with work newest first', () => {
      render(<Earnings {...defaultProps} />);

      const weekTab = screen.getByTestId('earnings-mode-week');
      fireEvent.press(weekTab);

      // Now in week mode, shows week label and day headers
      expect(screen.getByText(/so far/i)).toBeTruthy();
      expect(screen.getByText('Fri 20 Nov')).toBeTruthy();
    });

    it('shows "No work this week" when week has no days with work', () => {
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            days: [],
            shifts: [],
            jobsInNoShift: [],
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      const weekTab = screen.getByTestId('earnings-mode-week');
      fireEvent.press(weekTab);

      expect(
        screen.getByText(i18n.t('translations:earnings_no_work_week')),
      ).toBeTruthy();
    });

    it('Week view lists a day whose only job is in jobsInNoShift with 0 work and 0 money (AC-8)', () => {
      const zeroJobInNoShift: EarningsJob = {
        ...sampleJobCancelled,
        deliveryId: 'del-no-shift-zero',
        acceptedAt: '2026-11-18T12:00:00.000Z', // 2026-11-18 in Athens
        endedAt: '2026-11-18T12:05:00.000Z',
        pickupName: 'No Shift Zero Resto',
        deliveryMoneyCents: 0,
        compensations: [],
      };

      const monthWithZeroJob: EarningsMonth = {
        ...sampleMonthData,
        days: [
          {
            ...sampleDay,
            date: '2026-11-18',
            workSeconds: 0,
            moneyCents: 0,
            centsPerHour: null,
            activeCentsPerHour: null,
          },
        ],
        shifts: [],
        jobsInNoShift: [zeroJobInNoShift],
      };

      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: monthWithZeroJob,
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      // Switch to Week view
      fireEvent.press(screen.getByTestId('earnings-mode-week'));

      // The day 2026-11-18 is kept, and its job row is shown
      expect(screen.getByText('Wed 18 Nov')).toBeTruthy();
      expect(screen.getByText(/No Shift Zero Resto/)).toBeTruthy();
    });
  });

  describe('AC-7: Calendar interaction', () => {
    it('tapping period label opens month calendar', () => {
      render(<Earnings {...defaultProps} />);

      expect(screen.queryByTestId('earnings-calendar')).toBeNull();

      fireEvent.press(screen.getByTestId('earnings-period'));
      expect(screen.getByTestId('earnings-calendar')).toBeTruthy();
    });
  });

  describe('AC-9: Reach and limit notes', () => {
    it('forward arrow is disabled at today', () => {
      render(<Earnings {...defaultProps} />);

      const forwardArrow = screen.getByTestId('earnings-next');
      expect(forwardArrow.props.accessibilityState.disabled).toBe(true);
    });

    it('disables back arrow (earnings-previous) when shown day is reachFrom and does not move period; enables it one day later', () => {
      // 1. When shown day is reachFrom ('2026-11-20'), back arrow is disabled
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            reachFrom: '2026-11-20',
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      const { rerender } = render(<Earnings {...defaultProps} />);

      const prevArrowAtReach = screen.getByTestId('earnings-previous');
      expect(prevArrowAtReach.props.accessibilityState.disabled).toBe(true);

      // Pressing it does not move the period
      expect(screen.getByText(/Today/i)).toBeTruthy();
      fireEvent.press(prevArrowAtReach);
      expect(screen.getByText(/Today/i)).toBeTruthy();

      // 2. One day later (reachFrom is '2026-11-19', today is '2026-11-20'): back arrow is enabled
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            reachFrom: '2026-11-19',
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      rerender(<Earnings {...defaultProps} />);

      const prevArrowEnabled = screen.getByTestId('earnings-previous');
      expect(prevArrowEnabled.props.accessibilityState.disabled).toBe(false);

      // Pressing it moves the period to reachFrom ('2026-11-19')
      fireEvent.press(prevArrowEnabled);
      expect(screen.queryByText(/Today/i)).toBeNull();

      // At reachFrom ('2026-11-19'): back arrow is now disabled
      const prevArrowNowAtReach = screen.getByTestId('earnings-previous');
      expect(prevArrowNowAtReach.props.accessibilityState.disabled).toBe(true);

      // Pressing it again does not move the period
      fireEvent.press(prevArrowNowAtReach);
      expect(prevArrowNowAtReach.props.accessibilityState.disabled).toBe(true);
    });

    it('in Week mode, disables back arrow for the week holding reachFrom', () => {
      // In Week mode, week starts 2026-11-16 and ends 2026-11-22; reachFrom is 2026-11-18 (inside the week)
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            reachFrom: '2026-11-18',
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      // Switch to Week mode
      fireEvent.press(screen.getByTestId('earnings-mode-week'));

      const prevArrowInWeek = screen.getByTestId('earnings-previous');
      expect(prevArrowInWeek.props.accessibilityState.disabled).toBe(true);

      // Pressing it does not move the period
      fireEvent.press(prevArrowInWeek);
      expect(prevArrowInWeek.props.accessibilityState.disabled).toBe(true);
    });

    it('shows "For older work, ask the co-op." when first date is on or before reachFrom', () => {
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            reachFrom: '2026-11-20', // reachFrom is today
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:earnings_older_ask_coop')),
      ).toBeTruthy();
    });

    it('shows "Time worked is recorded from <date>" when date is before recordedFrom', () => {
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: {
            ...sampleMonthData,
            recordedFrom: '2026-11-25T00:00:00.000Z', // recordedFrom is in the future
          },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      expect(screen.getByText(/Time worked is recorded from/i)).toBeTruthy();
    });
  });

  describe('AC-13: Offline, error, and cache invalidation', () => {
    it('shows "No connection. As of <time>" when refetch fails over cached data', () => {
      const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: sampleMonthData,
          isLoading: false,
          isError: true, // Failed refetch
          error: networkError,
          failureReason: networkError,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.parse('2026-11-20T11:46:00.000Z'),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      expect(screen.getByTestId('earnings-as-of')).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:earnings_as_of', { time: '13:46' }),
        ),
      ).toBeTruthy();
    });

    it('shows "No connection. As of <time>." on first failed try (isError: false, failureCount: 1, network error)', () => {
      const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: sampleMonthData,
          isLoading: false,
          isError: false,
          failureCount: 1,
          failureReason: networkError,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.parse('2026-11-20T11:46:00.000Z'),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      expect(screen.getByTestId('earnings-as-of')).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:earnings_as_of', { time: '13:46' }),
        ),
      ).toBeTruthy();
    });

    it('shows "Could not refresh. As of <time>." when failureReason is 500 (isError: false, failureCount: 1)', () => {
      const serverError = new AxiosError(
        'Internal Server Error',
        'ERR_BAD_RESPONSE',
        undefined,
        undefined,
        { status: 500 } as any,
      );
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: sampleMonthData,
          isLoading: false,
          isError: false,
          failureCount: 1,
          failureReason: serverError,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.parse('2026-11-20T11:46:00.000Z'),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      expect(screen.getByTestId('earnings-as-of')).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:earnings_refresh_failed_as_of', {
            time: '13:46',
          }),
        ),
      ).toBeTruthy();
    });

    it('shows no "As of" note when failureCount is 0 and isError is false', () => {
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: sampleMonthData,
          isLoading: false,
          isError: false,
          failureCount: 0,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: Date.parse('2026-11-20T11:46:00.000Z'),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      expect(screen.queryByTestId('earnings-as-of')).toBeNull();
    });

    it('shows needs connection notice when no data is loaded and query fails with network error', () => {
      const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: undefined,
          isLoading: false,
          isError: true,
          error: networkError,
          failureReason: networkError,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: 0,
        },
      ]);

      render(<Earnings {...defaultProps} />);

      expect(screen.getByTestId('earnings-needs-connection')).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:earnings_needs_connection')),
      ).toBeTruthy();
    });

    it('shows earnings-could-not-load when server answered 400 with no saved data (AC-13)', () => {
      const badRequestError = new AxiosError(
        'Bad Request',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        { status: 400 } as any,
      );
      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: undefined,
          isLoading: false,
          isError: true,
          error: badRequestError,
          failureReason: badRequestError,
          isRefetching: false,
          refetch: jest.fn(),
          dataUpdatedAt: 0,
        },
      ]);

      render(<Earnings {...defaultProps} />);

      expect(screen.getByTestId('earnings-could-not-load')).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:earnings_could_not_load_days')),
      ).toBeTruthy();
      expect(screen.queryByTestId('earnings-needs-connection')).toBeNull();
    });

    it('focus listener invalidates earningsMonth, coopTotals, and reviewRequests', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      render(<Earnings {...defaultProps} />);

      expect(focusCallback).toBeDefined();

      act(() => {
        focusCallback!();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.earningsMonth],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.coopTotals],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.reviewRequests],
      });
    });
  });

  describe('Screen logic: month requests (AC-5, AC-9, AC-13, Review Major 2)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      queryClient.clear();
    });

    it('Day view on today asks only this month', () => {
      // Fix clock to 2026-11-20 in Athens (14:00 Athens is 12:00 UTC)
      jest.setSystemTime(new Date('2026-11-20T12:00:00.000Z'));

      render(<Earnings {...defaultProps} />);

      expect(useEarningsMonths).toHaveBeenCalledWith(['2026-11']);
    });

    it('Week view on a week crossing into next month asks only this month, never next month', () => {
      // Pick a "today" near month's end: 2026-11-30 is Monday (Athens 12:00 is 10:00 UTC)
      // The week runs Monday 2026-11-30 to Sunday 2026-12-06.
      // Next month (2026-12) has not started yet, so it is filtered out.
      jest.setSystemTime(new Date('2026-11-30T10:00:00.000Z'));

      render(<Earnings {...defaultProps} />);

      // Switch to Week mode
      fireEvent.press(screen.getByTestId('earnings-mode-week'));

      expect(useEarningsMonths).toHaveBeenLastCalledWith(['2026-11']);
    });

    it('Week view on a week crossing a month end inside the reach asks both months', () => {
      // Fix today to 2026-12-03 (inside December).
      // The week holding 2026-12-03 runs Monday 2026-11-30 to Sunday 2026-12-06.
      // Both 2026-11 and 2026-12 are <= monthOf(today) ('2026-12') and >= reachFrom ('2026-09-20').
      jest.setSystemTime(new Date('2026-12-03T10:00:00.000Z'));

      render(<Earnings {...defaultProps} />);

      // Switch to Week mode
      fireEvent.press(screen.getByTestId('earnings-mode-week'));

      expect(useEarningsMonths).toHaveBeenLastCalledWith([
        '2026-11',
        '2026-12',
      ]);
    });

    it('a week crossing back past the reach month never asks the month wholly before reachFrom', () => {
      // Fix today to 2026-10-02 (Friday, October 2).
      // Week holding 2026-10-02 runs Monday 2026-09-28 to Sunday 2026-10-04.
      // Cache a month in QueryClient with reachFrom on the first days of October (2026-10-03).
      jest.setSystemTime(new Date('2026-10-02T10:00:00.000Z'));

      queryClient.setQueryData([QueryKeys.earningsMonth, '2026-10'], {
        ...sampleMonthData,
        month: '2026-10',
        reachFrom: '2026-10-03',
      });

      render(<Earnings {...defaultProps} />);

      // Switch to Week mode
      fireEvent.press(screen.getByTestId('earnings-mode-week'));

      // 2026-09 is wholly before reachFrom's month (2026-10), so it is not asked
      expect(useEarningsMonths).toHaveBeenLastCalledWith(['2026-10']);
    });

    it('uses the newest reachFrom among saved months so a week crossing into a stale reach month never asks for it (decision 75.43)', () => {
      // Fix today to 2026-10-02 (in October)
      // Week crossing 28 Sep to 4 Oct: Monday 2026-09-28 to Sunday 2026-10-04.
      jest.setSystemTime(new Date('2026-10-02T10:00:00.000Z'));

      // Seed two saved months in QueryClient:
      // Older reach: '2026-09-30' (e.g. cached yesterday)
      // Newer reach: '2026-10-01' (cached today)
      queryClient.setQueryData([QueryKeys.earningsMonth, '2026-09'], {
        ...sampleMonthData,
        month: '2026-09',
        reachFrom: '2026-09-30',
      });
      queryClient.setQueryData([QueryKeys.earningsMonth, '2026-10'], {
        ...sampleMonthData,
        month: '2026-10',
        reachFrom: '2026-10-01',
      });

      render(<Earnings {...defaultProps} />);

      // Switch to Week mode
      fireEvent.press(screen.getByTestId('earnings-mode-week'));

      // The newest reach '2026-10-01' makes monthOf(knownReach) '2026-10', so '2026-09' is never asked for.
      expect(useEarningsMonths).toHaveBeenLastCalledWith(['2026-10']);
      expect(useEarningsMonths).not.toHaveBeenCalledWith(
        expect.arrayContaining(['2026-09']),
      );
    });
  });

  describe('Screen logic: calendar pick (AC-7, Review Major 2)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-20T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
      queryClient.clear();
    });

    it('in Day mode, picking a day shows that day in the period label and closes the calendar', () => {
      render(<Earnings {...defaultProps} />);

      // Initially today: "Today, Fri 20 Nov"
      expect(screen.getByText('Today, Fri 20 Nov')).toBeTruthy();
      expect(screen.queryByTestId('earnings-calendar')).toBeNull();

      // Open calendar by tapping the period
      fireEvent.press(screen.getByTestId('earnings-period'));
      expect(screen.getByTestId('earnings-calendar')).toBeTruthy();

      // Pick Wednesday 2026-11-18
      fireEvent.press(screen.getByTestId('calendar-day-2026-11-18'));

      // The period label shows that day (Wed 18 Nov) and not today
      expect(screen.getByText('Wed 18 Nov')).toBeTruthy();
      expect(screen.queryByText(/Today/i)).toBeNull();

      // The calendar is closed
      expect(screen.queryByTestId('earnings-calendar')).toBeNull();
    });

    it('in Week mode, picking a day shows the Monday to Sunday week holding it and closes the calendar', () => {
      render(<Earnings {...defaultProps} />);

      // Switch to Week mode
      fireEvent.press(screen.getByTestId('earnings-mode-week'));

      // Open calendar
      fireEvent.press(screen.getByTestId('earnings-period'));
      expect(screen.getByTestId('earnings-calendar')).toBeTruthy();

      // Pick day 2026-11-10 (Tuesday, falling in week Mon 9 Nov - Sun 15 Nov)
      fireEvent.press(screen.getByTestId('calendar-day-2026-11-10'));

      // Period label shows the Monday to Sunday week: "9 Nov to 15 Nov"
      expect(screen.getByText('9 Nov to 15 Nov')).toBeTruthy();

      // The calendar is closed
      expect(screen.queryByTestId('earnings-calendar')).toBeNull();
    });
  });

  describe('Screen logic: pull to refresh (AC-13, Review Major 2)', () => {
    it('firing onRefresh on ScrollView RefreshControl calls refetch on each month query and on the co-op card query', () => {
      const mockRefetchMonth1 = jest.fn();
      const mockRefetchMonth2 = jest.fn();

      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: sampleMonthData,
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: mockRefetchMonth1,
          dataUpdatedAt: Date.now(),
        },
        {
          data: { ...sampleMonthData, month: '2026-10' },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: mockRefetchMonth2,
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      const refreshControl = screen.UNSAFE_getByType(RefreshControl);
      expect(refreshControl).toBeTruthy();

      act(() => {
        refreshControl.props.onRefresh();
      });

      expect(mockRefetchMonth1).toHaveBeenCalledTimes(1);
      expect(mockRefetchMonth2).toHaveBeenCalledTimes(1);
      expect(mockCoopRefetch).toHaveBeenCalledTimes(1);
    });

    it('refreshing prop is false during background refetch, true after onRefresh, and false after refetches resolve', async () => {
      let resolveRefetch1!: (value?: any) => void;
      let resolveRefetch2!: (value?: any) => void;
      const refetchPromise1 = new Promise<any>(resolve => {
        resolveRefetch1 = resolve;
      });
      const refetchPromise2 = new Promise<any>(resolve => {
        resolveRefetch2 = resolve;
      });
      const mockRefetch1 = jest.fn().mockReturnValue(refetchPromise1);
      const mockRefetch2 = jest.fn().mockReturnValue(refetchPromise2);

      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: sampleMonthData,
          isLoading: false,
          isError: false,
          isRefetching: true, // background refetch running
          refetch: mockRefetch1,
          dataUpdatedAt: Date.now(),
        },
        {
          data: { ...sampleMonthData, month: '2026-10' },
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: mockRefetch2,
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      const refreshControl = screen.UNSAFE_getByType(RefreshControl);
      expect(refreshControl).toBeTruthy();
      // refreshing is false during background refetch
      expect(refreshControl.props.refreshing).toBe(false);

      // Trigger onRefresh
      act(() => {
        refreshControl.props.onRefresh();
      });

      expect(mockRefetch1).toHaveBeenCalledTimes(1);
      expect(mockRefetch2).toHaveBeenCalledTimes(1);
      // refreshing turns true immediately after onRefresh
      expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
        true,
      );

      // Settle promises
      await act(async () => {
        resolveRefetch1();
        resolveRefetch2();
      });

      // refreshing turns false after promises settle
      expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
        false,
      );
    });

    it('refreshing prop turns false even when one of the refetches rejects', async () => {
      let rejectRefetch1!: (err: any) => void;
      const refetchPromise1 = new Promise<any>((_, reject) => {
        rejectRefetch1 = reject;
      });
      const mockRefetch1 = jest.fn().mockReturnValue(refetchPromise1);

      (useEarningsMonths as jest.Mock).mockReturnValue([
        {
          data: sampleMonthData,
          isLoading: false,
          isError: false,
          isRefetching: false,
          refetch: mockRefetch1,
          dataUpdatedAt: Date.now(),
        },
      ]);

      render(<Earnings {...defaultProps} />);

      const refreshControl = screen.UNSAFE_getByType(RefreshControl);

      act(() => {
        refreshControl.props.onRefresh();
      });

      expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
        true,
      );

      await act(async () => {
        rejectRefetch1(new Error('Network failure'));
      });

      expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
        false,
      );
    });
  });

  describe('After midnight focus behavior (decision 75.43)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      queryClient.clear();
    });

    it('moves to the new today on focus after midnight if the screen was showing the old today', () => {
      // Start at 23:00 on 2026-11-20 in Athens (21:00 UTC)
      jest.setSystemTime(new Date('2026-11-20T21:00:00.000Z'));

      render(<Earnings {...defaultProps} />);

      // Period shows old today: Today, Fri 20 Nov
      expect(screen.getByTestId('earnings-period')).toBeTruthy();
      expect(screen.getByText('Today, Fri 20 Nov')).toBeTruthy();

      // Advance clock past Athens midnight to 01:00 on 2026-11-21 in Athens (23:00 UTC Nov 20)
      jest.setSystemTime(new Date('2026-11-20T23:00:00.000Z'));

      // Fire focus listener
      act(() => {
        focusCallback!();
      });

      // Period now shows new today: Today, Sat 21 Nov
      expect(screen.getByText('Today, Sat 21 Nov')).toBeTruthy();
    });

    it('stays on the picked day on focus after midnight if the rider picked an earlier day before midnight', () => {
      // Start at 23:00 on 2026-11-20 in Athens (21:00 UTC)
      jest.setSystemTime(new Date('2026-11-20T21:00:00.000Z'));

      render(<Earnings {...defaultProps} />);

      expect(screen.getByText('Today, Fri 20 Nov')).toBeTruthy();

      // Rider picks earlier day before midnight: taps previous arrow to go to Thu 19 Nov
      fireEvent.press(screen.getByTestId('earnings-previous'));
      expect(screen.getByText('Thu 19 Nov')).toBeTruthy();

      // Advance clock past Athens midnight to 01:00 on 2026-11-21 in Athens (23:00 UTC Nov 20)
      jest.setSystemTime(new Date('2026-11-20T23:00:00.000Z'));

      // Fire focus listener
      act(() => {
        focusCallback!();
      });

      // The picked day stays on Thu 19 Nov (does not move to Today, Sat 21 Nov)
      expect(screen.getByText('Thu 19 Nov')).toBeTruthy();
      expect(screen.queryByText('Today, Sat 21 Nov')).toBeNull();
    });
  });
});
