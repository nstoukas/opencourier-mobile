import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { Order } from '@app/types/types';
import { HoldButton } from '../HoldButton/HoldButton';
import { BUTTON_WIDTH } from '../ButtonSwipe/ButtonSwipe';
import { color, control, space } from '@app/styles/theme';

// How long each answer must be held (row 135, operator 23 Nov). Accept is
// short, enough that a brush of the thumb cannot take an offer; Decline is
// longer, so an offer is never turned down by accident either.
export const ACCEPT_HOLD_MS = 200;
export const DECLINE_HOLD_MS = 1000;

type Props = {
  order: Order;
  // What a screen reader calls Accept ("Accept", "Accept both"), and its hint.
  acceptLabel: string;
  acceptHint: string;
  onAccept: (order: Order) => void;
  onDecline: (order: Order) => void;
  // True when drawn in the home card's pinned footer, below the offer's
  // details: it then gets the footer's top line and padding.
  pinned?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The two answers to an offer, side by side (row 135): Decline on the left,
// red with a white X, held 1 s; Accept on the right, green with a white tick,
// twice as wide, held 0.2 s. Used inside the three offer cards, and on Home
// in the card's footer, outside its scrolling part, so both are always on
// screen without scrolling (row 134).
export const OfferAnswers = ({
  order,
  acceptLabel,
  acceptHint,
  onAccept,
  onDecline,
  pinned = false,
  style,
}: Props) => {
  const { t } = useTranslation();

  return (
    <View style={[pinned && styles.pinned, style]} testID="offer-answers">
      <View style={styles.row}>
        <HoldButton
          holdMs={DECLINE_HOLD_MS}
          onHeld={() => onDecline(order)}
          icon={XIcon}
          tone="destructive"
          accessibilityLabel={t('translations:decline')}
          accessibilityHint={t('translations:decline_hold_hint')}
          testID="offer-decline"
          style={styles.decline}
        />
        <HoldButton
          holdMs={ACCEPT_HOLD_MS}
          onHeld={() => onAccept(order)}
          icon={CheckIcon}
          tone="success"
          accessibilityLabel={acceptLabel}
          accessibilityHint={acceptHint}
          testID="offer-accept"
          style={styles.accept}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pinned: {
    paddingTop: space['3'],
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  // As wide as the job's swipe and centred, so the footer keeps one width.
  row: {
    flexDirection: 'row',
    width: BUTTON_WIDTH,
    alignSelf: 'center',
    gap: space['3'],
  },
  // Spec 0019 (AC-5): both as tall as a thumb sized target (100 px).
  decline: {
    flex: 1,
    height: control.offer,
  },
  // About two thirds of the row (operator, 23 Nov).
  accept: {
    flex: 2,
    height: control.offer,
  },
});
