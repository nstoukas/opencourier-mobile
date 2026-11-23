import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Vibration,
  ViewStyle,
} from 'react-native';
// `import type`: a TypeScript type only, removed when the app is built.
import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { Icon } from '@app/components/Icon/Icon';
import { color, radius, withAlpha } from '@app/styles/theme';

// How long the one buzz lasts when a hold completes, in milliseconds.
const BUZZ_MS = 40;

type Props = {
  // How long the rider must keep pressing before `onHeld` runs.
  holdMs: number;
  // Called once, when a hold reaches `holdMs`. Never on a shorter press.
  onHeld: () => void;
  // The glyph drawn white in the centre: a tick, an X.
  icon: PhosphorIcon;
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
  tone,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: Props) => {
  // 0 to 1: how far the fill has swept. `useRef` keeps one value across redraws.
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The button's drawn width, so the fill can grow to exactly that.
  const [width, setWidth] = useState(0);

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const fire = () => {
    Vibration.vibrate(BUZZ_MS);
    onHeld();
  };

  const begin = () => {
    cancel();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: holdMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    timer.current = setTimeout(() => {
      timer.current = null;
      // Empty again at once, so an answer the server refuses leaves the
      // button ready for another try.
      progress.setValue(0);
      fire();
    }, holdMs);
  };

  // Never fire after the button is gone (the offer left the screen mid hold).
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

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
      onPressOut={() => {
        // Released before the hold time: nothing happens.
        if (timer.current) {
          cancel();
        }
      }}
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
      <Icon icon={icon} size={40} weight="bold" tone={foreground} />
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
  // The lighter sweep over the button's colour.
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
});
