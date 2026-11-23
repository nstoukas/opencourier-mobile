import React from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { SirenIcon } from 'phosphor-react-native/src/icons/Siren';
import { Icon } from '@app/components/Icon/Icon';
import { useHoldTimer } from '@app/hooks/useHoldTimer';
import { color, control, radius, shadow } from '@app/styles/theme';

// How long the rider holds before the SOS starts (spec 0022, AC-2): long
// enough to be deliberate, so a brush in a pocket never calls 112.
export const SOS_HOLD_MS = 3000;

// A round button, the size a rider's thumb needs (spec 0007: 48 px), with the
// siren only: the word SOS is read out by a screen reader (operator, 23 Nov).
const WIDTH = control.xl;
const HEIGHT = control.xl;
const STROKE = 3;
// The ring runs just inside the button's edge: a rounded rectangle whose
// corners are half its height, which for a square is a circle.
const RING_WIDTH = WIDTH - STROKE;
const RING_HEIGHT = HEIGHT - STROKE;
const RING_RADIUS = RING_HEIGHT / 2;
const RING_LENGTH =
  2 * (RING_WIDTH - 2 * RING_RADIUS) + 2 * Math.PI * RING_RADIUS;

// `createAnimatedComponent` lets an Animated value drive an SVG attribute.
const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Props = {
  // Called once, when a hold reaches 3 s. Never on a shorter press.
  onHeld: () => void;
};

// Spec 0022 (AC-1, AC-2): the red SOS button in Home's top slot. Pressing it
// starts a ring filling around its edge; letting go before the ring is full
// does nothing at all (no call, no request, no record) and the ring empties.
export const SosHoldButton = ({ onHeld }: Props) => {
  const { t } = useTranslation();
  // The hold itself (row 136, shared with the offer buttons): the timer, not the animation,
  // decides (it is what the 3 s rule means), `progress` fills the ring, a release before 3 s does
  // nothing at all, and leaving Home mid hold never starts an SOS.
  const { progress, begin, release } = useHoldTimer(SOS_HOLD_MS, onHeld);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_LENGTH, 0],
  });

  return (
    <Pressable
      onPressIn={begin}
      // Released before 3 s: nothing happens.
      onPressOut={release}
      accessibilityRole="button"
      accessibilityLabel={t('translations:sos_button')}
      accessibilityHint={t('translations:sos_button_hint')}
      testID="sos-hold-button"
      style={styles.button}>
      <Svg width={WIDTH} height={HEIGHT} style={StyleSheet.absoluteFill}>
        <AnimatedRect
          x={STROKE / 2}
          y={STROKE / 2}
          width={RING_WIDTH}
          height={RING_HEIGHT}
          rx={RING_RADIUS}
          ry={RING_RADIUS}
          fill="none"
          stroke={color['destructive-foreground']}
          strokeWidth={STROKE}
          strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      <View style={styles.content} pointerEvents="none">
        <Icon
          icon={SirenIcon}
          size={24}
          tone="destructive-foreground"
          weight="fill"
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: radius.full,
    backgroundColor: color.destructive,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.md,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
