import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import '@app/localization/i18n';
import { SOS_HOLD_MS, SosHoldButton } from './SosHoldButton';
import { radius } from '@app/styles/theme';

describe('SosHoldButton (spec 0022, AC-2, row 134 Clause 4)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls onHeld once after a 3000 ms press', () => {
    const onHeld = jest.fn();
    const { getByTestId } = render(<SosHoldButton onHeld={onHeld} />);
    const button = getByTestId('sos-hold-button');

    // Press in
    fireEvent(button, 'pressIn');

    // Advance to 2999 ms -> not called yet
    act(() => {
      jest.advanceTimersByTime(SOS_HOLD_MS - 1);
    });
    expect(onHeld).not.toHaveBeenCalled();

    // Advance 1 ms to reach 3000 ms -> called once
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onHeld).toHaveBeenCalledTimes(1);

    // Later time advances do not call it again
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onHeld).toHaveBeenCalledTimes(1);
  });

  it('release at 2900 ms calls nothing, and nothing later either', () => {
    const onHeld = jest.fn();
    const { getByTestId } = render(<SosHoldButton onHeld={onHeld} />);
    const button = getByTestId('sos-hold-button');

    fireEvent(button, 'pressIn');

    act(() => {
      jest.advanceTimersByTime(2900);
    });
    expect(onHeld).not.toHaveBeenCalled();

    // Release before 3000 ms
    fireEvent(button, 'pressOut');

    // Advance past 3000 ms
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onHeld).not.toHaveBeenCalled();
  });

  it('a second press after an early release starts from zero (needs full 3000 ms)', () => {
    const onHeld = jest.fn();
    const { getByTestId } = render(<SosHoldButton onHeld={onHeld} />);
    const button = getByTestId('sos-hold-button');

    // First press released at 2000 ms
    fireEvent(button, 'pressIn');
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    fireEvent(button, 'pressOut');
    expect(onHeld).not.toHaveBeenCalled();

    // Second press begins
    fireEvent(button, 'pressIn');

    // Advance 1500 ms (total 3500 ms wall clock, but only 1500 ms in this press)
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(onHeld).not.toHaveBeenCalled();

    // Advance another 1499 ms (2999 ms total in second press) -> still not called
    act(() => {
      jest.advanceTimersByTime(1499);
    });
    expect(onHeld).not.toHaveBeenCalled();

    // Advance 1 ms (reaches 3000 ms for second press) -> called
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onHeld).toHaveBeenCalledTimes(1);
  });

  it('unmounting during a press never calls onHeld', () => {
    const onHeld = jest.fn();
    const { getByTestId, unmount } = render(<SosHoldButton onHeld={onHeld} />);
    const button = getByTestId('sos-hold-button');

    fireEvent(button, 'pressIn');

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    // Unmount before 3000 ms
    unmount();

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onHeld).not.toHaveBeenCalled();
  });

  describe('Round siren and screen reader accessibility (Clause 4)', () => {
    it('is a round 48x48 button with NO visible text words', () => {
      const { getByTestId, UNSAFE_queryByType } = render(
        <SosHoldButton onHeld={jest.fn()} />,
      );
      const button = getByTestId('sos-hold-button');
      const flatStyle = StyleSheet.flatten(button.props.style);

      expect(flatStyle.width).toBe(48);
      expect(flatStyle.height).toBe(48);
      expect(flatStyle.borderRadius).toBe(radius.full);

      // Shows NO visible words
      expect(UNSAFE_queryByType(Text)).toBeNull();
    });

    it('provides accessible button role and localized accessibilityLabel for screen readers', () => {
      const { getByTestId } = render(<SosHoldButton onHeld={jest.fn()} />);
      const button = getByTestId('sos-hold-button');

      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe('SOS');
      expect(button.props.accessibilityHint).toBeTruthy();
    });
  });
});
