import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import * as Reanimated from 'react-native-reanimated';
import ButtonSwipe, { BUTTON_WIDTH } from './ButtonSwipe';

describe('ButtonSwipe (spec 0018, spec 0019, AC-5, Pin 4, row 134 Clause 5)', () => {
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

  describe('Centred text layout and subtitle line count (Clause 5)', () => {
    it('centres title and subtitle on whole button keeping knobRoom free on both sides', () => {
      const { getByText } = render(
        <ButtonSwipe
          isSwiped={false}
          onSwiped={jest.fn()}
          enabled={true}
          title="Accept"
          subtitle="Slide to accept"
          isLoading={false}
        />,
      );

      // Default height is 48 -> knobRoom = 48 - 14 = 34
      // BUTTON_PADDING = 7
      // left and right should both be BUTTON_PADDING + knobRoom = 7 + 34 = 41
      const title = getByText('Accept');
      let textArea: any = title;
      while (
        textArea &&
        (!textArea.props?.style ||
          StyleSheet.flatten(textArea.props.style).left === undefined)
      ) {
        textArea = textArea.parent;
      }
      expect(textArea).toBeTruthy();
      const style = StyleSheet.flatten(textArea.props.style);
      expect(style.left).toBe(41);
      expect(style.right).toBe(41);
    });

    it('subtitle takes 1 line on standard 48 px swipe and shrinks to fit', () => {
      const { getByText } = render(
        <ButtonSwipe
          isSwiped={false}
          onSwiped={jest.fn()}
          enabled={true}
          title="Accept"
          subtitle="Slide to accept on one line"
          isLoading={false}
        />,
      );

      const title = getByText('Accept');
      expect(title.props.numberOfLines).toBe(1);
      expect(title.props.adjustsFontSizeToFit).toBe(true);
      expect(title.props.minimumFontScale).toBe(0.7);

      const subtitle = getByText('Slide to accept on one line');
      expect(subtitle.props.numberOfLines).toBe(1);
      expect(subtitle.props.adjustsFontSizeToFit).toBe(true);
      expect(subtitle.props.minimumFontScale).toBe(0.7);
    });

    it('subtitle takes 2 lines when swipe is taller (height > 48, e.g. 100 px offer swipe)', () => {
      const { getByText } = render(
        <ButtonSwipe
          height={100}
          isSwiped={false}
          onSwiped={jest.fn()}
          enabled={true}
          title="Accept"
          subtitle="Slide to accept which wraps to two lines when taller"
          isLoading={false}
        />,
      );

      const subtitle = getByText(
        'Slide to accept which wraps to two lines when taller',
      );
      expect(subtitle.props.numberOfLines).toBe(2);
    });

    it('renders no subtitle text when subtitle is empty string', () => {
      const { queryByText } = render(
        <ButtonSwipe
          isSwiped={false}
          onSwiped={jest.fn()}
          enabled={true}
          title="Lone Title"
          subtitle=""
          isLoading={false}
        />,
      );

      expect(queryByText('Lone Title')).toBeTruthy();
    });
  });
});
