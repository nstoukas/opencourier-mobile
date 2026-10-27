import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SideMenuItemSwitch } from './SideMenuItemSwitch';
import { SideMenuItem } from '@app/types/types';
import { control } from '@app/styles/theme';
import '@app/localization/i18n';

describe('SideMenuItemSwitch (spec 0007, AC-5)', () => {
  it('has minHeight 48 (control.xl) on the row style', () => {
    const { UNSAFE_getByType } = render(
      <SideMenuItemSwitch
        isOn={false}
        onValueChange={() => {}}
        item={SideMenuItem.Location}
      />,
    );
    const row = UNSAFE_getByType(TouchableOpacity);
    const flatStyle = StyleSheet.flatten(row.props.style);
    expect(flatStyle.minHeight).toBe(control.xl);
    expect(flatStyle.minHeight).toBe(48);
  });

  it('pressing the row (not the Switch) calls onValueChange with true when isOn is false', () => {
    const onValueChange = jest.fn();
    const { UNSAFE_getByType } = render(
      <SideMenuItemSwitch
        isOn={false}
        onValueChange={onValueChange}
        item={SideMenuItem.Location}
      />,
    );
    const row = UNSAFE_getByType(TouchableOpacity);
    fireEvent.press(row);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('pressing the row (not the Switch) calls onValueChange with false when isOn is true', () => {
    const onValueChange = jest.fn();
    const { UNSAFE_getByType } = render(
      <SideMenuItemSwitch
        isOn={true}
        onValueChange={onValueChange}
        item={SideMenuItem.AutoOrders}
      />,
    );
    const row = UNSAFE_getByType(TouchableOpacity);
    fireEvent.press(row);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(false);
  });
});
