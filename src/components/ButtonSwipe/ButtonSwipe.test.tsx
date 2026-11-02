import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, * as Reanimated from 'react-native-reanimated';
import ButtonSwipe, { BUTTON_WIDTH } from './ButtonSwipe';

describe('ButtonSwipe (spec 0018, spec 0019, AC-5, Pin 4)', () => {
  it('passes activeOffsetX [-10, 10] to its PanGestureHandler', () => {
    const { UNSAFE_getByType } = render(
      <ButtonSwipe
        isSwiped={false}
        onSwiped={jest.fn()}
        enabled={true}
        title="Slide to Complete"
        isLoading={false}
      />,
    );

    const pan = UNSAFE_getByType(PanGestureHandler);
    expect(pan.props.activeOffsetX).toEqual([-10, 10]);
  });

  it('with no height renders 48 tall and draws a 32 px knob (as before)', () => {
    const { UNSAFE_getByType } = render(
      <ButtonSwipe
        isSwiped={false}
        onSwiped={jest.fn()}
        enabled={true}
        title="Slide to Complete"
        isLoading={false}
      />,
    );

    const pan = UNSAFE_getByType(PanGestureHandler);
    const container = pan.parent!;
    const containerStyle = StyleSheet.flatten(container.props.style);
    expect(containerStyle.height).toBe(48);

    const knob = pan.props.children;
    const knobStyle = StyleSheet.flatten(knob.props.style);

    // Default container is 48 tall
    // knobRoom = 48 - 14 = 34; drawn knob = knobRoom - 2 = 32
    expect(knobStyle.width).toBe(32);
    expect(knobStyle.height).toBe(32);
  });

  it('with height 100 renders 100 tall and draws an 84 px knob', () => {
    const { UNSAFE_getByType } = render(
      <ButtonSwipe
        height={100}
        isSwiped={false}
        onSwiped={jest.fn()}
        enabled={true}
        title="Accept"
        isLoading={false}
      />,
    );

    const pan = UNSAFE_getByType(PanGestureHandler);
    const container = pan.parent!;
    const containerStyle = StyleSheet.flatten(container.props.style);
    expect(containerStyle.height).toBe(100);

    const knob = pan.props.children;
    const knobStyle = StyleSheet.flatten(knob.props.style);

    // Container with height 100
    // knobRoom = 100 - 14 = 86; drawn knob = knobRoom - 2 = 84
    expect(knobStyle.width).toBe(84);
    expect(knobStyle.height).toBe(84);
  });

  it('travel (swipeRange) and half way point follow knobRoom math through rendered styles and gesture handler', () => {
    let capturedHandlers: any = null;
    const gestureSpy = jest
      .spyOn(Reanimated, 'useAnimatedGestureHandler')
      .mockImplementation((handlers: any) => {
        capturedHandlers = handlers;
        return handlers;
      });

    const onSwipedMock = jest.fn();

    const { UNSAFE_getByType, unmount } = render(
      <ButtonSwipe
        height={100}
        isSwiped={false}
        onSwiped={onSwipedMock}
        enabled={true}
        title="Accept"
        isLoading={false}
      />,
    );

    const pan = UNSAFE_getByType(PanGestureHandler);
    const knob = pan.props.children;
    const knobStyle = StyleSheet.flatten(knob.props.style);
    const knobDrawn = knobStyle.width;
    expect(knobDrawn).toBe(84);

    // Derived from rendered knob style:
    // knobRoom = knob + 2 = 86
    const knobRoom = knobDrawn + 2;
    expect(knobRoom).toBe(86);
    // swipeRange = BUTTON_WIDTH - 2 * BUTTON_PADDING - knobRoom = BUTTON_WIDTH - 14 - 86 = BUTTON_WIDTH - 100
    const expectedSwipeRange = BUTTON_WIDTH - 14 - knobRoom;
    // halfWay = BUTTON_WIDTH / 2 - knobRoom / 2 = BUTTON_WIDTH / 2 - 43
    const expectedHalfWay = BUTTON_WIDTH / 2 - knobRoom / 2;

    expect(capturedHandlers).toBeDefined();

    const ctx = { completed: false };
    capturedHandlers.onStart({}, ctx);

    // Drag to just below halfWay: release calls onSwiped(false)
    capturedHandlers.onActive({ translationX: expectedHalfWay - 1 }, ctx);
    capturedHandlers.onEnd();
    expect(onSwipedMock).toHaveBeenCalledWith(false);

    // Drag to halfWay: release calls onSwiped(true)
    onSwipedMock.mockClear();
    capturedHandlers.onActive({ translationX: expectedHalfWay }, ctx);
    capturedHandlers.onEnd();
    expect(onSwipedMock).toHaveBeenCalledWith(true);

    // Drag up to full swipeRange: release calls onSwiped(true)
    onSwipedMock.mockClear();
    capturedHandlers.onActive({ translationX: expectedSwipeRange }, ctx);
    capturedHandlers.onEnd();
    expect(onSwipedMock).toHaveBeenCalledWith(true);

    unmount();
    gestureSpy.mockRestore();
  });
});
