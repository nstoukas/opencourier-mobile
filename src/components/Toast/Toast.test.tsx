import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Toast } from './Toast';
import { ToastMessage } from '@app/types/types';
import { control } from '@app/styles/theme';
import { hitSlopFor } from '@app/utilities/touch';
import '@app/localization/i18n';

describe('Toast (spec 0007, AC-5)', () => {
  it('toast container has minHeight 48 (control.xl)', () => {
    const { UNSAFE_getByType } = render(
      <Toast toast={ToastMessage.itemsBagged} onClose={() => {}} />,
    );
    // The outermost View is the toast container with styles.container
    const container = UNSAFE_getByType(View);
    const flatStyle = StyleSheet.flatten(container.props.style);
    expect(flatStyle.minHeight).toBe(control.xl);
    expect(flatStyle.minHeight).toBe(48);
  });

  it('close button hitSlop is { top: 12, bottom: 12, left: 4, right: 4 } (hitSlopFor(40, 24))', () => {
    const onClose = jest.fn();
    const { UNSAFE_getByType } = render(
      <Toast toast={ToastMessage.itemsBagged} onClose={onClose} />,
    );
    const closeBtn = UNSAFE_getByType(TouchableOpacity);
    expect(closeBtn.props.hitSlop).toEqual({
      top: 12,
      bottom: 12,
      left: 4,
      right: 4,
    });
    expect(closeBtn.props.hitSlop).toEqual(hitSlopFor(40, 24));

    fireEvent.press(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render close button when disableClose is true', () => {
    const { UNSAFE_queryByType } = render(
      <Toast
        toast={ToastMessage.itemsBagged}
        disableClose={true}
        onClose={() => {}}
      />,
    );
    expect(UNSAFE_queryByType(TouchableOpacity)).toBeNull();
  });
});
