import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import ButtonSwipe from '@app/components/ButtonSwipe/ButtonSwipe';
import { Icon } from '@app/components/Icon/Icon';
import { CloudArrowUpIcon } from 'phosphor-react-native/src/icons/CloudArrowUp';
import useOrder from '@app/hooks/useOrder';
import { useHandBackCountdown } from '@app/hooks/useHandBack';
import { canHandBack } from '@app/utilities/handBackWindow';
import { isJobOver } from '@app/utilities/jobContact';
import { hasReachedStep } from '@app/utilities/jobSteps';
import { ARRIVAL_STEP } from '@app/utilities/arrival';
import { cardStageOf } from '@app/utilities/jobCard';
import { color, control, space, typeScale } from '@app/styles/theme';

type Props = {
  order: Order;
  onReportIssue: (order: Order) => void;
  // Left out when the co-op has set no dispatch number (row 72).
  onCallDispatch?: () => void;
  // Spec 0020: gives the order back inside the free window (asks first).
  onHandBack?: (order: Order) => void;
  handingBack?: boolean;
};

type SmallAction = {
  key: string;
  label: string;
  onPress: () => void;
  tone?: 'destructive';
  disabled?: boolean;
};

// The job card's pinned footer (spec 0021, AC-3, AC-5, AC-9): drawn outside the
// part of the card that scrolls, so the swipe is always in the same place,
// "Picked up" before the pickup and "Delivered" after. Above it, one row of
// small actions for the current stop. Each tap only queues steps in the outbox
// (spec 0009), so nothing here waits for the network.
export const JobFooter = ({
  order,
  onReportIssue,
  onCallDispatch,
  onHandBack,
  handingBack,
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
  if (onCallDispatch && !jobOver) {
    actions.push({
      key: 'dispatch',
      label: t('translations:call_dispatch'),
      onPress: onCallDispatch,
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
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map(action => (
            <TouchableOpacity
              key={action.key}
              style={styles.action}
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityRole="button"
              testID={`job-action-${action.key}`}>
              <Text
                style={[
                  styles.actionText,
                  action.tone === 'destructive' && styles.destructive,
                ]}>
                {action.label}
              </Text>
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
          enabled={true}
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  action: {
    minHeight: control.xl,
    justifyContent: 'center',
    paddingHorizontal: space['1'],
  },
  actionText: {
    ...typeScale.label,
    color: color.foreground,
  },
  destructive: {
    color: color.destructive,
  },
  swipe: {
    alignSelf: 'center',
  },
});
