import React, { useState } from 'react';
import {
  StyleProp,
  ViewStyle,
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { styles } from './NewOrderCell.styles';
import { Order } from '@app/types/types';
import { ButtonOrder, ButtonOrderType } from '../ButtonOrder/ButtonOrder';
import { useTranslation } from 'react-i18next';
import ButtonSwipe from '../ButtonSwipe/ButtonSwipe';
import { RouteLines } from '../RouteLines/RouteLines';
import { LegFigures } from '@app/utilities/routeLegs';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { SCREEN_WIDTH } from '@app/utilities/constants';
import { Paralelogram } from '../Paralelogram/Paralelogram';
import { Colors } from '@app/styles/colors';
import { useCountdownBar } from '@app/hooks/useCountdownBar';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { CopyIcon } from 'phosphor-react-native/src/icons/Copy';
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
  onCopyCustomer: (order: Order) => void;
  onCopyRestaurant: (order: Order) => void;
  // Time left before the server's deadline; null when the offer has no
  // deadline (Offer expiry off), and then no bar is drawn (spec 0002).
  millisRemaining?: number | null;
  // The whole countdown length, so the bar starts at the share already used.
  totalMillis?: number | null;
  // How long the offer has waited, for the "Waiting X min" line shown when
  // there is no deadline (AC-4).
  millisWaited?: number | null;
  // Spec 0018 (AC-7): the distance lines, from the co-op's route.
  toRestaurant?: LegFigures;
  toCustomer?: LegFigures;
  routeUnavailable?: boolean;
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
  onCopyCustomer,
  onCopyRestaurant,
  millisRemaining = null,
  totalMillis = null,
  millisWaited = null,
  toRestaurant,
  toCustomer,
  routeUnavailable = false,
}: Props) => {
  const { t } = useTranslation();
  // A new key after each attempt draws the swipe fresh, so an accept that did
  // not go through (already answered, a refused claim) leaves no knob at the end.
  const [acceptAttempt, setAcceptAttempt] = useState(0);
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
      <View style={styles.separator} />
      <View style={styles.content}>
        <View style={styles.containerLeft}>
          <Icon icon={StorefrontIcon} weight="fill" size={30} tone="input" />
          <View style={styles.verticalLine} />
          <Icon icon={HouseLineIcon} size={32} tone="muted-foreground" />
        </View>
        <View style={styles.containerRight}>
          <View style={styles.containerAddressButton}>
            <View style={styles.containerText}>
              <Text style={styles.textName}>
                {order.pickupLocationFormattedAddress ??
                  order.pickupLocation?.formattedAddress ??
                  order.pickupName ??
                  'N/A'}
              </Text>
            </View>
            <TouchableOpacity
              hitSlop={hitSlopFor(32)}
              onPress={() => onCopyRestaurant(order)}>
              <View style={styles.containerChats}>
                <Icon icon={CopyIcon} weight="fill" size={16} />
              </View>
            </TouchableOpacity>
          </View>
          <RouteLines
            toRestaurant={toRestaurant}
            toCustomer={toCustomer}
            unavailable={routeUnavailable}
          />
          <View style={styles.containerAddressButton}>
            <View style={styles.containerText}>
              <Text style={styles.textName}>
                {order.dropoffLocationFormattedAddress ??
                  order.dropoffLocation?.formattedAddress ??
                  order.dropoffName ??
                  'N/A'}
              </Text>
            </View>
            <TouchableOpacity
              hitSlop={hitSlopFor(32)}
              onPress={() => onCopyCustomer(order)}>
              <View style={styles.containerChats}>
                <Icon icon={CopyIcon} weight="fill" size={16} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <>
        {/* Spec 0018 (AC-9): Accept is a swipe, so a brush of the thumb cannot
            take an offer. A swipe let go early does nothing. With auto accept
            the offer is claimed on arrival and home never shows this card. */}
        <ButtonSwipe
          key={acceptAttempt}
          style={styles.buttonTop}
          isSwiped={false}
          onSwiped={didSwipe => {
            if (didSwipe) {
              onAccept(order);
              setAcceptAttempt(attempt => attempt + 1);
            }
          }}
          enabled={true}
          title={t('translations:accept')}
          subtitle={t('translations:slide_to_accept')}
          isLoading={false}
        />
        <ButtonOrder
          type={ButtonOrderType.decline}
          onPress={() => onDecline(order)}
          autoAcceptOrders={autoAcceptOrders}
        />
      </>
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
