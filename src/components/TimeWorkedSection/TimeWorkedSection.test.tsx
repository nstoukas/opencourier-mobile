import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import {
  CoopWeekCard,
  CoopWeekLine,
  REASON_KEYS,
  ShiftDetails,
  ShiftRow,
} from './TimeWorkedSection';
import { CoopTotals, WorkedShift } from '@app/types/timeWorked';

describe('TimeWorkedSection exports (spec 0040 AC-11, AC-12, spec 0042 AC-6)', () => {
  const sampleShift: WorkedShift = {
    startedAt: '2026-11-20T10:00:00.000Z',
    startedBeforeRange: false,
    endedAt: '2026-11-20T13:12:00.000Z',
    onBreakSince: null,
    workSeconds: 11520, // 3h 12m
    jobSeconds: 7200, // 2h 00m
    paidWaitSeconds: 720, // 12m
    unpaidSeconds: 3600, // 1h 00m
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
    jobs: [],
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
    ],
  };

  const sampleTotals: CoopTotals = {
    thisWeek: {
      weekStart: '2026-11-16',
      tooFewRiders: false,
      workSeconds: 152100, // 42h 15m
      unpaidShare: 0.25, // 25%
      centsPerHour: 1250, // €12.50/h
    },
    lastWeek: {
      weekStart: '2026-11-09',
      tooFewRiders: true,
    },
  };

  describe('REASON_KEYS', () => {
    it('defines mapping for all compensation reasons', () => {
      expect(REASON_KEYS.CANCELLATION).toBe('earnings_cancelled_job');
      expect(REASON_KEYS.REASSIGNMENT).toBe('earnings_reassigned_job');
      expect(REASON_KEYS.WAITING).toBe('earnings_waiting');
      expect(REASON_KEYS.REMOVAL).toBe('earnings_removal');
      expect(REASON_KEYS.RETURN_TRIP).toBe('earnings_return_trip');
      expect(REASON_KEYS.REVIEW).toBe('earnings_review_correction');
    });
  });

  describe('ShiftRow (spec 0040 AC-11, spec 0042 AC-6)', () => {
    it('renders closed shift with duration, money, rate, split, and break', () => {
      render(<ShiftRow shift={sampleShift} />);

      // Shift header exists
      expect(screen.getByTestId('time-worked-shift')).toBeTruthy();

      // Duration and money
      expect(screen.getByText(/3h12/)).toBeTruthy();
      expect(screen.getByText(/€38.50/)).toBeTruthy();
      expect(screen.getByText(/€12.03\/h/)).toBeTruthy();

      // Split line
      expect(
        screen.getByText(
          i18n.t('translations:time_worked_split', {
            job: '2h00',
            wait: '12 min',
            unpaid: '1h00',
          }),
        ),
      ).toBeTruthy();

      // Break line
      expect(screen.getByText(/Break/)).toBeTruthy();
    });

    it('renders open shift when endedAt is null and omits /h when centsPerHour is null', () => {
      const openShift: WorkedShift = {
        ...sampleShift,
        endedAt: null,
        centsPerHour: null,
        breaks: [],
      };
      render(<ShiftRow shift={openShift} />);

      expect(
        screen.getByText(
          new RegExp(
            i18n.t('translations:time_worked_shift_open', { start: '12:00' }),
          ),
        ),
      ).toBeTruthy();
      expect(screen.queryByText(/\/h/)).toBeNull();
    });

    it('renders "Continues from <day>" when continuesFrom prop is provided (AC-6)', () => {
      render(<ShiftRow shift={sampleShift} continuesFrom="2026-11-19" />);

      expect(
        screen.getByText(
          i18n.t('translations:earnings_continues_from', {
            day: 'Thu 19 Nov',
          }),
        ),
      ).toBeTruthy();
    });

    it('renders "Started before recorded time" when startedBeforeRange is true', () => {
      const earlierShift: WorkedShift = {
        ...sampleShift,
        startedBeforeRange: true,
      };
      render(<ShiftRow shift={earlierShift} />);

      expect(
        screen.getByText(i18n.t('translations:time_worked_started_before')),
      ).toBeTruthy();
    });

    it('renders "Added later: €X.XX" when lateMoneyCents > 0', () => {
      const lateShift: WorkedShift = {
        ...sampleShift,
        lateMoneyCents: 500,
      };
      render(<ShiftRow shift={lateShift} />);

      expect(
        screen.getByText(
          i18n.t('translations:time_worked_added_later', {
            amount: '€5.00',
          }),
        ),
      ).toBeTruthy();
    });

    it('toggles ShiftDetails on press', () => {
      render(<ShiftRow shift={sampleShift} />);

      expect(screen.queryByTestId('time-worked-shift-details')).toBeNull();

      fireEvent.press(screen.getByTestId('time-worked-shift'));
      expect(screen.getByTestId('time-worked-shift-details')).toBeTruthy();

      fireEvent.press(screen.getByTestId('time-worked-shift'));
      expect(screen.queryByTestId('time-worked-shift-details')).toBeNull();
    });
  });

  describe('ShiftDetails', () => {
    it('renders status changes with time, from/to status, and cause', () => {
      render(<ShiftDetails shift={sampleShift} />);

      expect(
        screen.getByText(i18n.t('translations:time_worked_details_status')),
      ).toBeTruthy();

      expect(
        screen.getByText(
          i18n.t('translations:time_worked_status_line', {
            time: '12:00',
            from: i18n.t('translations:time_worked_status_OFFLINE'),
            to: i18n.t('translations:time_worked_status_ONLINE'),
            cause: i18n.t('translations:time_worked_cause_RIDER'),
          }),
        ),
      ).toBeTruthy();

      expect(
        screen.getByText(
          i18n.t('translations:time_worked_status_line', {
            time: '15:15',
            from: i18n.t('translations:time_worked_status_ONLINE'),
            to: i18n.t('translations:time_worked_status_OFFLINE'),
            cause: i18n.t('translations:time_worked_cause_CUT_OFF_ADMIN'),
          }),
        ),
      ).toBeTruthy();
    });
  });

  describe('CoopWeekLine and CoopWeekCard (spec 0040 AC-12)', () => {
    it('shows too few riders sentence when tooFewRiders is true', () => {
      render(
        <CoopWeekLine
          label="Last week"
          week={{ weekStart: '2026-11-09', tooFewRiders: true }}
          currencyCode="EUR"
        />,
      );

      expect(screen.getByText('Last week')).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:time_worked_too_few')),
      ).toBeTruthy();
    });

    it('shows hours, unpaid share, and hourly rate when figures are present', () => {
      render(
        <CoopWeekLine
          label="This week"
          week={{
            weekStart: '2026-11-16',
            tooFewRiders: false,
            workSeconds: 152100,
            unpaidShare: 0.25,
            centsPerHour: 1250,
          }}
          currencyCode="EUR"
        />,
      );

      expect(screen.getByText('This week')).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:time_worked_coop_line', {
            hours: '42h15',
            share: '25%',
            rate: i18n.t('translations:time_worked_per_hour', {
              amount: '€12.50',
            }),
          }),
        ),
      ).toBeTruthy();
    });

    it('shows "—" for rate when centsPerHour is null', () => {
      render(
        <CoopWeekLine
          label="This week"
          week={{
            weekStart: '2026-11-16',
            tooFewRiders: false,
            workSeconds: 152100,
            unpaidShare: 0.25,
            centsPerHour: null,
          }}
          currencyCode="EUR"
        />,
      );

      expect(
        screen.getByText(
          i18n.t('translations:time_worked_coop_line', {
            hours: '42h15',
            share: '25%',
            rate: '—',
          }),
        ),
      ).toBeTruthy();
    });

    it('CoopWeekCard renders both thisWeek and lastWeek', () => {
      render(<CoopWeekCard totals={sampleTotals} currencyCode="EUR" />);

      expect(screen.getByTestId('coop-week-card')).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:time_worked_coop_title')),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:time_worked_this_week')),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:time_worked_last_week')),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:time_worked_too_few')),
      ).toBeTruthy();
    });
  });
});
