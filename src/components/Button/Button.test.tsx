import React from 'react';
import { StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { Button, ButtonType } from './Button';
import { color, control } from '@app/styles/theme';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { Icon } from '@app/components/Icon/Icon';

describe('AC-5, AC-6, AC-7: Button component', () => {
  it('renders container with minHeight 48 (control.xl), side padding, and 2-line centred title without fixed height (Clause 5)', () => {
    const { UNSAFE_getByType, getByText } = render(
      <Button title="Test long label that wraps" onPress={() => {}} />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const flatStyle = StyleSheet.flatten(touchable.props.style);
    expect(flatStyle.minHeight).toBe(control.xl);
    expect(flatStyle.minHeight).toBe(48);
    expect(flatStyle.height).toBeUndefined();
    expect(flatStyle.paddingHorizontal).toBeDefined();

    const titleText = getByText('Test long label that wraps');
    const textStyle = StyleSheet.flatten(titleText.props.style);
    expect(titleText.props.numberOfLines).toBe(2);
    expect(textStyle.flexShrink).toBe(1);
    expect(textStyle.textAlign).toBe('center');
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

  // Row 138 review: a screen reader says "button" for every Button in the app, and names it
  // by its title unless the screen gives it a fuller name.
  describe('for a screen reader (row 138)', () => {
    it.each([
      ButtonType.black,
      ButtonType.green,
      ButtonType.red,
      ButtonType.yellow,
      ButtonType.white,
    ])('type %s is a button, named by its title', type => {
      const view = render(
        <Button title="Send it" type={type} onPress={() => {}} />,
      );
      const touchable = view.UNSAFE_getByType(TouchableOpacity);
      expect(touchable.props.accessibilityRole).toBe('button');
      // No name of its own: the title is what is read.
      expect(touchable.props.accessibilityLabel).toBeUndefined();
      expect(view.getByRole('button', { name: 'Send it' })).toBeTruthy();
      expect(view.getAllByRole('button')).toHaveLength(1);
    });

    it('with no type given it is a button too', () => {
      const view = render(<Button title="Plain" onPress={() => {}} />);
      expect(
        view.UNSAFE_getByType(TouchableOpacity).props.accessibilityRole,
      ).toBe('button');
    });

    it('stays a button while disabled, while loading and with an icon', () => {
      const disabled = render(
        <Button title="Wait" disabled onPress={() => {}} />,
      );
      expect(
        disabled.UNSAFE_getByType(TouchableOpacity).props.accessibilityRole,
      ).toBe('button');
      expect(disabled.getByRole('button', { name: 'Wait' })).toBeTruthy();
      disabled.unmount();

      const loading = render(
        <Button title="Wait" isLoading onPress={() => {}} />,
      );
      expect(
        loading.UNSAFE_getByType(TouchableOpacity).props.accessibilityRole,
      ).toBe('button');
      loading.unmount();

      const withIcon = render(
        <Button title="Open" icon={CaretDownIcon} onPress={() => {}} />,
      );
      expect(withIcon.getByRole('button', { name: 'Open' })).toBeTruthy();
    });

    it('takes a fuller name, read instead of the title, and still shows the title', () => {
      const onPress = jest.fn();
      const view = render(
        <Button
          title="Chat"
          accessibilityLabel="Chat, New message"
          onPress={onPress}
        />,
      );
      const touchable = view.UNSAFE_getByType(TouchableOpacity);
      expect(touchable.props.accessibilityRole).toBe('button');
      expect(touchable.props.accessibilityLabel).toBe('Chat, New message');
      expect(view.getByText('Chat')).toBeTruthy();

      // The named thing is the pressable itself.
      fireEvent.press(view.getByLabelText('Chat, New message'));
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(
        view.getByRole('button', { name: 'Chat, New message' }),
      ).toBeTruthy();
    });

    it('a loading button with a fuller name keeps it, though its title is not drawn', () => {
      const view = render(
        <Button
          title="Move pin"
          accessibilityLabel="Moving the pin"
          isLoading
          onPress={() => {}}
        />,
      );
      expect(view.queryByText('Move pin')).toBeNull();
      expect(view.getByLabelText('Moving the pin')).toBeTruthy();
    });
  });
});
