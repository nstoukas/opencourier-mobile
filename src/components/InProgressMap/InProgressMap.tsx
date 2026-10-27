import React from 'react';
import { StyleProp, ViewStyle, View, Text } from 'react-native';
import { styles } from './InProgressMap.styles';
import Map from '../Map/Map';
import { useTranslation } from 'react-i18next';
import { Order, User } from '@app/types/types';
import { formatDistance } from '@app/utilities/geo';
import { secondsToMinutes } from '@app/utilities/dates';
import { Icon } from '@app/components/Icon/Icon';
import { ClockAfternoonIcon } from 'phosphor-react-native/src/icons/ClockAfternoon';
import { PathIcon } from 'phosphor-react-native/src/icons/Path';

type Props = {
  style?: StyleProp<ViewStyle>;
  user: User;
  distance: number;
  duration: number;
  order: Order;
};

export const InProgressMap = ({
  style,
  user,
  distance,
  duration,
  order,
}: Props) => {
  const { t } = useTranslation();
  return (
    <View style={[styles.containerMap, style]}>
      <Map order={order} user={user} />
      <View style={styles.containerAway}>
        <View style={styles.containerTextAway}>
          <Icon icon={PathIcon} size={26} tone="muted-foreground" />
          <Text
            style={styles.textDistance}
            numberOfLines={2}>{`${formatDistance(distance)} ${t(
            'translations:away',
          )}`}</Text>
        </View>
        <View style={styles.containerTextAway}>
          <Icon
            icon={ClockAfternoonIcon}
            weight="fill"
            size={26}
            tone="muted-foreground"
          />
          <Text
            style={styles.textDistance}
            numberOfLines={2}>{`${secondsToMinutes(duration)} min ${t(
            'translations:away',
          )}`}</Text>
        </View>
      </View>
    </View>
  );
};
