import React, { useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  Vibration,
  ViewStyle,
} from 'react-native';
// `import type`: a TypeScript type only, removed when the app is built.
import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { Icon } from '@app/components/Icon/Icon';
import { useHoldTimer } from '@app/hooks/useHoldTimer';
import { color, radius, space, typeScale, withAlpha } from '@app/styles/theme';

// How long the one buzz lasts when a hold completes, in milliseconds.
const BUZZ_MS = 40;

type Props = {
  // How long the rider must keep pressing before `onHeld` runs.
  holdMs: number;
  // Called once, when a hold reaches `holdMs`. Never on a shorter press.
  onHeld: () => void;
  // The glyph drawn white in the centre: a tick, an X.
  icon: PhosphorIcon;
  // A short word under the glyph ("Accept", "Decline"), so a new rider knows
  // what the button does before pressing it (operator, 23 Nov).
  label: string;
  // The button's colour, a design system name (spec 0007): success or destructive.
  tone: 'success' | 'destructive';
  // What a screen reader says the button is, and how to use it.
  accessibilityLabel: string;
  accessibilityHint: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// A coloured button that answers only to a hold (row 135, operator 23 Nov).
// Pressing it starts a lighter fill sweeping from left to right; letting go
// before the fill is full does nothing and the fill empties. When the hold
// completes, the phone buzzes once and `onHeld` runs. Same idea as the SOS
// button (spec 0022): the timer decides, the fill only shows progress.
export const HoldButton = ({
  holdMs,
  onHeld,
  icon,
  label,
  tone,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: Props) => {
  // The button's drawn width, so the fill can grow to exactly that.
  const [width, setWidth] = useState(0);

  const fire = () => {
    Vibration.vibrate(BUZZ_MS);
    onHeld();
  };
  // The hold itself (row 136): the timer decides, `progress` drives the fill, a release before the
  // time does nothing, and leaving the screen mid hold never fires. After a hold the fill is empty
  // again, so an answer the server refuses leaves the button ready for another try.
  const { progress, begin, release } = useHoldTimer(holdMs, fire);

  // White (the tone's own foreground), so the tick and X stay white too.
  const foreground =
    tone === 'success' ? 'success-foreground' : 'destructive-foreground';

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
  });

  return (
    <Pressable
      onPressIn={begin}
      // Released before the hold time: nothing happens.
      onPressOut={release}
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width)
      }
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // A screen reader's double tap is already a deliberate choice, and it
      // cannot hold: its "activate" answers at once, so the offer can still
      // be answered with TalkBack or VoiceOver.
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'activate') {
          fire();
        }
      }}
      testID={testID}
      style={[styles.button, { backgroundColor: color[tone] }, style]}>
      <Animated.View
        pointerEvents="none"
        testID={testID ? `${testID}-fill` : undefined}
        style={[
          styles.fill,
          {
            width: fillWidth,
            backgroundColor: withAlpha(color[foreground], 0.3),
          },
        ]}
      />
      <Icon icon={icon} size={32} weight="bold" tone={foreground} />
      <Text
        style={[styles.label, { color: color[foreground] }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    // Keeps the fill inside the rounded corners.
    overflow: 'hidden',
  },
  label: {
    ...typeScale['button-lg'],
    marginTop: space['1'],
    paddingHorizontal: space['2'],
  },
  // The lighter sweep over the button's colour.
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
});
