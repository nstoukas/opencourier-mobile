import React from 'react';
import { StyleSheet, Vibration } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { HoldButton } from './HoldButton';
import { color, radius } from '@app/styles/theme';

describe('HoldButton (row 135, Clauses 2, 3, 4, 5)', () => {
  let vibrateSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    vibrateSpy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    vibrateSpy.mockRestore();
  });

  describe('Hold timing and completion (Clause 2, 3)', () => {
    it('fires onHeld and buzzes once (40 ms) after full 200 ms hold, never before', () => {
      const onHeld = jest.fn();
      const { getByTestId } = render(
        <HoldButton
          holdMs={200}
          onHeld={onHeld}
          icon={CheckIcon}
          label="Accept"
          tone="success"
          accessibilityLabel="Accept"
          accessibilityHint="Hold to accept"
          testID="hold-accept"
        />,
      );
      const button = getByTestId('hold-accept');

      fireEvent(button, 'pressIn');

      // Advance to 199 ms -> not called yet, no vibration
      act(() => {
        jest.advanceTimersByTime(199);
      });
      expect(onHeld).not.toHaveBeenCalled();
      expect(vibrateSpy).not.toHaveBeenCalled();

      // Advance 1 ms to reach 200 ms -> called once, buzzed 40 ms
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(onHeld).toHaveBeenCalledTimes(1);
      expect(vibrateSpy).toHaveBeenCalledTimes(1);
      expect(vibrateSpy).toHaveBeenCalledWith(40);

      // Keeping finger down longer does not fire again
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(onHeld).toHaveBeenCalledTimes(1);
      expect(vibrateSpy).toHaveBeenCalledTimes(1);
    });

    it('fires onHeld and buzzes once (40 ms) after full 1000 ms hold, never before', () => {
      const onHeld = jest.fn();
      const { getByTestId } = render(
        <HoldButton
          holdMs={1000}
          onHeld={onHeld}
          icon={XIcon}
          label="Decline"
          tone="destructive"
          accessibilityLabel="Decline"
          accessibilityHint="Hold for 1 second to decline"
          testID="hold-decline"
        />,
      );
      const button = getByTestId('hold-decline');

      fireEvent(button, 'pressIn');

      // Advance to 999 ms -> not called yet, no vibration
      act(() => {
        jest.advanceTimersByTime(999);
      });
      expect(onHeld).not.toHaveBeenCalled();
      expect(vibrateSpy).not.toHaveBeenCalled();

      // Advance 1 ms to reach 1000 ms -> called once, buzzed 40 ms
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(onHeld).toHaveBeenCalledTimes(1);
      expect(vibrateSpy).toHaveBeenCalledTimes(1);
      expect(vibrateSpy).toHaveBeenCalledWith(40);

      // Keeping finger down longer does not fire again
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(onHeld).toHaveBeenCalledTimes(1);
      expect(vibrateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Short press and cancellation (Clause 2, 3)', () => {
    it('release at 190 ms for a 200 ms hold does nothing, now or later', () => {
      const onHeld = jest.fn();
      const { getByTestId } = render(
        <HoldButton
          holdMs={200}
          onHeld={onHeld}
          icon={CheckIcon}
          label="Accept"
          tone="success"
          accessibilityLabel="Accept"
          accessibilityHint="Hold to accept"
          testID="hold-accept"
        />,
      );
      const button = getByTestId('hold-accept');

      fireEvent(button, 'pressIn');
      act(() => {
        jest.advanceTimersByTime(190);
      });
      expect(onHeld).not.toHaveBeenCalled();
      expect(vibrateSpy).not.toHaveBeenCalled();

      // Release before 200 ms
      fireEvent(button, 'pressOut');

      // Advance well past 200 ms -> never called now or later
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(onHeld).not.toHaveBeenCalled();
      expect(vibrateSpy).not.toHaveBeenCalled();
    });

    it('release at 990 ms for a 1000 ms hold does nothing, now or later', () => {
      const onHeld = jest.fn();
      const { getByTestId } = render(
        <HoldButton
          holdMs={1000}
          onHeld={onHeld}
          icon={XIcon}
          label="Decline"
          tone="destructive"
          accessibilityLabel="Decline"
          accessibilityHint="Hold for 1 second to decline"
          testID="hold-decline"
        />,
      );
      const button = getByTestId('hold-decline');

      fireEvent(button, 'pressIn');
      act(() => {
        jest.advanceTimersByTime(990);
      });
      expect(onHeld).not.toHaveBeenCalled();
      expect(vibrateSpy).not.toHaveBeenCalled();

      // Release before 1000 ms
      fireEvent(button, 'pressOut');

      // Advance past 1000 ms -> never called now or later
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(onHeld).not.toHaveBeenCalled();
      expect(vibrateSpy).not.toHaveBeenCalled();
    });

    it('quick tap (50 ms) does nothing and does not buzz', () => {
      const onHeld = jest.fn();
      const { getByTestId } = render(
        <HoldButton
          holdMs={200}
          onHeld={onHeld}
          icon={CheckIcon}
          label="Accept"
          tone="success"
          accessibilityLabel="Accept"
          accessibilityHint="Hold to accept"
          testID="hold-accept"
        />,
      );
      const button = getByTestId('hold-accept');

      fireEvent(button, 'pressIn');
      act(() => {
        jest.advanceTimersByTime(50);
      });
      fireEvent(button, 'pressOut');

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onHeld).not.toHaveBeenCalled();
      expect(vibrateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Refused accept and reset (Clause 4)', () => {
    it('after a completed hold the button is ready again: second full hold fires again', () => {
      const onHeld = jest.fn();
      const { getByTestId } = render(
        <HoldButton
          holdMs={200}
          onHeld={onHeld}
          icon={CheckIcon}
          label="Accept"
          tone="success"
          accessibilityLabel="Accept"
          accessibilityHint="Hold to accept"
          testID="hold-accept"
        />,
      );
      const button = getByTestId('hold-accept');

      // First hold completes
      fireEvent(button, 'pressIn');
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(onHeld).toHaveBeenCalledTimes(1);
      expect(vibrateSpy).toHaveBeenCalledTimes(1);

      fireEvent(button, 'pressOut');

      // Second hold begins and completes (e.g. refused by server or re-offered)
      fireEvent(button, 'pressIn');
      act(() => {
        jest.advanceTimersByTime(199);
      });
      expect(onHeld).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(onHeld).toHaveBeenCalledTimes(2);
      expect(vibrateSpy).toHaveBeenCalledTimes(2);
    });

    it('unmounting mid hold never fires onHeld or buzzes', () => {
      const onHeld = jest.fn();
      const { getByTestId, unmount } = render(
        <HoldButton
          holdMs={200}
          onHeld={onHeld}
          icon={CheckIcon}
          label="Accept"
          tone="success"
          accessibilityLabel="Accept"
          accessibilityHint="Hold to accept"
          testID="hold-accept"
        />,
      );
      const button = getByTestId('hold-accept');

      fireEvent(button, 'pressIn');
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Unmount before 200 ms
      unmount();

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(onHeld).not.toHaveBeenCalled();
      expect(vibrateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Screen reader accessibility and activate action (Clause 5)', () => {
    it('sets accessibilityRole="button", accessibilityLabel, and accessibilityHint', () => {
      const { getByTestId } = render(
        <HoldButton
          holdMs={200}
          onHeld={jest.fn()}
          icon={CheckIcon}
          label="Accept"
          tone="success"
          accessibilityLabel="Accept this order"
          accessibilityHint="Hold to take this order"
          testID="hold-accept"
        />,
      );
      const button = getByTestId('hold-accept');

      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe('Accept this order');
      expect(button.props.accessibilityHint).toBe('Hold to take this order');
      expect(button.props.accessibilityActions).toEqual([{ name: 'activate' }]);
    });

    it('screen reader "activate" action fires at once and buzzes, without waiting for hold timer', () => {
      const onHeld = jest.fn();
      const { getByTestId } = render(
        <HoldButton
          holdMs={1000}
          onHeld={onHeld}
          icon={XIcon}
          label="Decline"
          tone="destructive"
          accessibilityLabel="Decline"
          accessibilityHint="Hold for 1 second to decline"
          testID="hold-decline"
        />,
      );
      const button = getByTestId('hold-decline');

      // TalkBack / VoiceOver double tap triggers "activate"
      fireEvent(button, 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });

      // Fires immediately without advancing any timer
      expect(onHeld).toHaveBeenCalledTimes(1);
      expect(vibrateSpy).toHaveBeenCalledTimes(1);
      expect(vibrateSpy).toHaveBeenCalledWith(40);
    });

    it('non-activate accessibility action does not fire onHeld', () => {
      const onHeld = jest.fn();
      const { getByTestId } = render(
        <HoldButton
          holdMs={200}
          onHeld={onHeld}
          icon={CheckIcon}
          label="Accept"
          tone="success"
          accessibilityLabel="Accept"
          accessibilityHint="Hold to accept"
          testID="hold-accept"
        />,
      );
      const button = getByTestId('hold-accept');

      fireEvent(button, 'accessibilityAction', {
        nativeEvent: { actionName: 'magicTap' },
      });

      expect(onHeld).not.toHaveBeenCalled();
      expect(vibrateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Styling and fill layout (Clause 1, 3)', () => {
    it('applies color tokens based on tone and renders label and fill view', () => {
      const { getByTestId, getByText } = render(
        <HoldButton
          holdMs={200}
          onHeld={jest.fn()}
          icon={CheckIcon}
          label="Accept"
          tone="success"
          accessibilityLabel="Accept"
          accessibilityHint="Hold to accept"
          testID="hold-accept"
        />,
      );
      const button = getByTestId('hold-accept');
      const flatStyle = StyleSheet.flatten(button.props.style);
      expect(flatStyle.backgroundColor).toBe(color.success);
      expect(flatStyle.borderRadius).toBe(radius.xl);
      expect(flatStyle.overflow).toBe('hidden');

      expect(getByText('Accept')).toBeTruthy();
      expect(getByTestId('hold-accept-fill')).toBeTruthy();

      // Trigger layout to ensure onLayout runs without error
      fireEvent(button, 'layout', {
        nativeEvent: { layout: { width: 220, height: 100 } },
      });
    });

    it('applies destructive color token for tone="destructive"', () => {
      const { getByTestId } = render(
        <HoldButton
          holdMs={1000}
          onHeld={jest.fn()}
          icon={XIcon}
          label="Decline"
          tone="destructive"
          accessibilityLabel="Decline"
          accessibilityHint="Hold for 1 second to decline"
          testID="hold-decline"
        />,
      );
      const button = getByTestId('hold-decline');
      const flatStyle = StyleSheet.flatten(button.props.style);
      expect(flatStyle.backgroundColor).toBe(color.destructive);
    });
  });
});
