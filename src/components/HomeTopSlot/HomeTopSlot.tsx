import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ProfileBadge,
  StatusWord,
} from '@app/components/ProfileBadge/ProfileBadge';
import { ConnectionDot } from '@app/components/ConnectionDot/ConnectionDot';
import { UserStatus } from '@app/types/types';
import { ConnectionStatus } from '@app/services/liveConnection';
import { color, control, radius, shadow, space } from '@app/styles/theme';

// The white frame's width: 4 padding, the 40 avatar, a 4 gap, the 24 dot
// box and 8 padding.
const BADGE_WIDTH = 80;

type Props = {
  userStatus: UserStatus;
  connectionStatus: ConnectionStatus;
  onMenu: () => void;
  // The banners, in order (spec 0018, AC-14). Rows 78 and 36 add theirs here.
  children?: ReactNode;
  // The SOS button, at the right end of the top row (spec 0022, AC-1).
  sosAction?: ReactNode;
  // Shown in the top row between the badge and SOS: the shift's hours and pay
  // (spec 0040, AC-10). Centred in the room left between them.
  middle?: ReactNode;
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
  middle,
}: Props) => {
  const { top } = useSafeAreaInsets();
  return (
    <View
      style={[styles.container, { paddingTop: top + space['2'] }]}
      testID="home-top-slot"
      pointerEvents="box-none">
      <View style={styles.row}>
        {/* The white frame holds the avatar and the connection dot; the status
            word hangs centred under the frame, its top touching the frame's
            bottom edge (operator, 23 Nov). */}
        <View style={styles.badgeColumn}>
          <View style={styles.badge}>
            <ProfileBadge
              userStatus={userStatus}
              onPress={onMenu}
              hideStatusWord
            />
            <ConnectionDot status={connectionStatus} />
          </View>
          {/* Tapping the word opens the menu too, as it did when it sat on
              the avatar. Hidden from screen readers, words and all (the avatar
              button already says "Menu, Online"). */}
          <Pressable
            style={styles.statusUnder}
            onPress={onMenu}
            accessible={false}
            importantForAccessibility="no-hide-descendants">
            <StatusWord userStatus={userStatus} />
          </Pressable>
        </View>
        <View style={styles.middle} pointerEvents="box-none">
          {middle}
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
  // flex-start: the frame, the hours pill and SOS line up along the top, and
  // the status word under the frame adds height below them.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space['2'],
  },
  // A fixed width, the frame's own: a long word under it then wraps instead of
  // widening the column and pushing the frame to the right.
  badgeColumn: {
    width: BADGE_WIDTH,
  },
  // Up to 14 px past each side of the frame, so a long word (Greek "Τελευταία
  // παραγγελία") wraps to a second line instead of leaving the screen.
  statusUnder: {
    alignSelf: 'stretch',
    marginHorizontal: -14,
    alignItems: 'center',
  },
  // The avatar, then the dot centred in the rest of the pill.
  // As tall as SOS (48), with the avatar 4 px in from the edge.
  badge: {
    height: control.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
    backgroundColor: color.card,
    borderRadius: radius.full,
    paddingLeft: space['1'],
    paddingRight: space['2'],
    ...shadow.md,
  },
  // `minWidth: 0` lets this shrink below its text's width, so a long line
  // gets smaller instead of pushing SOS off the screen.
  middle: {
    flex: 1,
    minWidth: 0,
    height: control.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
