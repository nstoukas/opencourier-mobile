import React, { useMemo } from 'react';
import { Colors } from '@app/styles/colors';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  View,
  Animated,
  Image,
} from 'react-native';
import { styles } from './ButtonOrder.styles';
import { Paralelogram } from '../Paralelogram/Paralelogram';
import { SCREEN_WIDTH } from '@app/utilities/constants';
import { useTranslation } from 'react-i18next';
import { Images } from '@app/utilities/images';
import { useCountdownBar } from '@app/hooks/useCountdownBar';

export enum ButtonOrderType {
  accept = 'accept',
  decline = 'decline',
  acceptNow = 'accept_now',
  declineNow = 'decline_now',
}

const PARALELOGRAM_WIDTH = 16;
const PARALELOGRAM_HEIGHT = 8;

const PROGRESS_BAR_WIDTH = SCREEN_WIDTH - 54;

type Props = {
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  type?: ButtonOrderType;
  // Time left before the offer's deadline; null when it has no deadline.
  millisRemaining?: number | null;
  // The whole countdown length, for the bar.
  totalMillis?: number | null;
  autoAcceptOrders: boolean;
  onPress: () => void;
};

export const ButtonOrder = ({
  disabled,
  style,
  textStyle,
  type = ButtonOrderType.accept,
  onPress,
  millisRemaining = null,
  totalMillis = null,
  autoAcceptOrders = false,
}: Props) => {
  const { t } = useTranslation();
  const widthAnimation = useCountdownBar(
    millisRemaining ?? 0,
    totalMillis ?? 0,
    PROGRESS_BAR_WIDTH,
  );
  const numberOfParalelograms = Math.floor(SCREEN_WIDTH / PARALELOGRAM_WIDTH);

  const backgroundColor = useMemo(() => {
    switch (type) {
      case ButtonOrderType.accept:
        return Colors.green1;
      case ButtonOrderType.decline:
        return Colors.gray8;
      case ButtonOrderType.acceptNow:
      case ButtonOrderType.declineNow:
        return Colors.black1;
    }
  }, [type]);

  const textColor = useMemo(() => {
    switch (type) {
      case ButtonOrderType.accept:
        return Colors.white3;
      case ButtonOrderType.decline:
        return Colors.black7;
      case ButtonOrderType.acceptNow:
      case ButtonOrderType.declineNow:
        return Colors.white3;
    }
  }, [type]);

  const paralelogramColor = (index: number) => {
    const even = index % 2 === 0;
    switch (type) {
      case ButtonOrderType.accept:
        return even ? Colors.green1 : Colors.green4;
      case ButtonOrderType.decline:
        return even ? Colors.red1 : Colors.red3;
      default:
        return Colors.green1;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.container,
        style,
        {
          backgroundColor: backgroundColor,
        },
        (type === ButtonOrderType.accept ||
          type === ButtonOrderType.decline) && { height: 100 },
      ]}>
      {(type === ButtonOrderType.accept ||
        type === ButtonOrderType.decline) && (
        <Image
          source={
            type === ButtonOrderType.accept
              ? Images.CheckHollow
              : Images.XHollow
          }
        />
      )}
      <Text style={[styles.textTitle, textStyle, { color: textColor }]}>
        {t(`translations:${type}`)}
      </Text>
      {type === ButtonOrderType.accept &&
        autoAcceptOrders &&
        millisRemaining !== null && (
          <View
            style={[styles.containerLoader, { height: PARALELOGRAM_HEIGHT }]}>
            {[...Array(numberOfParalelograms).keys()]
              .map(i => i)
              .map(index => {
                return (
                  <Paralelogram
                    backgroundColor={paralelogramColor(index)}
                    width={PARALELOGRAM_WIDTH}
                    height={PARALELOGRAM_HEIGHT}
                  />
                );
              })}
            <Animated.View
              style={[styles.progress, { width: widthAnimation }]}
            />
          </View>
        )}
    </TouchableOpacity>
  );
};
