import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import { MonthCalendar } from './MonthCalendar';

describe('MonthCalendar (spec 0042, AC-7)', () => {
  const defaultProps = {
    month: '2026-11',
    selected: ['2026-11-20'],
    marked: new Set(['2026-11-18', '2026-11-20']),
    minDate: '2026-09-20',
    maxDate: '2026-11-20',
    onPick: jest.fn(),
    onMonthChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Monday first in weekday headers', () => {
    render(<MonthCalendar {...defaultProps} />);

    // Weekdays row contains headers Mo, Tu, We, Th, Fr, Sa, Su
    expect(screen.getByText('Mo')).toBeTruthy();
    expect(screen.getByText('Su')).toBeTruthy();
  });

  it('displays the month header', () => {
    render(<MonthCalendar {...defaultProps} />);
    expect(screen.getByText('November 2026')).toBeTruthy();
  });

  it('enables pressing days between minDate and maxDate and calls onPick', () => {
    const onPick = jest.fn();
    render(<MonthCalendar {...defaultProps} onPick={onPick} />);

    const dayButton = screen.getByTestId('calendar-day-2026-11-18');
    expect(dayButton.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(dayButton);
    expect(onPick).toHaveBeenCalledWith('2026-11-18');
  });

  it('disables days after maxDate and days before minDate', () => {
    render(
      <MonthCalendar
        {...defaultProps}
        month="2026-09"
        minDate="2026-09-20"
        maxDate="2026-11-20"
      />,
    );

    // Sep 19 is before minDate (2026-09-20) -> disabled
    const dayBeforeReach = screen.getByTestId('calendar-day-2026-09-19');
    expect(dayBeforeReach.props.accessibilityState.disabled).toBe(true);

    // Sep 20 is on minDate -> enabled
    const reachDay = screen.getByTestId('calendar-day-2026-09-20');
    expect(reachDay.props.accessibilityState.disabled).toBe(false);
  });

  it('disables days after maxDate (today)', () => {
    render(
      <MonthCalendar {...defaultProps} month="2026-11" maxDate="2026-11-20" />,
    );

    // Nov 21 is after today -> disabled
    const dayAfterToday = screen.getByTestId('calendar-day-2026-11-21');
    expect(dayAfterToday.props.accessibilityState.disabled).toBe(true);

    // Nov 20 is today -> enabled
    const todayButton = screen.getByTestId('calendar-day-2026-11-20');
    expect(todayButton.props.accessibilityState.disabled).toBe(false);
  });

  it('stops forward arrow at current month (maxDate) and backward arrow at reach month (minDate)', () => {
    const onMonthChange = jest.fn();

    // 1. In current month (2026-11), maxDate is 2026-11-20 -> cannot go forward!
    const { rerender } = render(
      <MonthCalendar
        {...defaultProps}
        month="2026-11"
        minDate="2026-09-20"
        maxDate="2026-11-20"
        onMonthChange={onMonthChange}
      />,
    );

    const nextBtn = screen.getByTestId('calendar-next');
    expect(nextBtn.props.accessibilityState.disabled).toBe(true);

    const prevBtn = screen.getByTestId('calendar-previous');
    expect(prevBtn.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(prevBtn);
    expect(onMonthChange).toHaveBeenCalledWith('2026-10');

    // 2. In reach month (2026-09), minDate is 2026-09-20 -> cannot go backward (month-01 > minDate is false)!
    rerender(
      <MonthCalendar
        {...defaultProps}
        month="2026-09"
        minDate="2026-09-20"
        maxDate="2026-11-20"
        onMonthChange={onMonthChange}
      />,
    );

    const prevBtnAtReach = screen.getByTestId('calendar-previous');
    expect(prevBtnAtReach.props.accessibilityState.disabled).toBe(true);

    const nextBtnAtReach = screen.getByTestId('calendar-next');
    expect(nextBtnAtReach.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(nextBtnAtReach);
    expect(onMonthChange).toHaveBeenCalledWith('2026-10');
  });

  it('marks selected day with selected state', () => {
    render(<MonthCalendar {...defaultProps} selected={['2026-11-20']} />);

    const selectedBtn = screen.getByTestId('calendar-day-2026-11-20');
    expect(selectedBtn.props.accessibilityState.selected).toBe(true);

    const unselectedBtn = screen.getByTestId('calendar-day-2026-11-19');
    expect(unselectedBtn.props.accessibilityState.selected).toBe(false);
  });
});
