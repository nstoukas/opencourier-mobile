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
        {/* 'online' and 'offline' are translation keys: the rider reads
            Online or Offline, never the raw value. Last call has a short tag
            word of its own, so the Greek fits one line ("Τελευταία",
            operator, 23 Nov); buttons and dialogs keep the full words. */}
        {t(
          userStatus === UserStatus.LastCall
            ? 'translations:last_call_tag'
            : `translations:${userStatus.toLowerCase()}`,
        )}
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
  const { t } = useTranslation();
  const backgroundColor = statusColor(userStatus);

  return (
    <TouchableOpacity
      // A screen reader hears "Menu, Online": what the button opens and the
      // rider's status, which on Home is drawn outside it (review, 23 Nov).
      accessibilityRole="button"
      // The side menu can pass no status at all after logout (its value is
      // cast, row 116), so the label must not assume one: then just "Menu".
      accessibilityLabel={
        userStatus
          ? t('translations:menu_button_a11y', {
              status: t(`translations:${userStatus.toLowerCase()}`),
            })
          : t('translations:menu_button_a11y_plain')
      }
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
