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
import { useHandBackCountdown } from '@app/hooks/useHandBack';
import { useWaitClock } from '@app/hooks/useLeaveWait';
import { canHandBack } from '@app/utilities/handBackWindow';
import { canRequestRemoval } from '@app/utilities/removalRequest';
import {
  canLeaveSplit,
  canRequestSplit,
  isSplitOpen,
} from '@app/utilities/splitRequest';
import {
  canLeaveWait,
  isWaitingAtPickup,
  waitClockText,
} from '@app/utilities/waitClock';
import { isJobOver } from '@app/utilities/jobContact';
import { hasReachedStep } from '@app/utilities/jobSteps';
import { ARRIVAL_STEP } from '@app/utilities/arrival';
import { cardStageOf } from '@app/utilities/jobCard';
import { color, control, space, typeScale, radius } from '@app/styles/theme';
import moment from 'moment';
import { formatShift } from '@app/utilities/dates';

type Props = {
  order: Order;
  onReportIssue: (order: Order) => void;
  // Spec 0032: a wrong or missing product, offered only at the customer's door.
  onReportProduct?: (order: Order) => void;
  // Left out when the co-op has set no dispatch number (row 72).
  onCallDispatch?: () => void;
  // Spec 0020: gives the order back inside the free window (asks first).
  onHandBack?: (order: Order) => void;
  handingBack?: boolean;
  // Spec 0033: leaves a late order once the co-op's limit has passed (asks first).
  onLeaveWait?: (order: Order) => void;
  leavingWait?: boolean;
  // Spec 0035: opens the Request removal screen. Left out, no action.
  onRequestRemoval?: (order: Order) => void;
  // Spec 0035: takes back an open request (asks first).
  onWithdrawRemoval?: (order: Order) => void;
  // A send or a withdraw of this job's request is on its way.
  removalBusy?: boolean;
  // Spec 0047: opens the "Doesn't fit one box" screen, and leaves an order dispatch
  // did not split in time (asks first). Left out, no action.
  onRequestSplit?: (order: Order) => void;
  onLeaveSplit?: (order: Order) => void;
  // A send or a leave of this job's split request is on its way.
  splitBusy?: boolean;
  // Spec 0034 (AC-12): opens the chat with dispatch, its messages tagged with this job. Shown whether
  // or not the co-op has a dispatch number. `chatUnseen` draws the unread dot.
  onOpenChat?: (order: Order) => void;
  chatUnseen?: boolean;
};

type SmallAction = {
  key: string;
  label: string;
  onPress: () => void;
  tone?: 'destructive';
  disabled?: boolean;
  // A small dot after the label: something new to read (the chat, spec 0034).
  dot?: boolean;
};

// The job card's pinned footer (spec 0021, AC-3, AC-5, AC-9): drawn outside the
// part of the card that scrolls, so the swipe is always in the same place,
// "Picked up" before the pickup and "Delivered" after. Above it, one row of
// small actions for the current stop. Each tap only queues steps in the outbox
// (spec 0009), so nothing here waits for the network.
export const JobFooter = ({
  order,
  onReportIssue,
  onReportProduct,
  onCallDispatch,
  onHandBack,
  handingBack,
  onLeaveWait,
  leavingWait,
  onRequestRemoval,
  onWithdrawRemoval,
  removalBusy,
  onRequestSplit,
  onLeaveSplit,
  splitBusy,
  onOpenChat,
  chatUnseen,
}: Props) => {
  const { t } = useTranslation();
  const { imHere, pickedUp, delivered } = useOrder();
  const stage = cardStageOf(order.status);
  const jobOver = isJobOver(order.status);
  // The arrival at this stop is on record (on the server or waiting).
  const arrived = hasReachedStep(order.status, ARRIVAL_STEP[stage]);

  // The hand back counts down each second while its window is open.
  const handBackSeconds = useHandBackCountdown(order.handBackUntilOnPhone);
  const showHandBack = !!onHandBack && canHandBack(order, Date.now());

  // Spec 0033: the clock at the restaurant counts up each second.
  const waiting = isWaitingAtPickup(order);
  const secondsWaiting = useWaitClock(order.arrivedAtOnPhone, waiting);
  const showLeaveWait = !!onLeaveWait && canLeaveWait(order, Date.now());

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

  const actions: SmallAction[] = [];
  if (!jobOver && !arrived) {
    actions.push({
      key: 'here',
      label: t('translations:im_here'),
      onPress: () => {
        imHere(order).catch(error =>
          console.log("Could not queue I'm here", error),
        );
      },
    });
  }
  if (showHandBack) {
    actions.push({
      key: 'hand-back',
      label: t('translations:hand_back_button', { seconds: handBackSeconds }),
      onPress: () => onHandBack?.(order),
      disabled: handingBack,
    });
  }
  if (showLeaveWait) {
    actions.push({
      key: 'leave-wait',
      label: t('translations:leave_wait_button'),
      onPress: () => onLeaveWait?.(order),
      disabled: leavingWait,
    });
  }
  if (onCallDispatch && !jobOver) {
    actions.push({
      key: 'dispatch',
      label: t('translations:call_dispatch'),
      onPress: onCallDispatch,
    });
  }
  // Spec 0034 (AC-12): beside Call dispatch, and offered even with no dispatch number.
  if (onOpenChat && !jobOver) {
    actions.push({
      key: 'chat',
      label: t('translations:chat'),
      onPress: () => onOpenChat(order),
      dot: chatUnseen,
    });
  }
  // Spec 0035 (AC-3, AC-5): after the free hand back. Neither action is offered
  // while a send or a withdraw is on its way, so it cannot be sent twice.
  if (!jobOver && !removalBusy) {
    if (removalOpen && onWithdrawRemoval) {
      actions.push({
        key: 'withdraw-removal',
        label: t('translations:removal_withdraw'),
        onPress: () => onWithdrawRemoval(order),
      });
    } else if (
      !removalOpen &&
      onRequestRemoval &&
      canRequestRemoval(order, Date.now())
    ) {
      actions.push({
        key: 'request-removal',
        label: t('translations:request_removal'),
        onPress: () => onRequestRemoval(order),
      });
    }
  }
  // Spec 0047 (AC-1, AC-8): at the restaurant, "Doesn't fit one box"; once a
  // request has waited past the co-op's limit, Leave. Neither while a send is on its way.
  if (!jobOver && !splitBusy) {
    if (splitOpen && onLeaveSplit && canLeaveSplit(order, Date.now())) {
      actions.push({
        key: 'leave-split',
        label: t('translations:split_leave_button'),
        onPress: () => onLeaveSplit(order),
        tone: 'destructive',
      });
    } else if (!splitOpen && onRequestSplit && canRequestSplit(order)) {
      actions.push({
        key: 'request-split',
        label: t('translations:split_doesnt_fit'),
        onPress: () => onRequestSplit(order),
      });
    }
  }
  // Spec 0032: at the customer's door the rider can report a wrong or missing product.
  if (
    onReportProduct &&
    order.status === OrderStatus.courier_arrived_at_dropoff_location
  ) {
    actions.push({
      key: 'report-product',
      label: t('translations:report_product'),
      onPress: () => onReportProduct(order),
    });
  }
  if (!jobOver) {
    actions.push({
      key: 'report',
      label: t('translations:report_issue'),
      onPress: () => onReportIssue(order),
      tone: 'destructive',
    });
  }

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
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map(action => (
            <TouchableOpacity
              key={action.key}
              style={styles.action}
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityRole="button"
              accessibilityLabel={
                action.dot
                  ? `${action.label}, ${t('translations:chat_unread')}`
                  : undefined
              }
              testID={`job-action-${action.key}`}>
              <View style={styles.actionLabel}>
                <Text
                  style={[
                    styles.actionText,
                    action.tone === 'destructive' && styles.destructive,
                  ]}>
                  {action.label}
                </Text>
                {action.dot ? (
                  <View
                    style={styles.dot}
                    testID={`job-action-${action.key}-dot`}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
  // Two per row, each centred in its half; a link alone on its row takes the
  // whole width and is centred there (operator, 23 Nov: centred text in every button).
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  action: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: control.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['1'],
  },
  // flexShrink: a long Greek label wraps, centred, inside its half.
  actionText: {
    ...typeScale.label,
    color: color.foreground,
    textAlign: 'center',
    flexShrink: 1,
  },
  destructive: {
    color: color.destructive,
  },
  actionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: color.destructive,
  },
  swipe: {
    alignSelf: 'center',
  },
});
