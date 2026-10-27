import React from 'react';
import { Image, StyleProp, ViewStyle, TouchableOpacity } from 'react-native';
import { Images } from '@app/utilities/images';
import { styles } from './BackNavButton.styles';
import { hitSlopFor } from '@app/utilities/touch';

export enum BackButtonType {
  white,
  black,
}

type Props = {
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  type?: BackButtonType;
};

export const BackNavButton = ({
  style,
  onPress,
  type = BackButtonType.white,
}: Props) => {
  return (
    <TouchableOpacity
      hitSlop={hitSlopFor(40)}
      style={[
        type === BackButtonType.white
          ? styles.containerWhite
          : styles.containerBlack,
        style,
      ]}
      onPress={onPress}>
      <Image
        source={Images.ArrowLeft}
        style={
          type === BackButtonType.white ? styles.iconBlack : styles.iconWhite
        }
      />
    </TouchableOpacity>
  );
};
