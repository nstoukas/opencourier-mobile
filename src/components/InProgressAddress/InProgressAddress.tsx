import React, { useMemo } from 'react';
import {
  StyleProp,
  ViewStyle,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { styles } from './InProgressAdress.styles';
import { Order } from '@app/types/types';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { CopyIcon } from 'phosphor-react-native/src/icons/Copy';
import { PhoneOutgoingIcon } from 'phosphor-react-native/src/icons/PhoneOutgoing';

type Props = {
  style?: StyleProp<ViewStyle>;
  order: Order;
  onAddressPress: (order: Order) => void;
  onCopyAddress: (order: Order) => void;
  onCall: (order: Order) => void;
  customerOrRestaurant: 'customer' | 'restaurant';
  expanded: boolean;
};

export const InProgressAdress = ({
  style,
  order,
  onAddressPress,
  onCopyAddress,
  onCall,
  customerOrRestaurant = 'restaurant',
  expanded,
}: Props) => {
  const address = useMemo(() => {
    if (customerOrRestaurant === 'customer') {
      return (
        order.dropoffLocationFormattedAddress ??
        order.dropoffLocation?.formattedAddress ??
        'N/A'
      );
    }
    return (
      order.pickupLocationFormattedAddress ??
      order.pickupLocation?.formattedAddress ??
      'N/A'
    );
  }, [customerOrRestaurant, order]);

  return (
    <View
      style={[
        styles.containerAddressButton,
        !expanded && { height: 0 },
        expanded && { overflow: 'visible' },
        style,
      ]}>
      <Text style={styles.textAddress} onPress={() => onAddressPress(order)}>
        {address}
      </Text>
      <TouchableOpacity
        hitSlop={hitSlopFor(32, 32, 4)}
        style={styles.buttonAddress}
        onPress={() => onCopyAddress(order)}>
        <Icon icon={CopyIcon} weight="fill" size={14} />
      </TouchableOpacity>
      <TouchableOpacity
        hitSlop={hitSlopFor(32, 32, 4)}
        style={styles.buttonAddress}
        onPress={() => onCall(order)}>
        <Icon icon={PhoneOutgoingIcon} weight="fill" size={14} />
      </TouchableOpacity>
    </View>
  );
};
