import React, { useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Order, StackStop } from '@app/types/types';
import { ButtonOrder, ButtonOrderType } from '../ButtonOrder/ButtonOrder';
import ButtonSwipe from '../ButtonSwipe/ButtonSwipe';
import { StackStopList } from '../StackStopList/StackStopList';
import { Paralelogram } from '../Paralelogram/Paralelogram';
import { styles as offerStyles } from '../NewOrderCell/NewOrderCell.styles';
import { control, color, space, typeScale } from '@app/styles/theme';
import { Colors } from '@app/styles/colors';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { SCREEN_WIDTH } from '@app/utilities/constants';
import { useCountdownBar } from '@app/hooks/useCountdownBar';
import { LegFigures } from '@app/utilities/routeLegs';

const PARALELOGRAM_WIDTH = 16;
const PARALELOGRAM_HEIGHT = 8;
const PROGRESS_BAR_WIDTH = SCREEN_WIDTH - 54;

type Props = {
  // The two orders offered together (spec 0048, AC-4), and their stops in order.
  order: Order;
  partner: Order;
  stops: StackStop[];
  // The whole ride through the four stops, from the stack's route; undefined
  // while it loads or when the co-op's routing cannot answer.
  ride?: LegFigures;
  // As on the single offer card (spec 0002): time left, the whole countdown,
  // or how long the offer has waited when it has no deadline.
  millisRemaining?: number | null;
  totalMillis?: number | null;
  millisWaited?: number | null;
  // One answer for both orders: the server takes or ends the pair together.
  onAccept: (order: Order) => void;
  onDecline: (order: Order) => void;
};

// Spec 0048 (AC-10, row 80): the offer card for two orders offered together.
// One card for the pair: the total and each order's own pay (each is paid in
// full, binding value 3), the ride through all four stops, the stops in their
// order (numbered as on the map), and one Accept and one Decline acting on
// both. A rider on auto accept never sees it: the phone takes the pair as it
// takes a single order (decision 128.0).
export const StackOfferCell = ({
  order,
  partner,
  stops,
  ride,
  millisRemaining = null,
  totalMillis = null,
  millisWaited = null,
  onAccept,
  onDecline,
}: Props) => {
  const { t } = useTranslation();
  // A new key after each attempt draws the swipe fresh (a refused accept
  // leaves no knob at the end), as on the single offer card.
  const [acceptAttempt, setAcceptAttempt] = useState(0);
  // The two orders in the order of their first stop, so "1" is the first named.
  const inStopOrder = [order, partner].sort(
    (a, b) =>
      stops.findIndex(stop => stop.deliveryId === a.id) -
      stops.findIndex(stop => stop.deliveryId === b.id),
  );
  const total =
    (order.totalCompensation ?? 0) + (partner.totalCompensation ?? 0);
  const money = (cents: number | null | undefined) =>
    formatCurrencyFromCents(cents, order.currencyCode);

  const hasDeadline = millisRemaining !== null;
  const widthAnimation = useCountdownBar(
    millisRemaining ?? 0,
    totalMillis ?? 0,
    PROGRESS_BAR_WIDTH,
  );
  const numberOfParalelograms = Math.floor(SCREEN_WIDTH / PARALELOGRAM_WIDTH);

  return (
    <View style={offerStyles.container} testID="stack-offer-card">
      <Text style={styles.kicker}>{t('translations:stack_offer_title')}</Text>
      <Text style={offerStyles.textPrice} testID="stack-offer-total">
        {money(total)}
      </Text>
      <Text style={offerStyles.textTrip} testID="stack-offer-each">
        {t('translations:stack_offer_each_paid', {
          first: money(inStopOrder[0]?.totalCompensation),
          second: money(inStopOrder[1]?.totalCompensation),
        })}
      </Text>
      {ride && (
        <Text style={offerStyles.textTrip} testID="stack-offer-ride">
          {t('translations:stack_offer_ride', {
            km: ride.km,
            minutes: ride.minutes,
          })}
        </Text>
      )}
      {!hasDeadline && millisWaited !== null && (
        <Text style={offerStyles.textWaiting} testID="offer-waiting">
          {millisWaited < 60000
            ? t('translations:offer_waiting_just_now')
            : t('translations:offer_waiting_minutes', {
                minutes: Math.floor(millisWaited / 60000),
              })}
        </Text>
      )}
      <View style={offerStyles.separator} />
      <StackStopList stops={stops} orders={[order, partner]} isOffer={true} />
      <ButtonSwipe
        key={acceptAttempt}
        style={offerStyles.buttonTop}
        height={control.offer}
        isSwiped={false}
        onSwiped={didSwipe => {
          if (didSwipe) {
            onAccept(order);
            setAcceptAttempt(attempt => attempt + 1);
          }
        }}
        enabled={true}
        title={t('translations:stack_offer_accept')}
        subtitle={t('translations:stack_offer_slide')}
        isLoading={false}
      />
      <ButtonOrder
        style={offerStyles.buttonDecline}
        type={ButtonOrderType.decline}
        onPress={() => onDecline(order)}
        autoAcceptOrders={false}
      />
      {hasDeadline && (
        <View
          style={[
            offerStyles.containerLoader,
            { height: PARALELOGRAM_HEIGHT },
          ]}>
          {[...Array(numberOfParalelograms).keys()].map(index => (
            <Paralelogram
              // Each bar's position is fixed, so its index is a stable key.
              key={index}
              backgroundColor={index % 2 === 0 ? Colors.gray8 : Colors.gray23}
              width={PARALELOGRAM_WIDTH}
              height={PARALELOGRAM_HEIGHT}
            />
          ))}
          <Animated.View
            style={[offerStyles.progress, { width: widthAnimation }]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  kicker: {
    ...typeScale.label,
    color: color['muted-foreground'],
    textAlign: 'center',
    marginBottom: space['1'],
  },
});
