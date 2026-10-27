import React from 'react';
import { StyleProp, ViewStyle, TouchableOpacity } from 'react-native';
import { styles } from './BackNavButton.styles';
import { Icon } from '@app/components/Icon/Icon';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
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
      <Icon
        icon={ArrowLeftIcon}
        size={20}
        tone={type === BackButtonType.white ? 'foreground' : 'background'}
      />
    </TouchableOpacity>
  );
};
