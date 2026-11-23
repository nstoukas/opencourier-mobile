import { useTranslation } from 'react-i18next';
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
import { styles } from './ProfileBadge.styles';
import { UserStatus } from '@app/types/types';
import { Colors } from '@app/styles/colors';
import { color } from '@app/styles/theme';
import { hitSlopFor } from '@app/utilities/touch';

type Props = {
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  userStatus: UserStatus;
  discreteStatusIndicator?: boolean;
  // True when the screen draws the status word itself (Home centres it under
  // the badge's frame, operator 23 Nov); the avatar then shows no word.
  hideStatusWord?: boolean;
};

// The status colour: green Online, yellow Last call, red Offline.
const statusColor = (userStatus: UserStatus) => {
  switch (userStatus) {
    case UserStatus.Online:
      return Colors.green1;
    case UserStatus.Offline:
      return Colors.red1;
    case UserStatus.LastCall:
      return Colors.yellow1;
  }
};

// The word's colour on that tag: white on green and red, ink on the pale
// yellow, which white is unreadable on (design system: warning takes ink text).
const statusTextColor = (userStatus: UserStatus) =>
  userStatus === UserStatus.LastCall
    ? color['warning-foreground']
    : Colors.white;

// The status word on its coloured tag: Online, Last call or Offline.
// Up to two lines, centred, so a long Greek word wraps instead of being cut.
export const StatusWord = ({
  userStatus,
  style,
}: {
  userStatus: UserStatus;
  style?: StyleProp<ViewStyle>;
}) => {
  const { t } = useTranslation();
  return (
    <View
      style={[
        styles.containerStatus,
        { backgroundColor: statusColor(userStatus) },
        style,
      ]}
      testID="status-word">
      <Text
        style={[styles.textStatus, { color: statusTextColor(userStatus) }]}
        numberOfLines={2}>
        {/* 'online', 'offline' and 'last_call' are translation keys: the
            rider reads Online, Offline or Last Call, never the raw value. */}
        {t(`translations:${userStatus.toLowerCase()}`)}
      </Text>
    </View>
  );
};

export const ProfileBadge = ({
  style,
  onPress,
  userStatus,
  discreteStatusIndicator,
  hideStatusWord,
}: Props) => {
  const backgroundColor = statusColor(userStatus);

  return (
    <TouchableOpacity
      hitSlop={hitSlopFor(40)}
      style={[styles.container, style]}
      onPress={onPress}
      disabled={discreteStatusIndicator}>
      <View style={styles.containerImage}>
        <Image source={Images.Avatar} />
      </View>
      {discreteStatusIndicator && (
        <View
          style={[
            styles.statusIndicatorSmall,
            { backgroundColor: backgroundColor },
          ]}
        />
      )}
      {!discreteStatusIndicator && !hideStatusWord && (
        // pointerEvents "none": the row is wider than the avatar and only shows
        // the word; a tap goes to whatever is under it, as before.
        <View style={styles.statusRow} pointerEvents="none">
          <StatusWord userStatus={userStatus} />
        </View>
      )}
    </TouchableOpacity>
  );
};
