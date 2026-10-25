import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Animated } from 'react-native';
import { useCountdownBar } from './useCountdownBar';

function BarTestHost({
  millisRemaining,
  totalMillis,
  fullWidth,
  onValue,
}: {
  millisRemaining: number;
  totalMillis: number;
  fullWidth: number;
  onValue?: (val: Animated.Value) => void;
}) {
  const anim = useCountdownBar(millisRemaining, totalMillis, fullWidth);
  onValue?.(anim);
  return null;
}

describe('useCountdownBar', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('initializes Animated.Value at proportional width for elapsed time', () => {
    let animVal: Animated.Value | undefined;

    let tree: renderer.ReactTestRenderer;
    act(() => {
      // Total 60000ms, 45000ms remaining => 15000ms elapsed (25% elapsed of 200px = 50px)
      tree = renderer.create(
        <BarTestHost
          millisRemaining={45000}
          totalMillis={60000}
          fullWidth={200}
          onValue={val => {
            animVal = val;
          }}
        />,
      );
    });

    expect(animVal).toBeDefined();
    // @ts-expect-error _value is private in Animated.Value but accessible in tests
    expect(animVal?._value).toBeCloseTo(50);

    act(() => {
      tree.unmount();
    });
  });

  it('keeps the same Animated.Value instance across re-renders without restarting', () => {
    let animVal1: Animated.Value | undefined;
    let animVal2: Animated.Value | undefined;

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BarTestHost
          millisRemaining={60000}
          totalMillis={60000}
          fullWidth={200}
          onValue={val => {
            animVal1 = val;
          }}
        />,
      );
    });

    // Re-render with new remaining time
    act(() => {
      tree.update(
        <BarTestHost
          millisRemaining={30000}
          totalMillis={60000}
          fullWidth={200}
          onValue={val => {
            animVal2 = val;
          }}
        />,
      );
    });

    expect(animVal1).toBe(animVal2);

    act(() => {
      tree.unmount();
    });
  });

  it('clamps remaining time to 0 when negative', () => {
    let animVal: Animated.Value | undefined;

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BarTestHost
          millisRemaining={-5000}
          totalMillis={60000}
          fullWidth={200}
          onValue={val => {
            animVal = val;
          }}
        />,
      );
    });

    // Negative remaining => 0 remaining => 100% elapsed = 200px
    // @ts-expect-error _value is private
    expect(animVal?._value).toBe(200);

    act(() => {
      tree.unmount();
    });
  });

  it('starts animation once per mounted row and does not restart across re-renders with new props', () => {
    const timingSpy = jest.spyOn(Animated, 'timing');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      // 45s remaining out of 60s total, clamped duration should be 45000ms
      tree = renderer.create(
        <BarTestHost
          millisRemaining={45000}
          totalMillis={60000}
          fullWidth={200}
        />,
      );
    });

    // Initial render starts animation once with fullWidth and clamped time left
    expect(timingSpy).toHaveBeenCalledTimes(1);
    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({
        toValue: 200,
        duration: 45000,
        useNativeDriver: false,
      }),
    );

    // Re-render several times with new props (e.g. refetch updates millisRemaining)
    act(() => {
      tree.update(
        <BarTestHost
          millisRemaining={30000}
          totalMillis={60000}
          fullWidth={200}
        />,
      );
    });
    act(() => {
      tree.update(
        <BarTestHost
          millisRemaining={15000}
          totalMillis={60000}
          fullWidth={200}
        />,
      );
    });
    act(() => {
      tree.update(
        <BarTestHost
          millisRemaining={5000}
          totalMillis={60000}
          fullWidth={200}
        />,
      );
    });

    // Animation must NOT restart on re-renders: still called exactly once
    expect(timingSpy).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });

  it('clamps duration to full duration when millisRemaining exceeds totalMillis', () => {
    const timingSpy = jest.spyOn(Animated, 'timing');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      // 75000 remaining with total 60000 -> clamped to 60000
      tree = renderer.create(
        <BarTestHost
          millisRemaining={75000}
          totalMillis={60000}
          fullWidth={200}
        />,
      );
    });

    expect(timingSpy).toHaveBeenCalledTimes(1);
    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({
        toValue: 200,
        duration: 60000,
      }),
    );

    act(() => {
      tree.unmount();
    });
  });

  it('clamps duration to 0 when millisRemaining is negative', () => {
    const timingSpy = jest.spyOn(Animated, 'timing');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      // Negative remaining -> clamped to 0
      tree = renderer.create(
        <BarTestHost
          millisRemaining={-5000}
          totalMillis={60000}
          fullWidth={200}
        />,
      );
    });

    expect(timingSpy).toHaveBeenCalledTimes(1);
    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({
        toValue: 200,
        duration: 0,
      }),
    );

    act(() => {
      tree.unmount();
    });
  });
});
