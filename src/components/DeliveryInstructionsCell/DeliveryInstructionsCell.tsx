import React, { useMemo } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { styles } from './DeliveryInstructionsCell.styles';
import { DeliveryType } from '@app/types/types';
import { Icon } from '@app/components/Icon/Icon';
import { BuildingsIcon } from 'phosphor-react-native/src/icons/Buildings';
import { DoorIcon } from 'phosphor-react-native/src/icons/Door';
import { HandWavingIcon } from 'phosphor-react-native/src/icons/HandWaving';
import { ParkIcon } from 'phosphor-react-native/src/icons/Park';
import { PhoneCallIcon } from 'phosphor-react-native/src/icons/PhoneCall';

type Props = {
  style?: StyleProp<ViewStyle>;
  type: DeliveryType | string;
};

export const DeliveryInstructionsCell = ({ style, type }: Props) => {
  const icon = useMemo(() => {
    switch (type) {
      case DeliveryType.CallOnArrival:
        return PhoneCallIcon;
      case DeliveryType.LeaveAtDoor:
        return DoorIcon;
      case DeliveryType.MeetAtDoor:
        return HandWavingIcon;
      case DeliveryType.MeetInside:
        return BuildingsIcon;
      case DeliveryType.MeetOutside:
        return ParkIcon;
      default:
        return undefined;
    }
  }, [type]);

  return (
    <View style={[styles.container, style]}>
      {icon && <Icon icon={icon} weight="fill" size={16} />}
      <Text style={styles.text}>{type}</Text>
    </View>
  );
};
