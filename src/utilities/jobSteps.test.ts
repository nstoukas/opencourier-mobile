import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import {
  hasReachedStep,
  shownStatus,
  jobRank,
  JOB_STEP_LABEL_KEY,
} from './jobSteps';

describe('jobSteps utility (spec 0009, AC-2, AC-6)', () => {
  describe('jobRank and hasReachedStep', () => {
    it('ranks job statuses in forward chronological order', () => {
      expect(jobRank(OrderStatus.accepted)).toBeLessThan(
        jobRank(OrderStatus.dispatched),
      );
      expect(jobRank(OrderStatus.dispatched)).toBeLessThan(
        jobRank(OrderStatus.courier_arrived_at_pickup_location),
      );
      expect(
        jobRank(OrderStatus.courier_arrived_at_pickup_location),
      ).toBeLessThan(jobRank(OrderStatus.picked_up));
      expect(jobRank(OrderStatus.picked_up)).toBeLessThan(
        jobRank(OrderStatus.on_the_way),
      );
      expect(jobRank(OrderStatus.on_the_way)).toBeLessThan(
        jobRank(OrderStatus.courier_arrived_at_dropoff_location),
      );
      expect(
        jobRank(OrderStatus.courier_arrived_at_dropoff_location),
      ).toBeLessThan(jobRank(OrderStatus.dropped_off));

      // Non-job statuses rank as -1
      expect(jobRank(OrderStatus.canceled)).toBe(-1);
      expect(jobRank('CREATED')).toBe(-1);
      expect(jobRank(undefined)).toBe(-1);
    });

    it('hasReachedStep returns true when server status is at or past the step target', () => {
      expect(hasReachedStep(OrderStatus.dispatched, 'dispatched')).toBe(true);
      expect(hasReachedStep(OrderStatus.picked_up, 'dispatched')).toBe(true);
      expect(hasReachedStep(OrderStatus.dropped_off, 'delivered')).toBe(true);
      expect(
        hasReachedStep(
          OrderStatus.courier_arrived_at_dropoff_location,
          'arrived_at_dropoff',
        ),
      ).toBe(true);

      // Earlier status returns false
      expect(hasReachedStep(OrderStatus.accepted, 'dispatched')).toBe(false);
      expect(hasReachedStep(OrderStatus.dispatched, 'arrived_at_pickup')).toBe(
        false,
      );
      expect(hasReachedStep(OrderStatus.picked_up, 'delivered')).toBe(false);

      // Non-job status returns false
      expect(hasReachedStep(OrderStatus.canceled, 'dispatched')).toBe(false);
      expect(hasReachedStep(undefined, 'dispatched')).toBe(false);
    });
  });

  describe('shownStatus (AC-2)', () => {
    it('returns server status when there are no waiting steps', () => {
      expect(shownStatus(OrderStatus.dispatched, [])).toBe(
        OrderStatus.dispatched,
      );
    });

    it('moves shown status forward to the target of waiting steps', () => {
      // Waiting arrived_at_pickup moves ACCEPTED to courier_arrived_at_pickup_location
      expect(shownStatus(OrderStatus.accepted, ['arrived_at_pickup'])).toBe(
        OrderStatus.courier_arrived_at_pickup_location,
      );

      // Multiple waiting steps: reaches the latest target
      expect(
        shownStatus(OrderStatus.accepted, [
          'dispatched',
          'arrived_at_pickup',
          'picked_up',
        ]),
      ).toBe(OrderStatus.picked_up);

      // Waiting delivered reaches dropped_off
      expect(
        shownStatus(OrderStatus.picked_up, ['arrived_at_dropoff', 'delivered']),
      ).toBe(OrderStatus.dropped_off);
    });

    it('never steps back: server status wins when it is already later than waiting steps', () => {
      // Server already at PICKED_UP, but outbox still holds waiting dispatched
      expect(shownStatus(OrderStatus.picked_up, ['dispatched'])).toBe(
        OrderStatus.picked_up,
      );

      // Server already at dropped_off, waiting arrived_at_dropoff
      expect(shownStatus(OrderStatus.dropped_off, ['arrived_at_dropoff'])).toBe(
        OrderStatus.dropped_off,
      );
    });

    it('server CANCELED wins (never moves on if cancelled)', () => {
      // Server canceled wins over any waiting steps
      expect(
        shownStatus(OrderStatus.canceled, [
          'dispatched',
          'arrived_at_pickup',
          'picked_up',
          'delivered',
        ]),
      ).toBe(OrderStatus.canceled);

      expect(shownStatus('CANCELED', ['delivered'])).toBe('CANCELED');
    });

    it('non-job server status outside JOB_ORDER wins', () => {
      expect(shownStatus('CREATED', ['dispatched'])).toBe('CREATED');
      expect(shownStatus('FAILED', ['delivered'])).toBe('FAILED');
    });
  });

  describe('JOB_STEP_LABEL_KEY (spec 0021, review fix)', () => {
    it('maps picked_up to translations:swipe_picked_up (Picked up) and delivered to translations:swipe_delivered (Delivered)', () => {
      expect(JOB_STEP_LABEL_KEY.picked_up).toBe('translations:swipe_picked_up');
      expect(JOB_STEP_LABEL_KEY.delivered).toBe('translations:swipe_delivered');
      expect(i18n.t(JOB_STEP_LABEL_KEY.picked_up)).toBe('Picked up');
      expect(i18n.t(JOB_STEP_LABEL_KEY.delivered)).toBe('Delivered');
    });
  });
});
