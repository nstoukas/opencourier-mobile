import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

// The width of an offer's countdown bar (scope row 60).
//
// The bar fills up as the offer's time runs out: it starts at the share of
// time already gone and grows to `fullWidth` over the time that is left. The
// animation starts once, when the offer's row appears, and is stopped when the
// row goes away. Before this, the animation restarted on every render.
export const useCountdownBar = (
  millisRemaining: number,
  totalMillis: number,
  fullWidth: number,
): Animated.Value => {
  const remaining = Math.min(Math.max(millisRemaining, 0), totalMillis);
  const elapsedShare = totalMillis > 0 ? 1 - remaining / totalMillis : 1;

  // `useRef(...).current` gives the same Animated.Value on every render.
  const width = useRef(new Animated.Value(elapsedShare * fullWidth)).current;

  useEffect(() => {
    const animation = Animated.timing(width, {
      toValue: fullWidth,
      duration: remaining,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
    // Run once per row on purpose: a re-render (a refetch, a parent update)
    // must not restart the countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return width;
};
