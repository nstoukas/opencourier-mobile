import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsCell, SettingsCellType } from './SettingsCell';
import { control } from '@app/styles/theme';
import '@app/localization/i18n';

describe('SettingsCell with switch (spec 0007, AC-5)', () => {
  it('has minHeight 48 (control.xl) on the switch row style', () => {
    const { UNSAFE_getByType } = render(
      <SettingsCell
        cellType={SettingsCellType.switch}
        title="auto_accept"
        switchValue={false}
      />,
    );
    const row = UNSAFE_getByType(TouchableOpacity);
    const flatStyle = StyleSheet.flatten(row.props.style);
    expect(flatStyle.minHeight).toBe(control.xl);
    expect(flatStyle.minHeight).toBe(48);
  });

  it('pressing the row calls onSwitchValueChange with true when switchValue is false', () => {
    const onSwitchValueChange = jest.fn();
    const { UNSAFE_getByType } = render(
      <SettingsCell
        cellType={SettingsCellType.switch}
        title="auto_accept"
        switchValue={false}
        onSwitchValueChange={onSwitchValueChange}
      />,
    );
    const row = UNSAFE_getByType(TouchableOpacity);
    fireEvent.press(row);
    expect(onSwitchValueChange).toHaveBeenCalledTimes(1);
    expect(onSwitchValueChange).toHaveBeenCalledWith(true);
  });

  it('pressing the row calls onSwitchValueChange with false when switchValue is true', () => {
    const onSwitchValueChange = jest.fn();
    const { UNSAFE_getByType } = render(
      <SettingsCell
        cellType={SettingsCellType.switch}
        title="auto_accept"
        switchValue={true}
        onSwitchValueChange={onSwitchValueChange}
      />,
    );
    const row = UNSAFE_getByType(TouchableOpacity);
    fireEvent.press(row);
    expect(onSwitchValueChange).toHaveBeenCalledTimes(1);
    expect(onSwitchValueChange).toHaveBeenCalledWith(false);
  });
});
