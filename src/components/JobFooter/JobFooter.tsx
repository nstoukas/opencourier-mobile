import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import ButtonSwipe from '@app/components/ButtonSwipe/ButtonSwipe';
import { Icon } from '@app/components/Icon/Icon';
import { CloudArrowUpIcon } from 'phosphor-react-native/src/icons/CloudArrowUp';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import useOrder from '@app/hooks/useOrder';
import { useWaitClock } from '@app/hooks/useLeaveWait';
import { isSplitOpen } from '@app/utilities/splitRequest';
import { isWaitingAtPickup, waitClockText } from '@app/utilities/waitClock';
import { isJobOver } from '@app/utilities/jobContact';
import { cardStageOf } from '@app/utilities/jobCard';
import { color, space, typeScale } from '@app/styles/theme';
import moment from 'moment';
import { formatShift } from '@app/utilities/dates';

type Props = {
  order: Order;
  // Spec 0033: a leave of this late order is on its way, so the swipe waits.
  leavingWait?: boolean;
};

// The job card's pinned footer (spec 0021, AC-3, AC-5, AC-9): drawn outside the
// part of the card that scrolls, so the swipe is always in the same place,
// "Picked up" before the pickup and "Delivered" after, with the job's notices
// above it (waiting to send, a removal or split request). Its small actions moved
// behind the ⋯ button beside the address (row 138, `JobActionsButton`). A swipe
// only queues steps in the outbox (spec 0009), so nothing here waits for the network.
export const JobFooter = ({ order, leavingWait }: Props) => {
  const { t } = useTranslation();
  const { pickedUp, delivered } = useOrder();
  const stage = cardStageOf(order.status);
  const jobOver = isJobOver(order.status);

  // Spec 0033: the clock at the restaurant counts up each second.
  const waiting = isWaitingAtPickup(order);
  const secondsWaiting = useWaitClock(order.arrivedAtOnPhone, waiting);

  // Spec 0035: the rider's request, while it is open or was refused. It changes
  // nothing about the job, so every other action on the card stays.
  const removalRequest = order.removalRequest;
  const removalOpen = removalRequest?.status === 'OPEN';
  const removalDeclined = removalRequest?.status === 'DECLINED';
  const refusalNote = removalRequest?.decisionNote?.trim();

  // Spec 0047: the rider's split request. While open, the card says so with a
  // counter, the swipe waits for the answer, and Leave appears after the limit.
  // The answer stays on the card while the rider is still at the restaurant.
  const splitRequest = order.splitRequest;
  const splitOpen = isSplitOpen(order);
  const atPickup =
    order.status === OrderStatus.courier_arrived_at_pickup_location;
  const splitRefused = atPickup && splitRequest?.status === 'REFUSED';
  const splitConfirmed = atPickup && splitRequest?.status === 'CONFIRMED';
  const splitNote = splitRequest?.adminNote?.trim();
  const keptSize = splitRequest?.finalLegs?.[0]?.boxSize;
  const splitSeconds = useWaitClock(order.splitCreatedAtOnPhone, splitOpen);

  // After a swipe's steps are queued, draw the swipe fresh (a new key): when the
  // status moved the key changes anyway; when the step was refused, this brings
  // the knob back to the start (spec 0018).
  const [attempt, setAttempt] = useState(0);
  const swipeKey = `${order.id}-${order.status}-${attempt}`;
  const onSwiped = async (didSwipe: boolean) => {
    if (!didSwipe) {
      return;
    }
    await (stage === 'pickup' ? pickedUp(order) : delivered(order));
    setAttempt(a => a + 1);
  };

  return (
    <View style={styles.footer} testID="job-footer">
      {order.waitingToSend ? (
        <View style={styles.waiting} accessibilityRole="text">
          <Icon icon={CloudArrowUpIcon} size={18} tone="muted-foreground" />
          <Text style={styles.waitingText}>
            {order.status === OrderStatus.dropped_off
              ? t('translations:delivered_waiting_to_send')
              : t('translations:waiting_to_send')}
          </Text>
        </View>
      ) : null}
      {removalOpen ? (
        <View
          style={styles.waiting}
          accessibilityRole="text"
          testID="job-removal-waiting">
          <Icon icon={ClockIcon} size={18} tone="muted-foreground" />
          <Text style={styles.waitingText} numberOfLines={1}>
            {t('translations:removal_waiting')}
          </Text>
        </View>
      ) : null}
      {removalDeclined ? (
        // One line, as every note on the job (spec 0021); a tap reads the whole sentence.
        <TouchableOpacity
          style={styles.waiting}
          disabled={!refusalNote}
          onPress={() =>
            Alert.alert(
              t('translations:removal_declined_full_title'),
              refusalNote,
            )
          }
          accessibilityRole="button"
          testID="job-removal-declined">
          <Icon icon={WarningIcon} size={18} tone="destructive" />
          <Text style={styles.refusedText} numberOfLines={1}>
            {refusalNote
              ? t('translations:removal_declined_with_note', {
                  note: refusalNote,
                })
              : t('translations:removal_declined')}
          </Text>
        </TouchableOpacity>
      ) : null}
      {splitOpen ? (
        <View
          style={styles.waiting}
          accessibilityRole="text"
          testID="job-split-waiting">
          <Icon icon={ClockIcon} size={18} tone="muted-foreground" />
          <Text style={styles.waitingText} numberOfLines={1}>
            {splitSeconds === null
              ? t('translations:split_waiting')
              : order.splitLeaveFromOnPhone &&
                Date.now() < order.splitLeaveFromOnPhone
              ? // Row 11 review: says when Leave will appear, from the server's time on the phone's clock.
                t('translations:split_waiting_leave_at', {
                  time: waitClockText(splitSeconds),
                  at: moment(order.splitLeaveFromOnPhone).format(formatShift),
                })
              : t('translations:split_waiting_clock', {
                  time: waitClockText(splitSeconds),
                })}
          </Text>
        </View>
      ) : null}
      {splitRefused ? (
        // One line, as every note on the job (spec 0021); a tap reads the whole sentence.
        <TouchableOpacity
          style={styles.waiting}
          disabled={!splitNote}
          onPress={() =>
            Alert.alert(t('translations:split_refused_title'), splitNote)
          }
          accessibilityRole="button"
          testID="job-split-refused">
          <Icon icon={WarningIcon} size={18} tone="destructive" />
          <Text style={styles.refusedText} numberOfLines={1}>
            {splitNote
              ? t('translations:split_refused_with_note', { note: splitNote })
              : t('translations:split_refused')}
          </Text>
        </TouchableOpacity>
      ) : null}
      {splitConfirmed ? (
        <Text
          style={styles.waitingText}
          numberOfLines={1}
          testID="job-split-confirmed">
          {keptSize
            ? t('translations:split_confirmed_size', {
                size: t(`translations:split_size_${keptSize}`),
              })
            : t('translations:split_confirmed')}
        </Text>
      ) : null}
      {/* Row 11 review: while dispatch splits the order, its line is the only clock, as those minutes
          are paid only as the split wait (cross check 2). */}
      {secondsWaiting !== null && !splitOpen ? (
        <Text style={styles.waitClock} testID="job-wait-clock">
          {order.paidFromOnPhone
            ? t('translations:waiting_clock_paid', {
                time: waitClockText(secondsWaiting),
                from: moment(order.paidFromOnPhone).format(formatShift),
              })
            : t('translations:waiting_clock', {
                time: waitClockText(secondsWaiting),
              })}
        </Text>
      ) : null}
      {jobOver ? null : (
        <ButtonSwipe
          key={swipeKey}
          style={styles.swipe}
          isSwiped={false}
          onSwiped={onSwiped}
          enabled={!leavingWait && !splitOpen}
          title={
            stage === 'pickup'
              ? t('translations:swipe_picked_up')
              : t('translations:swipe_delivered')
          }
          isLoading={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: space['4'],
    paddingTop: space['2'],
    borderTopWidth: 1,
    borderTopColor: color.border,
    gap: space['1'],
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1.5'],
  },
  waitingText: {
    ...typeScale.caption,
    color: color['muted-foreground'],
    flexShrink: 1,
  },
  refusedText: {
    ...typeScale.caption,
    color: color.destructive,
    flexShrink: 1,
  },
  waitClock: {
    ...typeScale.label,
    color: color.foreground,
  },
  swipe: {
    alignSelf: 'center',
  },
});
