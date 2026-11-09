// Spec 0035: a rider asks dispatch to take them off an order. The small rules, as plain functions so
// each can be tested on its own; the words come from the translations.

import { Order } from '@app/types/types';
import { canHandBack } from './handBackWindow';
import { isJobOver } from './jobContact';
import { formatCurrencyFromCents } from './currency';

type Translate = (key: string, options?: Record<string, unknown>) => string;

// What the backend sends as REMOVAL_REQUEST_DECIDED, over the live connection or by push
// (backend `RemovalRequestDecidedMessage`).
export type RemovalDecision = {
  deliveryId: string;
  outcome: 'APPROVED' | 'DECLINED';
  // Dispatch's sentence on a refusal; null when they wrote none.
  decisionNote: string | null;
  paid: boolean;
  // Cents, fixed at the approval; null when the reason is not paid.
  payAmount: number | null;
  currencyCode: string;
};

// AC-3: on a job the rider holds, whenever the free hand back is not on offer. The server neither
// checks the window nor limits requests (decision 24.10): this is only what the screen offers.
export const canRequestRemoval = (order: Order, now: number): boolean =>
  !isJobOver(order.status) && !canHandBack(order, now);

// A REMOVAL_REQUEST_DECIDED message from the live connection (typed values) or a push (all strings,
// '' for unknown). Anything without a delivery id or a known outcome is ignored.
export const parseRemovalDecision = (data: unknown): RemovalDecision | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const d = data as Record<string, unknown>;
  const text = (value: unknown): string | null =>
    typeof value === 'string' && value !== '' ? value : null;
  const deliveryId = text(d.deliveryId);
  if (!deliveryId || (d.outcome !== 'APPROVED' && d.outcome !== 'DECLINED')) {
    return null;
  }
  const amount =
    typeof d.payAmount === 'number'
      ? d.payAmount
      : typeof d.payAmount === 'string' && d.payAmount !== ''
      ? Number(d.payAmount)
      : null;
  return {
    deliveryId,
    outcome: d.outcome,
    decisionNote: text(d.decisionNote),
    paid: d.paid === true || d.paid === 'true',
    payAmount: amount !== null && Number.isFinite(amount) ? amount : null,
    currencyCode: text(d.currencyCode) ?? '',
  };
};

export const removalNoticeTitle = (
  decision: RemovalDecision,
  t: Translate,
): string =>
  t(
    decision.outcome === 'APPROVED'
      ? 'translations:removal_notice_title_approved'
      : 'translations:removal_notice_title_declined',
  );

// The notice's words (AC-11). A paid approval names the amount; a refusal gives dispatch's sentence.
export const removalNoticeText = (
  decision: RemovalDecision,
  t: Translate,
): string => {
  if (decision.outcome === 'DECLINED') {
    return decision.decisionNote
      ? t('translations:removal_notice_declined_with_note', {
          note: decision.decisionNote,
        })
      : t('translations:removal_notice_declined');
  }
  if (!decision.paid) {
    return t('translations:removal_notice_approved_not_paid');
  }
  return decision.payAmount !== null && decision.payAmount > 0
    ? t('translations:removal_notice_approved_paid', {
        amount: formatCurrencyFromCents(
          decision.payAmount,
          decision.currencyCode || undefined,
        ),
      })
    : t('translations:removal_notice_approved');
};
