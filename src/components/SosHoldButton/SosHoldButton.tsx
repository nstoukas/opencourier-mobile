import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { SirenIcon } from 'phosphor-react-native/src/icons/Siren';
import { Icon } from '@app/components/Icon/Icon';
import {
  color,
  control,
  radius,
  shadow,
  space,
  typeScale,
} from '@app/styles/theme';

// How long the rider holds before the SOS starts (spec 0022, AC-2): long
// enough to be deliberate, so a brush in a pocket never calls 112.
export const SOS_HOLD_MS = 3000;

const WIDTH = 88;
const HEIGHT = control.lg;
const STROKE = 3;
// The ring runs just inside the pill's edge: a rounded rectangle whose
// corners are half its height, so it follows the pill's shape.
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

// Spec 0022 (AC-1, AC-2): the red SOS pill in Home's top slot. Pressing it
// starts a ring filling around its edge; letting go before the ring is full
// does nothing at all (no call, no request, no record) and the ring empties.
export const SosHoldButton = ({ onHeld }: Props) => {
  const { t } = useTranslation();
  // 0 to 1: how full the ring is. `useRef` keeps one value across redraws.
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const begin = () => {
    cancel();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: SOS_HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    // The timer, not the animation, decides: it is what the 3 s rule means.
    timer.current = setTimeout(() => {
      timer.current = null;
      progress.setValue(0);
      onHeld();
    }, SOS_HOLD_MS);
  };

  // Never fire after the button is gone (Home redrawn without it).
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_LENGTH, 0],
  });

  return (
    <Pressable
      onPressIn={begin}
      onPressOut={() => {
        // Released before 3 s: nothing happens.
        if (timer.current) {
          cancel();
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={t('translations:sos_button')}
      accessibilityHint={t('translations:sos_button_hint')}
      testID="sos-hold-button"
      style={styles.pill}>
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
          size={18}
          tone="destructive-foreground"
          weight="fill"
        />
        <Text style={styles.label}>{t('translations:sos_button')}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: radius.full,
    backgroundColor: color.destructive,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
  },
  label: {
    ...typeScale.label,
    fontWeight: '700',
    color: color['destructive-foreground'],
  },
});
