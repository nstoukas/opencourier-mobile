import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Order, StackStop } from '@app/types/types';
import { Icon } from '@app/components/Icon/Icon';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { color, radius, space, typeScale } from '@app/styles/theme';
import { isStopDone } from '@app/utilities/stack';

type Props = {
  // The stack's four stops in riding order (spec 0048, cross check 6).
  stops: StackStop[];
  // The two orders of the stack, to name each stop.
  orders: Order[];
  // An offer: no stop is done yet and none is "next".
  isOffer: boolean;
  // Row 81: an add on offer. Still an offer (no stop is "next", drop offs by
  // area only), but the rider's current job may be picked up already, so its
  // stops are ticked from its status.
  addOn?: boolean;
};

// Where a stop is, in words a rider can read at a glance: the restaurant for
// a pickup; for a drop off, the street (an offer's area), never a house
// number or the customer's name, which the job card below shows for the stop
// that is next.
// On an offer only the server's `dropoffArea` is used (agy review of row 80):
// the server leaves it empty exactly when the street would give the house
// away (spec 0019), so falling back to the street there would show what the
// offer card must not.
// Row 81: on an add on, the rider's own job is no offer (it is theirs, as on
// its job card), so only the offered order is held to the area rule.
const placeOf = (
  stop: StackStop,
  order: Order | undefined,
  isOffer: boolean,
  addOn: boolean,
): string => {
  if (!order) {
    return '';
  }
  if (stop.stop === 'PICKUP') {
    return order.pickupBusinessName || order.pickupName || '';
  }
  if (isOffer && (!addOn || order.addOn)) {
    return order.dropoffArea || '';
  }
  return order.dropoffArea || order.dropoffLocation?.street || '';
};

// Spec 0048 (AC-10): a stack's stops in order, numbered 1 to 4 as on the map.
// On a job, the stops behind the rider are ticked and the next one is marked,
// so the rider always knows which order the card below is about.
export const StackStopList = ({
  stops,
  orders,
  isOffer,
  addOn = false,
}: Props) => {
  const { t } = useTranslation();
  const orderOf = (id: string) => orders.find(order => order.id === id);
  const done = (stop: StackStop) =>
    (!isOffer || addOn) &&
    isStopDone(stop, orderOf(stop.deliveryId)?.status ?? '');
  const nextIndex = isOffer ? -1 : stops.findIndex(stop => !done(stop));

  return (
    <View
      style={[styles.list, !isOffer && styles.jobList]}
      testID="stack-stop-list">
      {stops.map((stop, index) => {
        const isDone = done(stop);
        const isNext = index === nextIndex;
        return (
          <View
            // A delivery has one stop of each kind, so its id and the kind make a stable key.
            key={`${stop.deliveryId}-${stop.stop}`}
            style={styles.row}
            testID={`stack-stop-${index + 1}`}
            accessibilityLabel={t(
              isDone
                ? 'translations:stack_stop_done_a11y'
                : 'translations:stack_stop_a11y',
              { number: index + 1 },
            )}>
            <View
              style={[
                styles.number,
                isNext && styles.numberNext,
                isDone && styles.numberDone,
              ]}>
              {isDone ? (
                <Icon icon={CheckIcon} size={14} tone="muted-foreground" />
              ) : (
                <Text
                  style={[styles.numberText, isNext && styles.numberTextNext]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={[styles.text, isDone && styles.textDone]}
              numberOfLines={1}>
              {t(
                stop.stop === 'PICKUP'
                  ? 'translations:stack_stop_pickup'
                  : 'translations:stack_stop_dropoff',
                {
                  place: placeOf(
                    stop,
                    orderOf(stop.deliveryId),
                    isOffer,
                    addOn,
                  ),
                },
              )}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  // Above a job card, lined up with the card's own content (the offer card
  // pads its own).
  jobList: {
    paddingHorizontal: space['4'],
    paddingTop: space['2'],
  },
  list: {
    gap: space['2'],
    marginBottom: space['3'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  number: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberNext: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  numberDone: {
    backgroundColor: color.muted,
    borderColor: color.muted,
  },
  numberText: {
    ...typeScale.caption,
    color: color.foreground,
  },
  numberTextNext: {
    color: color['primary-foreground'],
  },
  text: {
    ...typeScale['body-sm'],
    color: color.foreground,
    flexShrink: 1,
  },
  textDone: {
    color: color['muted-foreground'],
  },
});
