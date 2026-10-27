import React from 'react';
import { color } from '@app/styles/theme';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  ImageSourcePropType,
  Image,
  ActivityIndicator,
} from 'react-native';
import { styles } from './Button.styles';

export enum ButtonType {
  red,
  green,
  black,
  white,
  yellow,
  gray,
  grayBGBlackText,
  grayBGRedText,
  redBGRedText,
}

type ButtonLook = {
  background: string;
  text: string;
  border: string;
  borderWidth: number;
};

// Each type's fill, text (and icon and spinner) color and border, from the tokens (spec 0007).
// `Record<ButtonType, ...>` makes TypeScript insist on an entry for every type.
const BUTTON_LOOKS: Record<ButtonType, ButtonLook> = {
  [ButtonType.black]: {
    background: color.primary,
    text: color['primary-foreground'],
    border: color.input,
    borderWidth: 0,
  },
  [ButtonType.green]: {
    background: color.success,
    text: color['success-foreground'],
    border: color.input,
    borderWidth: 0,
  },
  [ButtonType.red]: {
    background: color.destructive,
    text: color['destructive-foreground'],
    border: color.input,
    borderWidth: 0,
  },
  [ButtonType.yellow]: {
    background: color.warning,
    text: color['warning-foreground'],
    border: color.warning,
    borderWidth: 2,
  },
  [ButtonType.white]: {
    background: color.background,
    text: color.foreground,
    border: color.input,
    borderWidth: 2,
  },
  [ButtonType.gray]: {
    background: color.secondary,
    text: color['secondary-foreground'],
    border: color.input,
    borderWidth: 0,
  },
  [ButtonType.grayBGBlackText]: {
    background: color.secondary,
    text: color['secondary-foreground'],
    border: color.secondary,
    borderWidth: 0,
  },
  [ButtonType.grayBGRedText]: {
    background: color.secondary,
    text: color.destructive,
    border: color['destructive-soft'],
    borderWidth: 2,
  },
  [ButtonType.redBGRedText]: {
    background: color['destructive-soft'],
    text: color.destructive,
    border: color.destructive,
    borderWidth: 0,
  },
};

type Props = {
  title: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  type?: ButtonType;
  onPress: () => void;
  icon?: ImageSourcePropType;
  isLoading?: boolean;
  iconPosition?: 'left' | 'right';
};

export const Button = ({
  title,
  disabled,
  style,
  textStyle,
  type = ButtonType.black,
  onPress,
  icon,
  isLoading,
  iconPosition = 'left',
}: Props) => {
  // The type's colors from the design system tokens (spec 0007, the button table). A disabled button
  // keeps them and fades to 50 % instead of turning gray.
  const look = BUTTON_LOOKS[type];

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.container,
        {
          backgroundColor: look.background,
          borderWidth: look.borderWidth,
          borderColor: look.border,
        },
        disabled && styles.disabled,
        style,
      ]}>
      {/* The spinner takes the button's text color, so it shows on every type. */}
      {isLoading && <ActivityIndicator color={look.text} />}
      {!isLoading && icon && iconPosition === 'left' && (
        <Image
          source={icon}
          style={[styles.icon, { tintColor: look.text, marginRight: 10 }]}
        />
      )}
      {!isLoading && (
        <Text style={[styles.textTitle, { color: look.text }, textStyle]}>
          {title}
        </Text>
      )}
      {!isLoading && icon && iconPosition === 'right' && (
        <Image
          source={icon}
          style={[styles.icon, { tintColor: look.text, marginLeft: 10 }]}
        />
      )}
    </TouchableOpacity>
  );
};
