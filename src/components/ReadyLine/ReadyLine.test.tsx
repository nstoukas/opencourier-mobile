import React from 'react';
import { act, render } from '@testing-library/react-native';
import '@app/localization/i18n';
import { ReadyLine, READY_LINE_TICK_MS } from './ReadyLine';

// Spec 0023 (AC-7): the job card's ready line, counted down on a 30 s tick.
describe('ReadyLine (spec 0023, AC-7)', () => {
  const START = Date.parse('2026-11-03T12:00:00.000Z');
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const lineText = (screen: ReturnType<typeof render>) =>
    screen.getByTestId('job-ready-line').props.children;

  it('ticks every 30 s', () => {
    expect(READY_LINE_TICK_MS).toBe(30 * SECOND);
  });

  it('shows "Ready" when foodReadyAt is set', () => {
    const screen = render(
      <ReadyLine
        foodReadyAt="2026-11-03T11:59:00.000Z"
        readyAtOnPhone={START + 10 * MINUTE}
      />,
    );
    expect(lineText(screen)).toBe('Ready');
  });

  it('shows "Preparing, ~N min" rounded up while time is left', () => {
    const screen = render(
      <ReadyLine foodReadyAt={null} readyAtOnPhone={START + 8 * MINUTE} />,
    );
    expect(lineText(screen)).toBe('Preparing, ~8 min');
  });

  it('shows nothing for a job with no ready time', () => {
    const screen = render(
      <ReadyLine foodReadyAt={null} readyAtOnPhone={null} />,
    );
    expect(screen.queryByTestId('job-ready-line')).toBeNull();
    const screen2 = render(<ReadyLine />);
    expect(screen2.queryByTestId('job-ready-line')).toBeNull();
  });

  it('moves on every 30 s, down to "due now" at the ready time', () => {
    // 1 min 30 s left: ~2 min.
    const screen = render(
      <ReadyLine readyAtOnPhone={START + 90 * SECOND} foodReadyAt={null} />,
    );
    expect(lineText(screen)).toBe('Preparing, ~2 min');

    // 29 s later nothing has redrawn yet, though the clock moved.
    act(() => {
      jest.advanceTimersByTime(29 * SECOND);
    });
    expect(lineText(screen)).toBe('Preparing, ~2 min');

    // At 30 s: 60 s left, ~1 min.
    act(() => {
      jest.advanceTimersByTime(1 * SECOND);
    });
    expect(lineText(screen)).toBe('Preparing, ~1 min');

    // At 60 s: 30 s left, still ~1 min.
    act(() => {
      jest.advanceTimersByTime(30 * SECOND);
    });
    expect(lineText(screen)).toBe('Preparing, ~1 min');

    // At 90 s: the ready time, "due now".
    act(() => {
      jest.advanceTimersByTime(30 * SECOND);
    });
    expect(lineText(screen)).toBe('Preparing, due now');

    // And it stays "due now" after.
    act(() => {
      jest.advanceTimersByTime(5 * MINUTE);
    });
    expect(lineText(screen)).toBe('Preparing, due now');
  });

  it('does not tick once the food is ready, and stops ticking when it becomes ready', () => {
    const ready = render(
      <ReadyLine
        foodReadyAt="2026-11-03T11:59:00.000Z"
        readyAtOnPhone={START + 10 * MINUTE}
      />,
    );
    expect(jest.getTimerCount()).toBe(0);
    ready.unmount();

    const screen = render(
      <ReadyLine foodReadyAt={null} readyAtOnPhone={START + 10 * MINUTE} />,
    );
    expect(jest.getTimerCount()).toBe(1);

    screen.rerender(
      <ReadyLine
        foodReadyAt="2026-11-03T12:01:00.000Z"
        readyAtOnPhone={START + 10 * MINUTE}
      />,
    );
    expect(lineText(screen)).toBe('Ready');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not tick for a job with no ready time', () => {
    render(<ReadyLine foodReadyAt={null} readyAtOnPhone={null} />);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears its timer on unmount', () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const screen = render(
      <ReadyLine foodReadyAt={null} readyAtOnPhone={START + 10 * MINUTE} />,
    );
    expect(jest.getTimerCount()).toBe(1);
    screen.unmount();
    expect(jest.getTimerCount()).toBe(0);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  // Row 21 review: the time is read at each draw, so a new ready time between ticks (the refetch
  // after a delay) is counted from the clock as it is now, not from the last tick.
  it('a new ready time between ticks is counted from the current clock', () => {
    const screen = render(
      <ReadyLine foodReadyAt={null} readyAtOnPhone={START + 10 * MINUTE} />,
    );
    expect(lineText(screen)).toBe('Preparing, ~10 min');

    // 20 s on, less than a tick: nothing has redrawn yet.
    act(() => {
      jest.advanceTimersByTime(20 * SECOND);
    });
    const now = Date.now();
    expect(now).toBe(START + 20 * SECOND);

    // The refetch brings a ready time 3 min from now: exactly ~3 min, at once.
    screen.rerender(
      <ReadyLine foodReadyAt={null} readyAtOnPhone={now + 3 * MINUTE} />,
    );
    expect(lineText(screen)).toBe('Preparing, ~3 min');
  });

  it('with no prop change, keeps the first value for 29 s and moves on at 30 s', () => {
    // 3 min 15 s left: ~4 min. At 29 s, 2 min 46 s would be ~3, but nothing redraws until the tick.
    const screen = render(
      <ReadyLine
        foodReadyAt={null}
        readyAtOnPhone={START + 3 * MINUTE + 15 * SECOND}
      />,
    );
    expect(lineText(screen)).toBe('Preparing, ~4 min');

    act(() => {
      jest.advanceTimersByTime(29 * SECOND);
    });
    expect(lineText(screen)).toBe('Preparing, ~4 min');

    act(() => {
      jest.advanceTimersByTime(1 * SECOND);
    });
    expect(lineText(screen)).toBe('Preparing, ~3 min');
  });
});
