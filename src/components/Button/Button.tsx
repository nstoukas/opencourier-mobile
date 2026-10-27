import React from 'react';
import { color, ColorName } from '@app/styles/theme';
// `import type`: TypeScript types only, removed when the app is built.
import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native';
import { Icon } from '@app/components/Icon/Icon';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
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
  // A token name, so the icon (which takes token names) and the text share it.
  text: ColorName;
  border: string;
  borderWidth: number;
};

// Each type's fill, text (and icon and spinner) color and border, from the tokens (spec 0007).
// `Record<ButtonType, ...>` makes TypeScript insist on an entry for every type.
const BUTTON_LOOKS: Record<ButtonType, ButtonLook> = {
  [ButtonType.black]: {
    background: color.primary,
    text: 'primary-foreground',
    border: color.input,
    borderWidth: 0,
  },
  [ButtonType.green]: {
    background: color.success,
    text: 'success-foreground',
    border: color.input,
    borderWidth: 0,
  },
  [ButtonType.red]: {
    background: color.destructive,
    text: 'destructive-foreground',
    border: color.input,
    borderWidth: 0,
  },
  [ButtonType.yellow]: {
    background: color.warning,
    text: 'warning-foreground',
    border: color.warning,
    borderWidth: 2,
  },
  [ButtonType.white]: {
    background: color.background,
    text: 'foreground',
    border: color.input,
    borderWidth: 2,
  },
  [ButtonType.gray]: {
    background: color.secondary,
    text: 'secondary-foreground',
    border: color.input,
    borderWidth: 0,
  },
  [ButtonType.grayBGBlackText]: {
    background: color.secondary,
    text: 'secondary-foreground',
    border: color.secondary,
    borderWidth: 0,
  },
  [ButtonType.grayBGRedText]: {
    background: color.secondary,
    text: 'destructive',
    border: color['destructive-soft'],
    borderWidth: 2,
  },
  [ButtonType.redBGRedText]: {
    background: color['destructive-soft'],
    text: 'destructive',
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
  // A Phosphor icon drawn in the button's text color, e.g. icon={CheckCircleIcon} iconWeight="fill".
  icon?: PhosphorIcon;
  iconWeight?: IconWeight;
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
  iconWeight = 'regular',
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
      {isLoading && <ActivityIndicator color={color[look.text]} />}
      {!isLoading && icon && iconPosition === 'left' && (
        <Icon
          icon={icon}
          weight={iconWeight}
          size={20}
          tone={look.text}
          style={styles.iconLeft}
        />
      )}
      {!isLoading && (
        <Text
          style={[styles.textTitle, { color: color[look.text] }, textStyle]}>
          {title}
        </Text>
      )}
      {!isLoading && icon && iconPosition === 'right' && (
        <Icon
          icon={icon}
          weight={iconWeight}
          size={20}
          tone={look.text}
          style={styles.iconRight}
        />
      )}
    </TouchableOpacity>
  );
};
