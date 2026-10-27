import React from 'react';
import { StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { render } from '@testing-library/react-native';
import { Button, ButtonType } from './Button';
import { color, control } from '@app/styles/theme';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { Icon } from '@app/components/Icon/Icon';

describe('AC-5, AC-6, AC-7: Button component', () => {
  it('renders container with height 48 (control.xl)', () => {
    const { UNSAFE_getByType } = render(
      <Button title="Test" onPress={() => {}} />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const flatStyle = StyleSheet.flatten(touchable.props.style);
    expect(flatStyle.height).toBe(control.xl);
    expect(flatStyle.height).toBe(48);
  });

  const buttonLookCases = [
    {
      type: ButtonType.black,
      name: 'black',
      expectedBg: color.primary,
      expectedText: color['primary-foreground'],
      expectedTone: 'primary-foreground',
    },
    {
      type: ButtonType.green,
      name: 'green',
      expectedBg: color.success,
      expectedText: color['success-foreground'],
      expectedTone: 'success-foreground',
    },
    {
      type: ButtonType.red,
      name: 'red',
      expectedBg: color.destructive,
      expectedText: color['destructive-foreground'],
      expectedTone: 'destructive-foreground',
    },
    {
      type: ButtonType.yellow,
      name: 'yellow',
      expectedBg: color.warning,
      expectedText: color['warning-foreground'],
      expectedTone: 'warning-foreground',
    },
    {
      type: ButtonType.white,
      name: 'white',
      expectedBg: color.background,
      expectedText: color.foreground,
      expectedTone: 'foreground',
    },
    {
      type: ButtonType.gray,
      name: 'gray',
      expectedBg: color.secondary,
      expectedText: color['secondary-foreground'],
      expectedTone: 'secondary-foreground',
    },
    {
      type: ButtonType.grayBGBlackText,
      name: 'grayBGBlackText',
      expectedBg: color.secondary,
      expectedText: color['secondary-foreground'],
      expectedTone: 'secondary-foreground',
    },
    {
      type: ButtonType.grayBGRedText,
      name: 'grayBGRedText',
      expectedBg: color.secondary,
      expectedText: color.destructive,
      expectedTone: 'destructive',
    },
    {
      type: ButtonType.redBGRedText,
      name: 'redBGRedText',
      expectedBg: color['destructive-soft'],
      expectedText: color.destructive,
      expectedTone: 'destructive',
    },
  ];

  describe.each(buttonLookCases)(
    'ButtonType $name',
    ({ type, expectedBg, expectedText, expectedTone }) => {
      it('renders the background and text color from the spec button table', () => {
        const { UNSAFE_getByType, getByText } = render(
          <Button title="Submit" type={type} onPress={() => {}} />,
        );
        const touchable = UNSAFE_getByType(TouchableOpacity);
        const containerStyle = StyleSheet.flatten(touchable.props.style);
        expect(containerStyle.backgroundColor).toBe(expectedBg);

        const text = getByText('Submit');
        const textStyle = StyleSheet.flatten(text.props.style);
        expect(textStyle.color).toBe(expectedText);
      });

      it('renders the same colors with opacity 0.5 when disabled', () => {
        const { UNSAFE_getByType, getByText } = render(
          <Button
            title="Submit"
            type={type}
            disabled={true}
            onPress={() => {}}
          />,
        );
        const touchable = UNSAFE_getByType(TouchableOpacity);
        const containerStyle = StyleSheet.flatten(touchable.props.style);
        expect(containerStyle.backgroundColor).toBe(expectedBg);
        expect(containerStyle.opacity).toBe(0.5);

        const text = getByText('Submit');
        const textStyle = StyleSheet.flatten(text.props.style);
        expect(textStyle.color).toBe(expectedText);
      });

      it('shows ActivityIndicator with the text color when isLoading', () => {
        const { UNSAFE_getByType, queryByText } = render(
          <Button
            title="Submit"
            type={type}
            isLoading={true}
            onPress={() => {}}
          />,
        );
        const spinner = UNSAFE_getByType(ActivityIndicator);
        expect(spinner.props.color).toBe(expectedText);
        // Title should not be rendered while loading
        expect(queryByText('Submit')).toBeNull();
      });

      it('renders an icon in the button text color tone', () => {
        const { UNSAFE_getByType } = render(
          <Button
            title="Action"
            type={type}
            icon={CaretDownIcon}
            onPress={() => {}}
          />,
        );
        const iconComponent = UNSAFE_getByType(Icon);
        expect(iconComponent.props.tone).toBe(expectedTone);
      });
    },
  );

  it('renders icon on the left by default and on the right when iconPosition="right"', () => {
    const { UNSAFE_getByType, rerender } = render(
      <Button
        title="Left Icon"
        icon={CaretDownIcon}
        iconPosition="left"
        onPress={() => {}}
      />,
    );
    let iconComponent = UNSAFE_getByType(Icon);
    expect(iconComponent.props.style.marginRight).toBe(10);

    rerender(
      <Button
        title="Right Icon"
        icon={CaretDownIcon}
        iconPosition="right"
        onPress={() => {}}
      />,
    );
    iconComponent = UNSAFE_getByType(Icon);
    expect(iconComponent.props.style.marginLeft).toBe(10);
  });
});
