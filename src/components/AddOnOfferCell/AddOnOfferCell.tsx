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

const PARALELOGRAM_WIDTH = 16;
const PARALELOGRAM_HEIGHT = 8;
const PROGRESS_BAR_WIDTH = SCREEN_WIDTH - 54;

type Props = {
  // The add on offer (spec 0048, row 81), the job the rider is on, and the
  // stops of both in riding order.
  order: Order;
  job: Order;
  stops: StackStop[];
  // Cross check 2: the rider carries food already, so the card asks them to
  // answer only once they are stopped.
  calm: boolean;
  // As on the single offer card (spec 0002): time left, the whole countdown,
  // or how long the offer has waited when it has no deadline.
  millisRemaining?: number | null;
  totalMillis?: number | null;
  millisWaited?: number | null;
  // The answer is about the added order only: the job is never touched (AC-7).
  onAccept: (order: Order) => void;
  onDecline: (order: Order) => void;
};

// Spec 0048 (AC-10, row 81): the offer card for one more order on the way.
// The rider UI direction keeps it short: what it pays, what it adds to the job
// ("+2.1 km, +7 min"), the total with the job (each order paid in full,
// binding value 3), and the four stops in order, numbered as on the map. One
// Accept and one Decline, for the added order only; declining is free. Never
// accepted by the phone itself (AC-8), so it shows even to a rider on auto
// accept.
export const AddOnOfferCell = ({
  order,
  job,
  stops,
  calm,
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
  const money = (cents: number | null | undefined) =>
    formatCurrencyFromCents(cents, order.currencyCode);
  const total = (order.totalCompensation ?? 0) + (job.totalCompensation ?? 0);

  const hasDeadline = millisRemaining !== null;
  const widthAnimation = useCountdownBar(
    millisRemaining ?? 0,
    totalMillis ?? 0,
    PROGRESS_BAR_WIDTH,
  );
  const numberOfParalelograms = Math.floor(SCREEN_WIDTH / PARALELOGRAM_WIDTH);

  return (
    <View style={offerStyles.container} testID="add-on-offer-card">
      <Text style={styles.kicker}>{t('translations:add_on_offer_title')}</Text>
      <Text style={offerStyles.textPrice} testID="add-on-offer-pay">
        {money(order.totalCompensation)}
      </Text>
      {order.extraKm != null && order.extraMinutes != null && (
        <Text style={styles.adds} testID="add-on-offer-adds">
          {t('translations:add_on_offer_adds', {
            km: order.extraKm,
            minutes: order.extraMinutes,
          })}
        </Text>
      )}
      <Text style={offerStyles.textTrip} testID="add-on-offer-total">
        {t('translations:add_on_offer_with_job', { total: money(total) })}
      </Text>
      {calm && (
        <Text style={offerStyles.textTrip} testID="add-on-offer-stopped">
          {t('translations:add_on_offer_when_stopped')}
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
      <StackStopList
        stops={stops}
        orders={[order, job]}
        isOffer={true}
        addOn={true}
      />
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
        title={t('translations:add_on_offer_accept')}
        subtitle={t('translations:add_on_offer_slide')}
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
  // What it adds is the figure a rider weighs first after the pay.
  adds: {
    ...typeScale.label,
    color: color.foreground,
    textAlign: 'center',
    marginBottom: space['1'],
  },
});
