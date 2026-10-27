import React from 'react';
import {
  Image,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';
import { Images } from '@app/utilities/images';
import { styles } from './Cashout.styles';
import { hitSlopFor } from '@app/utilities/touch';

type Props = {
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
};

export const Cashout = ({ style, onPress }: Props) => {
  return (
    <TouchableOpacity
      hitSlop={hitSlopFor(40)}
      style={[styles.container, style]}
      onPress={onPress}>
      <View style={styles.containerImage}>
        <Image source={Images.Bank} />
      </View>
      <View style={styles.containerStatus}>
        <Text style={styles.textStatus} numberOfLines={1}>
          Cash out
        </Text>
      </View>
    </TouchableOpacity>
  );
};
