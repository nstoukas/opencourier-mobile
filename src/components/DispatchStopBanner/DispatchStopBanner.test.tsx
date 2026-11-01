import React from 'react';
import { render, screen } from '@testing-library/react-native';
import '@app/localization/i18n';
import { DispatchStopBanner } from './DispatchStopBanner';
import { useDispatchState } from '@app/hooks/useDispatchState';
import { styles } from './DispatchStopBanner.styles';

jest.mock('@app/hooks/useDispatchState', () => ({
  useDispatchState: jest.fn(),
}));

describe('DispatchStopBanner (spec 0014 AC-7, review fix af6d39c)', () => {
  const mockCurrent = {
    reason: 'HEAT' as const,
    startsAt: '2026-11-01T10:00:00Z',
    endsAt: '2026-11-01T15:00:00Z',
    message: 'Dispatch is stopped until 17:00 (heat).',
  };

  const mockNext = {
    reason: 'STORM' as const,
    startsAt: '2026-11-01T18:00:00Z',
    endsAt: null,
    message: 'Dispatch stops today 18:00 (storm).',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when data is undefined or has neither current nor next stop', () => {
    (useDispatchState as jest.Mock).mockReturnValue({ data: undefined });
    const { toJSON, rerender } = render(<DispatchStopBanner />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('dispatch-stop-banner')).toBeNull();

    (useDispatchState as jest.Mock).mockReturnValue({
      data: { current: null, next: null },
    });
    rerender(<DispatchStopBanner />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('dispatch-stop-banner')).toBeNull();
  });

  it('with current stop: renders "Dispatch stopped", current.message, and alert role', () => {
    (useDispatchState as jest.Mock).mockReturnValue({
      data: {
        current: mockCurrent,
        next: null,
      },
    });

    render(<DispatchStopBanner />);

    const banner = screen.getByTestId('dispatch-stop-banner');
    expect(banner).toBeTruthy();
    expect(screen.getByText('Dispatch stopped')).toBeTruthy();
    expect(screen.getByText('Dispatch is stopped until 17:00 (heat).')).toBeTruthy();

    const card = (banner.children[0] as any);
    expect(card.props.accessibilityRole).toBe('alert');
    // Card uses stopped style
    expect(card.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining(styles.stopped)]),
    );
  });

  it('with only next stop: renders "Dispatch stops soon", next.message, and text role', () => {
    (useDispatchState as jest.Mock).mockReturnValue({
      data: {
        current: null,
        next: mockNext,
      },
    });

    render(<DispatchStopBanner />);

    const banner = screen.getByTestId('dispatch-stop-banner');
    expect(banner).toBeTruthy();
    expect(screen.getByText('Dispatch stops soon')).toBeTruthy();
    expect(screen.getByText('Dispatch stops today 18:00 (storm).')).toBeTruthy();

    const card = (banner.children[0] as any);
    expect(card.props.accessibilityRole).toBe('text');
    // Card uses soon style
    expect(card.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining(styles.soon)]),
    );
  });

  it('with both current and next stops: shows current before next', () => {
    (useDispatchState as jest.Mock).mockReturnValue({
      data: {
        current: mockCurrent,
        next: mockNext,
      },
    });

    render(<DispatchStopBanner />);

    const banner = screen.getByTestId('dispatch-stop-banner');
    expect(banner).toBeTruthy();
    // Must show current stop details
    expect(screen.getByText('Dispatch stopped')).toBeTruthy();
    expect(screen.getByText('Dispatch is stopped until 17:00 (heat).')).toBeTruthy();
    const card = (banner.children[0] as any);
    expect(card.props.accessibilityRole).toBe('alert');

    // Must NOT show next stop details
    expect(screen.queryByText('Dispatch stops soon')).toBeNull();
    expect(screen.queryByText('Dispatch stops today 18:00 (storm).')).toBeNull();
  });

  it('passes inFront prop to useDispatchState (defaults to true)', () => {
    (useDispatchState as jest.Mock).mockReturnValue({
      data: { current: mockCurrent, next: null },
    });

    // Default inFront
    const { rerender } = render(<DispatchStopBanner />);
    expect(useDispatchState).toHaveBeenLastCalledWith(true);

    // Explicit inFront = false
    rerender(<DispatchStopBanner inFront={false} />);
    expect(useDispatchState).toHaveBeenLastCalledWith(false);

    // Explicit inFront = true
    rerender(<DispatchStopBanner inFront={true} />);
    expect(useDispatchState).toHaveBeenLastCalledWith(true);
  });
});
