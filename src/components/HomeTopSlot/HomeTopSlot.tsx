import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileBadge } from '@app/components/ProfileBadge/ProfileBadge';
import { ConnectionDot } from '@app/components/ConnectionDot/ConnectionDot';
import { UserStatus } from '@app/types/types';
import { ConnectionStatus } from '@app/services/liveConnection';
import { color, radius, shadow, space } from '@app/styles/theme';

type Props = {
  userStatus: UserStatus;
  connectionStatus: ConnectionStatus;
  onMenu: () => void;
  // The banners, in order (spec 0018, AC-14). Rows 78 and 36 add theirs here.
  children?: ReactNode;
  // The SOS pill, at the right end of the top row (spec 0022, AC-1).
  sosAction?: ReactNode;
};

// Spec 0018 (AC-14): the top of home, over the map. The badge opens the side
// menu and shows Online, Last call or Offline; the dot says whether the live
// connection is up. Below them sit the banners home already had.
export const HomeTopSlot = ({
  userStatus,
  connectionStatus,
  onMenu,
  children,
  sosAction,
}: Props) => {
  const { top } = useSafeAreaInsets();
  return (
    <View
      style={[styles.container, { paddingTop: top + space['2'] }]}
      testID="home-top-slot"
      pointerEvents="box-none">
      <View style={styles.row}>
        <View style={styles.badge}>
          <ProfileBadge userStatus={userStatus} onPress={onMenu} />
          <ConnectionDot status={connectionStatus} />
        </View>
        {sosAction}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space['4'],
    gap: space['2'],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    backgroundColor: color.card,
    borderRadius: radius.full,
    paddingRight: space['3'],
    ...shadow.md,
  },
});
