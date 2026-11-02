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

const BUTTON_WIDTH = SCREEN_WIDTH / 1.2;
const BUTTON_HEIGHT = 48;
const BUTTON_PADDING = 7;
const SWIPEABLE_DIMENSIONS = BUTTON_HEIGHT - 2 * BUTTON_PADDING;
const H_SWIPE_RANGE = BUTTON_WIDTH - 2 * BUTTON_PADDING - SWIPEABLE_DIMENSIONS;

interface Props {
  isSwiped: boolean;
  onSwiped: (newState: boolean) => void;
  enabled: boolean;
  title: string;
  subtitle?: string;
  isLoading: boolean;
  style?: StyleProp<ViewStyle>;
}

const ButtonSwipe: FunctionComponent<Props> = ({
  isSwiped,
  onSwiped,
  enabled,
  isLoading,
  title = 'Slide to Complete',
  subtitle = '',
  style = {},
}: Props) => {
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
        newValue = H_SWIPE_RANGE + e.translationX;
      } else {
        newValue = e.translationX;
      }
      if (newValue >= 0 && newValue <= H_SWIPE_RANGE) {
        X.value = newValue;
      }
    },
    onEnd: () => {
      if (X.value < BUTTON_WIDTH / 2 - SWIPEABLE_DIMENSIONS / 2) {
        X.value = withTiming(0);
        runOnJS(onSwiped)(false);
      } else {
        X.value = withTiming(H_SWIPE_RANGE);
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
          [0, H_SWIPE_RANGE],
          [1, 0],
          Extrapolate.CLAMP,
        ),
        transform: [
          {
            translateX: interpolate(
              X.value,
              [0, H_SWIPE_RANGE],
              [0, BUTTON_WIDTH / 2 - SWIPEABLE_DIMENSIONS],
              Extrapolate.CLAMP,
            ),
          },
        ],
      };
    }),
  };

  return (
    <View style={[styles.swipeContainer, style]}>
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
            <Animated.View style={[styles.swipeable, AnimatedStyles.swipeable]}>
              <LinearGradient
                style={[styles.containerGradient]}
                colors={Colors.swipeButtonGradientArray}>
                <View style={styles.containerCheckmark}>
                  <Icon
                    icon={CheckFatIcon}
                    weight="fill"
                    size={7}
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
