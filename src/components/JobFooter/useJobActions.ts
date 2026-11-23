import { useTranslation } from 'react-i18next';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
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
import { canLeaveWait, isWaitingAtPickup } from '@app/utilities/waitClock';
import { isJobOver } from '@app/utilities/jobContact';
import { hasReachedStep } from '@app/utilities/jobSteps';
import { ARRIVAL_STEP } from '@app/utilities/arrival';
import { cardStageOf } from '@app/utilities/jobCard';

// What a job's actions need from Home: each handler, and whether a send is on its way.
export type JobActionProps = {
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
  // Spec 0035: opens the Request removal screen, and takes back an open request (asks first).
  onRequestRemoval?: (order: Order) => void;
  onWithdrawRemoval?: (order: Order) => void;
  // A send or a withdraw of this job's request is on its way.
  removalBusy?: boolean;
  // Spec 0047: opens the "Doesn't fit one box" screen, and leaves an order dispatch
  // did not split in time (asks first).
  onRequestSplit?: (order: Order) => void;
  onLeaveSplit?: (order: Order) => void;
  // A send or a leave of this job's split request is on its way.
  splitBusy?: boolean;
  // Spec 0034 (AC-12): opens the chat with dispatch, its messages tagged with this job.
  // `chatUnseen` draws the unread dot.
  onOpenChat?: (order: Order) => void;
  chatUnseen?: boolean;
};

export type JobAction = {
  key: string;
  label: string;
  onPress: () => void;
  tone?: 'destructive';
  disabled?: boolean;
  // A small dot: something new to read (the chat, spec 0034).
  dot?: boolean;
};

// The actions that open only for a while: the free hand back, and leaving a late restaurant
// or an order dispatch has not split. The job's ⋯ button shows a dot while one is open, so a
// rider does not miss it behind the button (row 138).
const TIMED_ACTIONS = ['hand-back', 'leave-wait', 'leave-split'];

// The job's small actions for the current stop (spec 0021, AC-9), in the order the footer
// listed them before row 138 moved them behind the ⋯ button beside the address.
export const useJobActions = ({
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
}: JobActionProps): {
  actions: JobAction[];
  // True while a timed action is open, or the chat has something unread.
  attention: boolean;
  // Which kind, for the screen reader: an action open for a short time, or an unread message.
  attentionKind: 'timed' | 'unread' | null;
} => {
  const { t } = useTranslation();
  const { imHere } = useOrder();
  const stage = cardStageOf(order.status);
  const jobOver = isJobOver(order.status);
  // The arrival at this stop is on record (on the server or waiting).
  const arrived = hasReachedStep(order.status, ARRIVAL_STEP[stage]);
  // The hand back counts down each second while its window is open.
  const handBackSeconds = useHandBackCountdown(order.handBackUntilOnPhone);
  const showHandBack = !!onHandBack && canHandBack(order, Date.now());
  const showLeaveWait = !!onLeaveWait && canLeaveWait(order, Date.now());
  const removalOpen = order.removalRequest?.status === 'OPEN';
  const splitOpen = isSplitOpen(order);
  // Draw again each second while waiting at the restaurant or for a split, as the footer did, so
  // Leave (and the button's dot) appears by itself when its time comes (row 138, a bug the tests found).
  useWaitClock(order.arrivedAtOnPhone, isWaitingAtPickup(order));
  useWaitClock(order.splitCreatedAtOnPhone, splitOpen);

  const actions: JobAction[] = [];
  // Row 138 (operator, 23 Nov): only on the way to and at the restaurant, where the arrival starts
  // the paid wait (spec 0033) and the phone may have missed it. At the customer the Delivered swipe
  // records the arrival itself, and nothing is paid from it.
  if (!jobOver && !arrived && stage === 'pickup') {
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

  const timed = actions.some(action => TIMED_ACTIONS.includes(action.key));
  const attentionKind = timed ? 'timed' : chatUnseen ? 'unread' : null;
  return { actions, attention: attentionKind !== null, attentionKind };
};
