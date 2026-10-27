import React from 'react';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { styles } from './OrderDelivered.styles';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { XIcon } from 'phosphor-react-native/src/icons/X';

type Props = {
  style?: StyleProp<ViewStyle>;
  onClose: () => void;
};

export const OrderDelivered = ({ style, onClose }: Props) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <View style={styles.containerLoader}>
          <Icon icon={CheckIcon} weight="bold" size={13} tone="success" />
        </View>
        <Text style={styles.text}>Order delivered. Thanks!</Text>
      </View>
      <TouchableOpacity
        hitSlop={hitSlopFor(40)}
        style={styles.buttonClose}
        onPress={onClose}>
        <Icon icon={XIcon} size={10} />
      </TouchableOpacity>
    </View>
  );
};
