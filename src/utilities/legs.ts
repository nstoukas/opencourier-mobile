// Spec 0046 (row 10, AC-7): an order too big for one box goes as several
// deliveries ("legs") to different riders, each paid in full. The job and the
// offer say "Leg 1 of 2", so the rider knows a colleague carries the rest to
// the same door. '' for a single delivery, or from a server that sends no legs.
export const legLine = (
  order: { legNumber?: number | null; legCount?: number | null },
  t: (key: string, options?: Record<string, unknown>) => string,
): string =>
  order.legNumber && order.legCount && order.legCount > 1
    ? t('translations:order_leg_of', {
        legNumber: order.legNumber,
        legCount: order.legCount,
      })
    : '';
