import React from 'react';
import { StyleProp, ViewStyle, View, Text, Animated } from 'react-native';
import { styles } from './NewOrderCell.styles';
import { Order } from '@app/types/types';
import { useTranslation } from 'react-i18next';
import { OfferAnswers } from '../OfferAnswers/OfferAnswers';
import { offerTripLines } from '@app/utilities/offerTrip';
import { boxSizeLine } from '@app/utilities/boxSize';
import { legLine } from '@app/utilities/legs';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { SCREEN_WIDTH } from '@app/utilities/constants';
import { Paralelogram } from '../Paralelogram/Paralelogram';
import { Colors } from '@app/styles/colors';
import { useCountdownBar } from '@app/hooks/useCountdownBar';
import { Icon } from '@app/components/Icon/Icon';
import { HouseLineIcon } from 'phosphor-react-native/src/icons/HouseLine';
import { StorefrontIcon } from 'phosphor-react-native/src/icons/Storefront';

const PARALELOGRAM_WIDTH = 16;
const PARALELOGRAM_HEIGHT = 8;

const PROGRESS_BAR_WIDTH = SCREEN_WIDTH - 54;

type Props = {
  style?: StyleProp<ViewStyle>;
  order: Order;
  autoAcceptOrders: boolean;
  onAccept: (order: Order) => void;
  onDecline: (order: Order) => void;
  // Time left before the server's deadline; null when the offer has no
  // deadline (Offer expiry off), and then no bar is drawn (spec 0002).
  millisRemaining?: number | null;
  // The whole countdown length, so the bar starts at the share already used.
  totalMillis?: number | null;
  // How long the offer has waited, for the "Waiting X min" line shown when
  // there is no deadline (AC-4).
  millisWaited?: number | null;
  // True when Home draws Accept and Decline below the card, outside its
  // scrolling part; the card then shows only the offer's details.
  answersBelow?: boolean;
};

// "Waiting 3 min", or "Waiting less than 1 min" for a fresh offer.
const waitingText = (
  millisWaited: number,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  const minutes = Math.floor(millisWaited / 60000);
  return minutes < 1
    ? t('translations:offer_waiting_just_now')
    : t('translations:offer_waiting_minutes', { minutes });
};

export const NewOrderCell = ({
  style,
  order,
  onAccept,
  onDecline,
  autoAcceptOrders,
  millisRemaining = null,
  totalMillis = null,
  millisWaited = null,
  answersBelow = false,
}: Props) => {
  const { t } = useTranslation();
  // Spec 0019 (AC-1, AC-3): the figures come with the offer from the backend.
  const trip = offerTripLines(order.offerTrip, t);
  // Spec 0043 (AC-7): "Medium order", so the rider knows what they carry before accepting.
  const boxSize = boxSizeLine(order.boxSize, t);
  // Spec 0046 (AC-7): "Leg 1 of 2" when the order goes as several deliveries.
  const leg = legLine(order, t);
  const numberOfParalelograms = Math.floor(SCREEN_WIDTH / PARALELOGRAM_WIDTH);

  // An offer with a deadline shows a countdown bar; one without shows how
  // long it has waited instead.
  const hasDeadline = millisRemaining !== null;
  const widthAnimation = useCountdownBar(
    millisRemaining ?? 0,
    totalMillis ?? 0,
    PROGRESS_BAR_WIDTH,
  );

  const paralelogramColor = (index: number) => {
    const even = index % 2 === 0;
    return even ? Colors.gray8 : Colors.gray23;
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.textPrice}>
        {formatCurrencyFromCents(order.totalCompensation, order.currencyCode)}
      </Text>
      {!hasDeadline && millisWaited !== null && (
        <Text style={styles.textWaiting} testID="offer-waiting">
          {waitingText(millisWaited, t)}
        </Text>
      )}
      {/* Spec 0019 (AC-3): the ride, then the minutes, then where from and
          where to. No €/km, no items, no customer name, no full address. */}
      {trip.distances !== '' && (
        <Text style={styles.textTrip} testID="offer-trip-distances">
          {trip.distances}
        </Text>
      )}
      {trip.minutes !== '' && (
        <Text style={styles.textTrip} testID="offer-trip-minutes">
          {trip.minutes}
        </Text>
      )}
      {boxSize !== '' && (
        <Text style={styles.textTrip} testID="offer-box-size">
          {boxSize}
        </Text>
      )}
      {leg !== '' && (
        <Text style={styles.textTrip} testID="offer-leg">
          {leg}
        </Text>
      )}
      <View style={styles.separator} />
      <View style={styles.place}>
        <Icon icon={StorefrontIcon} weight="fill" size={24} tone="input" />
        <Text style={styles.textName} testID="offer-restaurant">
          {order.pickupBusinessName}
        </Text>
      </View>
      {order.dropoffArea ? (
        <View style={styles.place}>
          <Icon icon={HouseLineIcon} size={24} tone="muted-foreground" />
          <Text style={styles.textArea} testID="offer-dropoff-area">
            {order.dropoffArea}
          </Text>
        </View>
      ) : null}
      {/* Spec 0018 (AC-9) and 0019 (AC-5): Accept and Decline. With auto
          accept the offer is claimed on arrival, and home shows this card only
          when the phone could not take it (rows 128 and 130). Home draws them
          in its pinned footer instead (`answersBelow`), so they never need a
          scroll (operator, 23 Nov). */}
      {!answersBelow && (
        <OfferAnswers
          order={order}
          acceptTitle={t('translations:accept')}
          acceptSubtitle={t('translations:slide_to_accept')}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      )}
      {!autoAcceptOrders && hasDeadline && (
        <View style={[styles.containerLoader, { height: PARALELOGRAM_HEIGHT }]}>
          {[...Array(numberOfParalelograms).keys()]
            .map(i => i)
            .map(index => {
              return (
                <Paralelogram
                  // Each bar's position is fixed, so its index is a stable key.
                  key={index}
                  backgroundColor={paralelogramColor(index)}
                  width={PARALELOGRAM_WIDTH}
                  height={PARALELOGRAM_HEIGHT}
                />
              );
            })}
          <Animated.View style={[styles.progress, { width: widthAnimation }]} />
        </View>
      )}
    </View>
  );
};
