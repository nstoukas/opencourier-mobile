import React from 'react';
import {
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';
import { styles } from './Cashout.styles';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { BankIcon } from 'phosphor-react-native/src/icons/Bank';

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
        <Icon icon={BankIcon} weight="fill" size={30} />
      </View>
      <View style={styles.containerStatus}>
        <Text style={styles.textStatus} numberOfLines={1}>
          Cash out
        </Text>
      </View>
    </TouchableOpacity>
  );
};
