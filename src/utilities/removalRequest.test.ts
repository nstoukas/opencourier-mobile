import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { formatCurrencyFromCents } from './currency';
import {
  canRequestRemoval,
  parseRemovalDecision,
  removalNoticeTitle,
  removalNoticeText,
  RemovalDecision,
} from './removalRequest';
import i18n from '@app/localization/i18n';

describe('removalRequest utilities (spec 0035, AC-3, AC-11)', () => {
  const t = i18n.t.bind(i18n);

  describe('canRequestRemoval (AC-3)', () => {
    const now = 1_700_000_000_000;

    it('returns false when job is over (dropped_off, canceled)', () => {
      const droppedOffOrder = {
        id: 'del-1',
        status: OrderStatus.dropped_off,
      } as unknown as Order;
      expect(canRequestRemoval(droppedOffOrder, now)).toBe(false);

      const canceledOrder = {
        id: 'del-2',
        status: OrderStatus.canceled,
      } as unknown as Order;
      expect(canRequestRemoval(canceledOrder, now)).toBe(false);
    });

    it('returns false while the free hand back window is open', () => {
      const orderInHandBack = {
        id: 'del-3',
        status: OrderStatus.accepted,
        handBackUntilOnPhone: now + 30_000,
      } as unknown as Order;
      expect(canRequestRemoval(orderInHandBack, now)).toBe(false);
    });

    it('returns true on a held job once free hand back is not on offer', () => {
      // Past hand back window
      const orderPastHandBack = {
        id: 'del-4',
        status: OrderStatus.dispatched,
        handBackUntilOnPhone: now - 1_000,
      } as unknown as Order;
      expect(canRequestRemoval(orderPastHandBack, now)).toBe(true);

      // At pickup
      const orderAtPickup = {
        id: 'del-5',
        status: OrderStatus.courier_arrived_at_pickup_location,
      } as unknown as Order;
      expect(canRequestRemoval(orderAtPickup, now)).toBe(true);

      // Picked up
      const orderPickedUp = {
        id: 'del-6',
        status: OrderStatus.picked_up,
      } as unknown as Order;
      expect(canRequestRemoval(orderPickedUp, now)).toBe(true);

      // At dropoff
      const orderAtDropoff = {
        id: 'del-7',
        status: OrderStatus.courier_arrived_at_dropoff_location,
      } as unknown as Order;
      expect(canRequestRemoval(orderAtDropoff, now)).toBe(true);
    });
  });

  describe('parseRemovalDecision (AC-11)', () => {
    it('parses valid typed decision from live connection', () => {
      const liveData = {
        deliveryId: 'del-10',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: 350,
        currencyCode: 'EUR',
      };
      const parsed = parseRemovalDecision(liveData);
      expect(parsed).toEqual({
        deliveryId: 'del-10',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: 350,
        currencyCode: 'EUR',
      });
    });

    it('parses string values from push message', () => {
      const pushData = {
        deliveryId: 'del-11',
        outcome: 'DECLINED',
        decisionNote: 'Please finish pickup',
        paid: 'false',
        payAmount: '',
        currencyCode: 'EUR',
      };
      const parsed = parseRemovalDecision(pushData);
      expect(parsed).toEqual({
        deliveryId: 'del-11',
        outcome: 'DECLINED',
        decisionNote: 'Please finish pickup',
        paid: false,
        payAmount: null,
        currencyCode: 'EUR',
      });
    });

    it('parses numeric string payAmount and boolean string paid from push', () => {
      const pushData = {
        deliveryId: 'del-12',
        outcome: 'APPROVED',
        decisionNote: '',
        paid: 'true',
        payAmount: '450',
        currencyCode: 'EUR',
      };
      const parsed = parseRemovalDecision(pushData);
      expect(parsed).toEqual({
        deliveryId: 'del-12',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: 450,
        currencyCode: 'EUR',
      });
    });

    it('returns null for null, non-object, missing deliveryId or unknown outcome', () => {
      expect(parseRemovalDecision(null)).toBeNull();
      expect(parseRemovalDecision('string')).toBeNull();
      expect(parseRemovalDecision({})).toBeNull();
      expect(
        parseRemovalDecision({ deliveryId: '', outcome: 'APPROVED' }),
      ).toBeNull();
      expect(
        parseRemovalDecision({ deliveryId: 'del-13', outcome: 'PENDING' }),
      ).toBeNull();
    });
  });

  describe('removalNoticeTitle and removalNoticeText (AC-11, decision 24.22)', () => {
    it('formats title for approved and declined outcomes', () => {
      const approved: RemovalDecision = {
        deliveryId: 'del-20',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: 350,
        currencyCode: 'EUR',
      };
      expect(removalNoticeTitle(approved, t)).toBe(
        t('translations:removal_notice_title_approved'),
      );

      const declined: RemovalDecision = {
        deliveryId: 'del-21',
        outcome: 'DECLINED',
        decisionNote: null,
        paid: false,
        payAmount: null,
        currencyCode: 'EUR',
      };
      expect(removalNoticeTitle(declined, t)).toBe(
        t('translations:removal_notice_title_declined'),
      );
    });

    it('formats declined notice text with and without note', () => {
      const declinedWithNote: RemovalDecision = {
        deliveryId: 'del-22',
        outcome: 'DECLINED',
        decisionNote: 'Moped was inspected',
        paid: false,
        payAmount: null,
        currencyCode: 'EUR',
      };
      expect(removalNoticeText(declinedWithNote, t)).toBe(
        t('translations:removal_notice_declined_with_note', {
          note: 'Moped was inspected',
        }),
      );

      const declinedWithoutNote: RemovalDecision = {
        deliveryId: 'del-23',
        outcome: 'DECLINED',
        decisionNote: null,
        paid: false,
        payAmount: null,
        currencyCode: 'EUR',
      };
      expect(removalNoticeText(declinedWithoutNote, t)).toBe(
        t('translations:removal_notice_declined'),
      );
    });

    it('formats approved notice text naming amount when paid in EUR', () => {
      const approvedPaid: RemovalDecision = {
        deliveryId: 'del-24',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: 250,
        currencyCode: 'EUR',
      };
      expect(removalNoticeText(approvedPaid, t)).toBe(
        t('translations:removal_notice_approved_paid', { amount: '€2.50' }),
      );
    });

    it('formats approved notice text naming amount with non-EUR currencyCode formatted as app formats it', () => {
      const approvedPaidUsd: RemovalDecision = {
        deliveryId: 'del-24-usd',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: 380,
        currencyCode: 'USD',
      };
      const formattedUsd = formatCurrencyFromCents(380, 'USD');
      expect(removalNoticeText(approvedPaidUsd, t)).toBe(
        t('translations:removal_notice_approved_paid', {
          amount: formattedUsd,
        }),
      );
    });

    it('formats approved notice text without amount when not paid', () => {
      const approvedUnpaid: RemovalDecision = {
        deliveryId: 'del-25',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: false,
        payAmount: null,
        currencyCode: 'EUR',
      };
      expect(removalNoticeText(approvedUnpaid, t)).toBe(
        t('translations:removal_notice_approved_not_paid'),
      );
    });

    it('formats approved notice text without amount when paid is false even if payAmount is 350', () => {
      const unpaidWithAmount: RemovalDecision = {
        deliveryId: 'del-25-amt',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: false,
        payAmount: 350,
        currencyCode: 'EUR',
      };
      const text = removalNoticeText(unpaidWithAmount, t);
      expect(text).toBe(t('translations:removal_notice_approved_not_paid'));
      expect(text).not.toContain('350');
      expect(text).not.toContain('3.50');
      expect(text).not.toContain('€');
    });

    it('formats approved notice text when paid but amount is zero', () => {
      const approvedZero: RemovalDecision = {
        deliveryId: 'del-26',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: 0,
        currencyCode: 'EUR',
      };
      expect(removalNoticeText(approvedZero, t)).toBe(
        t('translations:removal_notice_approved'),
      );
    });

    it('formats approved notice text when paid is true but payAmount is null (shows removal_notice_approved and no amount)', () => {
      const approvedNull: RemovalDecision = {
        deliveryId: 'del-27',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: null,
        currencyCode: 'EUR',
      };
      const text = removalNoticeText(approvedNull, t);
      expect(text).toBe(t('translations:removal_notice_approved'));
      expect(text).not.toContain('€');
      expect(text).not.toMatch(/\d/);
    });
  });
});
