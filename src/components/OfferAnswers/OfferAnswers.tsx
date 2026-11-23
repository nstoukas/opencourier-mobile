import React, { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Order } from '@app/types/types';
import ButtonSwipe, { BUTTON_WIDTH } from '../ButtonSwipe/ButtonSwipe';
import { ButtonOrder, ButtonOrderType } from '../ButtonOrder/ButtonOrder';
import { color, control, space } from '@app/styles/theme';

type Props = {
  order: Order;
  // The swipe's words: "Accept", "Accept both", or the add on's.
  acceptTitle: string;
  acceptSubtitle: string;
  onAccept: (order: Order) => void;
  onDecline: (order: Order) => void;
  // True when drawn in the home card's pinned footer, below the offer's
  // details: it then gets the footer's top line and padding.
  pinned?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The two answers to an offer: Accept as a swipe and Decline as a button, both
// 100 px tall (spec 0019, AC-5). Used inside the three offer cards, and on Home
// in the card's footer, outside its scrolling part, so both are always on
// screen without scrolling (operator, 23 Nov).
export const OfferAnswers = ({
  order,
  acceptTitle,
  acceptSubtitle,
  onAccept,
  onDecline,
  pinned = false,
  style,
}: Props) => {
  // A new key after each attempt draws the swipe fresh, so an accept that did
  // not go through (already answered, a refused claim) leaves no knob at the end.
  const [acceptAttempt, setAcceptAttempt] = useState(0);

  return (
    <View style={[pinned && styles.pinned, style]} testID="offer-answers">
      {/* Spec 0018 (AC-9): Accept is a swipe, so a brush of the thumb cannot
          take an offer. A swipe let go early does nothing. */}
      <ButtonSwipe
        key={acceptAttempt}
        style={styles.accept}
        height={control.offer}
        isSwiped={false}
        onSwiped={didSwipe => {
          if (didSwipe) {
            onAccept(order);
            setAcceptAttempt(attempt => attempt + 1);
          }
        }}
        enabled={true}
        title={acceptTitle}
        subtitle={acceptSubtitle}
        isLoading={false}
      />
      <ButtonOrder
        style={styles.decline}
        type={ButtonOrderType.decline}
        onPress={() => onDecline(order)}
        autoAcceptOrders={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  pinned: {
    paddingTop: space['3'],
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  accept: {
    marginBottom: 12,
  },
  // As wide as the swipe and centred under it (spec 0019, AC-5).
  decline: {
    width: BUTTON_WIDTH,
    alignSelf: 'center',
  },
});
