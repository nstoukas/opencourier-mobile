import React, { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ButtonSwipe from '@app/components/ButtonSwipe/ButtonSwipe';
import { Button, ButtonType } from '@app/components/Button/Button';
import { Icon } from '@app/components/Icon/Icon';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { SCREEN_HEIGHT } from '@app/utilities/constants';
import {
  color,
  control,
  radius,
  shadow,
  space,
  typeScale,
} from '@app/styles/theme';

// What the card is showing (spec 0018, AC-8). Exactly one at a time.
export enum HomeCardMode {
  Offline = 'offline',
  Online = 'online',
  LastCall = 'last_call',
  Offer = 'offer',
  Job = 'job',
}

type Pager = {
  index: number;
  count: number;
  onPrevious: () => void;
  onNext: () => void;
};

type Props = {
  mode: HomeCardMode;
  // The offer or job cell, for those two modes.
  children?: ReactNode;
  // "1 of N" when there is more than one offer or job.
  pager?: Pager;
  isLoading: boolean;
  onGoOnline: (didSwipe: boolean) => void;
  onLastCall: () => void;
  onStayOnline: () => void;
  onGoOffline: () => void;
  // Reported so the map keeps the route above the card.
  onHeight?: (height: number) => void;
};

// Spec 0018 (AC-8): the fixed card at the bottom of home. It never moves
// under a gloved thumb (no dragging); when its content is taller than half
// the screen it scrolls inside itself.
export const HomeCard = ({
  mode,
  children,
  pager,
  isLoading,
  onGoOnline,
  onLastCall,
  onStayOnline,
  onGoOffline,
  onHeight,
}: Props) => {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();

  const idle = () => {
    switch (mode) {
      case HomeCardMode.Offline:
        return (
          <ButtonSwipe
            style={styles.swipe}
            isSwiped={false}
            onSwiped={onGoOnline}
            enabled={true}
            title={t('translations:go_online')}
            subtitle={t('translations:slide_to_start')}
            isLoading={isLoading}
          />
        );
      case HomeCardMode.Online:
        return (
          <>
            <Text style={styles.message} testID="home-card-waiting">
              {t('translations:waiting_for_offers')}
            </Text>
            <Button
              type={ButtonType.black}
              title={t('translations:last_call_button')}
              onPress={onLastCall}
            />
            <Button
              style={styles.secondButton}
              type={ButtonType.white}
              title={t('translations:go_offline')}
              onPress={onGoOffline}
            />
          </>
        );
      case HomeCardMode.LastCall:
        return (
          <>
            <Text style={styles.message} testID="home-card-last-call">
              {t('translations:last_call_explained')}
            </Text>
            <Button
              type={ButtonType.black}
              title={t('translations:stay_online')}
              onPress={onStayOnline}
            />
            <Button
              style={styles.secondButton}
              type={ButtonType.white}
              title={t('translations:go_offline')}
              onPress={onGoOffline}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <View
      style={[styles.card, { paddingBottom: bottom + space['3'] }]}
      testID={`home-card-${mode}`}
      onLayout={event => onHeight?.(event.nativeEvent.layout.height)}>
      {pager && pager.count > 1 && (
        <View style={styles.pager}>
          <TouchableOpacity
            testID="home-card-previous"
            accessibilityRole="button"
            accessibilityLabel={t('translations:previous')}
            style={styles.pagerButton}
            onPress={pager.onPrevious}>
            <Icon icon={CaretLeftIcon} />
          </TouchableOpacity>
          <Text style={styles.pagerText} testID="home-card-pager">
            {t('translations:card_position', {
              position: pager.index + 1,
              count: pager.count,
            })}
          </Text>
          <TouchableOpacity
            testID="home-card-next"
            accessibilityRole="button"
            accessibilityLabel={t('translations:next')}
            style={styles.pagerButton}
            onPress={pager.onNext}>
            <Icon icon={CaretRightIcon} />
          </TouchableOpacity>
        </View>
      )}
      {mode === HomeCardMode.Offer || mode === HomeCardMode.Job ? (
        <ScrollView style={styles.scroll} nestedScrollEnabled>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.idle}>{idle()}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.card,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: space['3'],
    ...shadow.lg,
  },
  scroll: {
    // Half the screen at most; the content scrolls inside (AC-8).
    maxHeight: SCREEN_HEIGHT / 2,
  },
  idle: {
    paddingHorizontal: space['4'],
    gap: space['2'],
  },
  swipe: {
    alignSelf: 'center',
  },
  message: {
    ...typeScale.body,
    color: color.foreground,
    textAlign: 'center',
    marginBottom: space['2'],
  },
  secondButton: {
    marginTop: space['1'],
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['3'],
  },
  pagerButton: {
    width: control.xl,
    height: control.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerText: {
    ...typeScale['body-sm'],
    color: color['muted-foreground'],
  },
});
