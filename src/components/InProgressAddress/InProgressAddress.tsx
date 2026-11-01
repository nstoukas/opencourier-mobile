import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { ChatTextIcon } from 'phosphor-react-native/src/icons/ChatText';

type Props = {
  style?: StyleProp<ViewStyle>;
  order: Order;
  onAddressPress: (order: Order) => void;
  onCopyAddress: (order: Order) => void;
  // Left out when there is no number to call (row 33): the call button is not shown.
  onCall?: (order: Order) => void;
  // Left out when the rider cannot text this person (row 72): the message button is not shown.
  onText?: (order: Order) => void;
  customerOrRestaurant: 'customer' | 'restaurant';
  expanded: boolean;
};

export const InProgressAdress = ({
  style,
  order,
  onAddressPress,
  onCopyAddress,
  onCall,
  onText,
  customerOrRestaurant = 'restaurant',
  expanded,
}: Props) => {
  const { t } = useTranslation();
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
      {onText ? (
        <TouchableOpacity
          hitSlop={hitSlopFor(32, 32, 4)}
          style={styles.buttonAddress}
          accessibilityRole="button"
          accessibilityLabel={t('translations:text_customer')}
          onPress={() => onText(order)}>
          <Icon icon={ChatTextIcon} weight="fill" size={14} />
        </TouchableOpacity>
      ) : null}
      {onCall ? (
        <TouchableOpacity
          hitSlop={hitSlopFor(32, 32, 4)}
          style={styles.buttonAddress}
          accessibilityRole="button"
          accessibilityLabel={t(`translations:call_${customerOrRestaurant}`)}
          onPress={() => onCall(order)}>
          <Icon icon={PhoneOutgoingIcon} weight="fill" size={14} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
