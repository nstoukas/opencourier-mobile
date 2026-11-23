import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

// How fast the fill empties when a hold is let go early.
const EMPTY_MS = 150;

// Row 136: the one hold logic behind every button that answers only to a hold (the SOS button,
// spec 0022, and the offer's Accept and Decline, row 135), so a fix to how a hold works lands once.
//
// - `begin` (on press in) starts `progress` going from 0 to 1 over `holdMs` and a timer for `holdMs`.
// - The timer, not the animation, decides: when it runs out, `progress` is back to 0 at once (so
//   the button is ready for another try, e.g. after a refused answer) and `onHeld` runs, once.
// - `release` (on press out) before the time is up stops the timer and empties the fill: nothing
//   happens at all.
// - Leaving the screen mid hold never runs `onHeld`.
//
// `onHeld` is the one from the render the press started in, as each button did before.
export const useHoldTimer = (holdMs: number, onHeld: () => void) => {
  // 0 to 1: how far the hold has gone. `useRef` keeps one value across redraws.
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 0,
      duration: EMPTY_MS,
      useNativeDriver: false,
    }).start();
  };

  const begin = () => {
    cancel();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: holdMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    timer.current = setTimeout(() => {
      timer.current = null;
      progress.setValue(0);
      onHeld();
    }, holdMs);
  };

  // Let go: only a hold still running is stopped (after it ran out there is nothing to stop).
  const release = () => {
    if (timer.current) {
      cancel();
    }
  };

  // Never fire after the button is gone.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return { progress, begin, release };
};
