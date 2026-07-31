import React from 'react';
import {
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';
import { styles } from './UserStatusSelector.styles';
import { UserStatus } from '@app/types/types';
import { Colors } from '@app/styles/colors';
import { useTranslation } from 'react-i18next';

type Props = {
  style?: StyleProp<ViewStyle>;
  onPress: (status: UserStatus) => void;
  selected: UserStatus;
};

const data = [UserStatus.Online, UserStatus.LastCall, UserStatus.Offline];

// These were useMemo'd inside a nested component. Three-case switches cost less to run than
// the hook that memoises them, and a plain function has no dependency array to get wrong.
export const statusButtonStyle = (status: UserStatus) => {
  switch (status) {
    case UserStatus.Online:
      return styles.containerLeft;
    case UserStatus.LastCall:
      return styles.containerMiddle;
    case UserStatus.Offline:
      return styles.containerRight;
  }
};

export const statusButtonColor = (
  status: UserStatus,
  selected: UserStatus,
): string => {
  switch (status) {
    case UserStatus.Online:
      return selected === status ? Colors.green1 : Colors.transparent;
    case UserStatus.LastCall:
      return selected === status ? Colors.yellow1 : Colors.transparent;
    case UserStatus.Offline:
      return selected === status ? Colors.red1 : Colors.transparent;
  }
};

export const statusTextColor = (
  status: UserStatus,
  selected: UserStatus,
): string => {
  switch (status) {
    case UserStatus.Online:
      return selected === status ? Colors.white : Colors.gray3;
    case UserStatus.LastCall:
      return selected === status ? Colors.black1 : Colors.gray3;
    case UserStatus.Offline:
      return selected === status ? Colors.white : Colors.gray3;
  }
};

type StatusItemProps = {
  status: UserStatus;
  selected: UserStatus;
  onPress: (status: UserStatus) => void;
};

// Module scope for the same reason as HomeTabs' TabItem: a component declared inside another
// component is remounted, not updated, on every parent render.
const StatusItem = ({ status, selected, onPress }: StatusItemProps) => {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={() => onPress(status)}>
      <View
        style={[
          statusButtonStyle(status),
          { backgroundColor: statusButtonColor(status, selected) },
        ]}>
        <Text
          style={[styles.text, { color: statusTextColor(status, selected) }]}>
          {t(`translations:${status.toLowerCase()}`)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export const UserStatusSelector = ({ style, onPress, selected }: Props) => {
  return (
    <View style={[styles.container, style]}>
      {data.map(item => {
        // Same rule as HomeTabs: the key belongs on the element .map() returns.
        return (
          <StatusItem
            key={item}
            status={item}
            selected={selected}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
};
