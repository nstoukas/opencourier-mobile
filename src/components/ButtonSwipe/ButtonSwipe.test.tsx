import React from 'react';
import { render } from '@testing-library/react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import ButtonSwipe from './ButtonSwipe';

describe('ButtonSwipe (spec 0018, review fix)', () => {
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
});
