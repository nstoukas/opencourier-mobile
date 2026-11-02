import { Colors } from '@app/styles/colors';
import React, { FunctionComponent, useEffect } from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SCREEN_WIDTH } from '@app/utilities/constants';
import LinearGradient from 'react-native-linear-gradient';
import { radius, typeScale } from '@app/styles/theme';
import { Icon } from '@app/components/Icon/Icon';
import { CheckFatIcon } from 'phosphor-react-native/src/icons/CheckFat';

// Exported so a button beside a swipe can match its width (spec 0019).
export const BUTTON_WIDTH = SCREEN_WIDTH / 1.2;
const BUTTON_HEIGHT = 48;
const BUTTON_PADDING = 7;

interface Props {
  isSwiped: boolean;
  onSwiped: (newState: boolean) => void;
  enabled: boolean;
  title: string;
  subtitle?: string;
  isLoading: boolean;
  style?: StyleProp<ViewStyle>;
  // How tall the swipe is (48 by default; the offer card uses `control.offer`).
  // The knob, how far it travels and the half way point all follow from it.
  height?: number;
}

const ButtonSwipe: FunctionComponent<Props> = ({
  isSwiped,
  onSwiped,
  enabled,
  isLoading,
  title = 'Slide to Complete',
  subtitle = '',
  style = {},
  height = BUTTON_HEIGHT,
}: Props) => {
  // The knob is a circle filling the height inside the padding; it travels the
  // rest of the width (spec 0019: a taller swipe gets a thumb sized knob).
  // The room for the knob sets how far it travels; the knob drawn is 2 px
  // smaller, so a default 48 px swipe draws its 32 px knob exactly as before.
  const knobRoom = height - 2 * BUTTON_PADDING;
  const knob = knobRoom - 2;
  const swipeRange = BUTTON_WIDTH - 2 * BUTTON_PADDING - knobRoom;
  const halfWay = BUTTON_WIDTH / 2 - knobRoom / 2;
  const X = useSharedValue(0);

  useEffect(() => {
    if (!isSwiped) {
      X.value = withTiming(0);
    }
  }, [isSwiped]);

  const animatedGestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: { completed: boolean }) => {
      ctx.completed = isSwiped;
    },
    onActive: (e, ctx) => {
      let newValue;

      if (ctx.completed) {
        newValue = swipeRange + e.translationX;
      } else {
        newValue = e.translationX;
      }
      if (newValue >= 0 && newValue <= swipeRange) {
        X.value = newValue;
      }
    },
    onEnd: () => {
      if (X.value < halfWay) {
        X.value = withTiming(0);
        runOnJS(onSwiped)(false);
      } else {
        X.value = withTiming(swipeRange);
        runOnJS(onSwiped)(true);
      }
    },
  });

  const AnimatedStyles = {
    swipeable: useAnimatedStyle(() => {
      return {
        transform: [{ translateX: X.value }],
      };
    }),
    swipeText: useAnimatedStyle(() => {
      return {
        opacity: interpolate(
          X.value,
          [0, swipeRange],
          [1, 0],
          Extrapolate.CLAMP,
        ),
        transform: [
          {
            translateX: interpolate(
              X.value,
              [0, swipeRange],
              [0, BUTTON_WIDTH / 2 - knobRoom],
              Extrapolate.CLAMP,
            ),
          },
        ],
      };
    }),
  };

  return (
    <View style={[styles.swipeContainer, { height }, style]}>
      {isLoading ? (
        <View style={styles.activityIndicator}>
          <ActivityIndicator size="small" color={Colors.white} />
        </View>
      ) : (
        <>
          {/* activeOffsetX: the swipe claims a drag once it has moved 10 px
              sideways, before a scrolling card around it can take it (spec 0018). */}
          <PanGestureHandler
            onGestureEvent={animatedGestureHandler}
            activeOffsetX={[-10, 10]}
            enabled={enabled}>
            <Animated.View
              style={[
                styles.swipeable,
                { width: knob, height: knob },
                AnimatedStyles.swipeable,
              ]}>
              <LinearGradient
                style={[
                  styles.containerGradient,
                  { width: knob, height: knob },
                ]}
                colors={Colors.swipeButtonGradientArray}>
                <View
                  style={[
                    styles.containerCheckmark,
                    { width: knob * 0.4, height: knob * 0.4 },
                  ]}>
                  <Icon
                    icon={CheckFatIcon}
                    weight="fill"
                    size={Math.round(knob * 0.22)}
                    tone="background"
                  />
                </View>
              </LinearGradient>
            </Animated.View>
          </PanGestureHandler>
          <View>
            <Animated.Text style={[styles.swipeText, AnimatedStyles.swipeText]}>
              {title}
            </Animated.Text>
            <Animated.Text
              style={[styles.swipeTextSubtitle, AnimatedStyles.swipeText]}>
              {subtitle}
            </Animated.Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  swipeContainer: {
    height: BUTTON_HEIGHT,
    width: BUTTON_WIDTH,
    padding: BUTTON_PADDING,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: Colors.black1,
    alignSelf: 'center',
  },
  swipeable: {
    borderRadius: radius.full,
    position: 'absolute',
    left: BUTTON_PADDING,
    zIndex: 3,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeText: {
    color: Colors.white,
    fontSize: typeScale.h3.fontSize,
    fontWeight: '700',
    zIndex: 2,
  },
  swipeTextSubtitle: {
    color: Colors.white,
    fontSize: typeScale.caption.fontSize,
    zIndex: 2,
  },
  activityIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textDecline: {
    color: Colors.gray12,
    fontSize: typeScale['body-sm'].fontSize,
    textTransform: 'uppercase',
  },
  containerGradient: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  containerCheckmark: {
    width: 13,
    height: 13,
    borderRadius: radius.full,
    backgroundColor: Colors.black1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default ButtonSwipe;
