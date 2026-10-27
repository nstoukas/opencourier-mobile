import React from 'react';
import {
  Image,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { styles } from './OrderDelivered.styles';
import { Images } from '@app/utilities/images';
import { hitSlopFor } from '@app/utilities/touch';

type Props = {
  style?: StyleProp<ViewStyle>;
  onClose: () => void;
};

export const OrderDelivered = ({ style, onClose }: Props) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <View style={styles.containerLoader}>
          <Image source={Images.Checkmark} style={styles.checkmark} />
        </View>
        <Text style={styles.text}>Order delivered. Thanks!</Text>
      </View>
      <TouchableOpacity
        hitSlop={hitSlopFor(40)}
        style={styles.buttonClose}
        onPress={onClose}>
        <Image source={Images.X} />
      </TouchableOpacity>
    </View>
  );
};
