import React from 'react';
import {
  StyleProp,
  ViewStyle,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { styles } from './OrganizationCell.styles';
import { Organization } from '@app/types/types';
import { Colors } from '@app/styles/colors';
import { RemoteImage } from '@app/components/RemoteImage/RemoteImage';
import { Icon } from '@app/components/Icon/Icon';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';

type Props = {
  style?: StyleProp<ViewStyle>;
  onPress: (org: Organization) => void;
  organization: Organization;
  selected: boolean;
};

export const OrganizationCell = ({
  style,
  onPress,
  organization,
  selected,
}: Props) => {
  const { imageUrl, name } = organization;
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() => onPress(organization)}>
      <View style={styles.content}>
        <View style={styles.contentLeft}>
          <RemoteImage uri={imageUrl} style={styles.imageLeft} />
          <Text
            style={[
              styles.title,
              { color: selected ? Colors.green1 : Colors.black1 },
            ]}>
            {name}
          </Text>
        </View>
        {selected && (
          <Icon icon={CheckCircleIcon} weight="fill" size={32} tone="success" />
        )}
      </View>
      <View style={styles.separator} />
    </TouchableOpacity>
  );
};
