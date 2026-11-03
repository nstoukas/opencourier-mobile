// Spec 0023: the restaurant's ready time on the rider's phone. The job card's line (AC-7) and the
// notice when the restaurant moves it or marks the food ready (AC-6). Plain functions, so each rule
// is tested on its own; the words come from the translations.

type Translate = (key: string, options?: Record<string, unknown>) => string;

const MINUTE_MS = 60 * 1000;

// What the backend sends as JOB_READY_UPDATED, over the live connection or by push (backend
// `JobReadyUpdatedMessage`): ids, the restaurant's name and times only.
export type JobReadyUpdate = {
  deliveryId: string;
  restaurantName: string;
  readyAt: string | null;
  foodReadyAt: string | null;
  // The minutes added; null for "Food ready".
  delayMinutes: number | null;
};

// Whole minutes left, never below 1 while any time is left: "~1 min" in the last minute, then "due
// now" once it has passed (AC-7).
export const minutesLeft = (readyAtOnPhone: number, now: number): number =>
  Math.max(1, Math.ceil((readyAtOnPhone - now) / MINUTE_MS));

// The card's line: "Ready", "Preparing, ~8 min", "Preparing, due now", or '' when the order has no
// ready time (made before ready times existed). Only shown before pickup; the caller decides that.
export const readyLine = (
  order: { foodReadyAt?: string | null; readyAtOnPhone?: number | null },
  now: number,
  t: Translate,
): string => {
  if (order.foodReadyAt) {
    return t('translations:ready_ready');
  }
  if (order.readyAtOnPhone === null || order.readyAtOnPhone === undefined) {
    return '';
  }
  if (order.readyAtOnPhone <= now) {
    return t('translations:ready_due_now');
  }
  return t('translations:ready_preparing', {
    minutes: minutesLeft(order.readyAtOnPhone, now),
  });
};

// The notice's words (AC-6): "R73 Kitchen: food ready" or "R73 Kitchen: +10 min, ready in ~12 min".
// From a push the phone's own clock is all there is; a few seconds off does not change "~12 min".
export const readyNoticeText = (
  update: JobReadyUpdate,
  now: number,
  t: Translate,
): string => {
  if (update.foodReadyAt) {
    return t('translations:ready_notice_food_ready', {
      restaurant: update.restaurantName,
    });
  }
  const readyAt = update.readyAt ? Date.parse(update.readyAt) : NaN;
  if (update.delayMinutes !== null && Number.isFinite(readyAt)) {
    return t('translations:ready_notice_delay', {
      restaurant: update.restaurantName,
      delay: update.delayMinutes,
      minutes: minutesLeft(readyAt, now),
    });
  }
  return t('translations:ready_notice_changed', {
    restaurant: update.restaurantName,
  });
};

// A JOB_READY_UPDATED message read from the live connection (typed values) or a push (all strings,
// '' for unknown). Anything without a delivery id is ignored.
export const parseJobReadyUpdate = (data: unknown): JobReadyUpdate | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const d = data as Record<string, unknown>;
  const text = (value: unknown): string | null =>
    typeof value === 'string' && value !== '' ? value : null;
  const deliveryId = text(d.deliveryId);
  if (!deliveryId) {
    return null;
  }
  const delay =
    typeof d.delayMinutes === 'number'
      ? d.delayMinutes
      : typeof d.delayMinutes === 'string' && d.delayMinutes !== ''
      ? Number(d.delayMinutes)
      : null;
  return {
    deliveryId,
    restaurantName: text(d.restaurantName) ?? '',
    readyAt: text(d.readyAt),
    foodReadyAt: text(d.foodReadyAt),
    delayMinutes: delay !== null && Number.isFinite(delay) ? delay : null,
  };
};
