import { OFFER_END_CHECK_DELAY_MS, OFFER_REMINDER_EVERY_MS } from './constants';
import { OfferCountdowns, OfferTiming } from './offerCountdowns';

describe('OfferCountdowns', () => {
  const DURATION_MS = 60000;
  let onDeadlineMock: jest.Mock;
  let onReminderMock: jest.Mock;
  let onRemindersEndedMock: jest.Mock;

  const makeCountdowns = (now: () => number = Date.now) =>
    new OfferCountdowns(
      {
        onDeadline: onDeadlineMock,
        onReminder: onReminderMock,
        onRemindersEnded: onRemindersEndedMock,
      },
      now,
    );

  const makeTiming = (
    id: string,
    options: {
      offerKey?: string | null;
      offeredAt?: number | null;
      expiresAt?: number | null;
    } = {},
    now: () => number = Date.now,
  ): OfferTiming => ({
    id,
    offerKey: options.offerKey !== undefined ? options.offerKey : 'key-1',
    offeredAt: options.offeredAt !== undefined ? options.offeredAt : now(),
    expiresAt:
      options.expiresAt !== undefined ? options.expiresAt : now() + DURATION_MS,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    onDeadlineMock = jest.fn();
    onReminderMock = jest.fn();
    onRemindersEndedMock = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Row 60 Restored: Accept or decline sent at most once per offer', () => {
    it('permits claim only once when rider taps multiple times (two taps)', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([makeTiming('order-1')]);

      // First tap succeeds
      const firstTap = countdowns.claim('order-1');
      expect(firstTap).toBe(true);

      // Second tap is blocked
      const secondTap = countdowns.claim('order-1');
      expect(secondTap).toBe(false);
    });

    it('cancels timer when rider claims before expiry so onDeadline never fires', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([makeTiming('order-1')]);

      // Rider taps accept/decline after 10s
      jest.advanceTimersByTime(10000);
      expect(countdowns.claim('order-1')).toBe(true);

      // Timer reaches and passes 60s deadline + 4s check delay
      jest.advanceTimersByTime(DURATION_MS + OFFER_END_CHECK_DELAY_MS);

      // onDeadline must NOT be called because offer was already claimed
      expect(onDeadlineMock).not.toHaveBeenCalled();
    });

    it('does not start a second timer for the same offer after several syncs with the same offerKey', () => {
      const countdowns = makeCountdowns();

      expect(jest.getTimerCount()).toBe(0);

      // First sync starts exactly one timer
      countdowns.sync([makeTiming('order-1')]);
      expect(jest.getTimerCount()).toBe(1);

      // Multiple refetches with the same id and offerKey must NOT start additional timers
      countdowns.sync([makeTiming('order-1')]);
      countdowns.sync([makeTiming('order-1')]);
      countdowns.sync([makeTiming('order-1')]);

      expect(jest.getTimerCount()).toBe(1);
    });

    it('stops the timer and never fires when an offer leaves the list on sync', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([makeTiming('order-1'), makeTiming('order-2')]);

      expect(jest.getTimerCount()).toBe(2);

      // Next fetch no longer contains order-1
      countdowns.sync([makeTiming('order-2')]);

      // Timer count drops to 1
      expect(jest.getTimerCount()).toBe(1);

      // Advance past deadline + check delay
      jest.advanceTimersByTime(DURATION_MS + OFFER_END_CHECK_DELAY_MS);

      // Only order-2 fired onDeadline; order-1 was cancelled and never fires
      expect(onDeadlineMock).toHaveBeenCalledTimes(1);
      expect(onDeadlineMock).toHaveBeenCalledWith('order-2');
      expect(countdowns.isOpen('order-1')).toBe(false);
    });

    it('failed send (release) lets a manual retry claim again', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([makeTiming('order-1')]);

      // Rider taps: claimed is true, timer is cleared
      expect(countdowns.claim('order-1')).toBe(true);
      expect(countdowns.isOpen('order-1')).toBe(false);

      // Network send fails, caller releases offer to allow retry
      countdowns.release('order-1');
      expect(countdowns.isClaimed('order-1')).toBe(false);
      expect(countdowns.isOpen('order-1')).toBe(true);

      // Manual retry can claim again
      expect(countdowns.claim('order-1')).toBe(true);
      expect(countdowns.isOpen('order-1')).toBe(false);
    });

    it('stopAll stops all pending timers and clears all tracked offers', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([
        makeTiming('order-1'),
        makeTiming('order-2'),
        makeTiming('order-3'),
      ]);

      expect(jest.getTimerCount()).toBe(3);

      countdowns.stopAll();

      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(DURATION_MS + OFFER_END_CHECK_DELAY_MS);
      expect(onDeadlineMock).not.toHaveBeenCalled();
      expect(onReminderMock).not.toHaveBeenCalled();

      expect(countdowns.timeLeft('order-1')).toBeNull();
      expect(countdowns.isOpen('order-1')).toBe(false);
    });

    it('lets a later re-offer of the same delivery id with a new offerKey start a fresh countdown', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming(
          'order-1',
          {
            offerKey: 'key-1',
            offeredAt: currentTime,
            expiresAt: currentTime + 60000,
          },
          now,
        ),
      ]);
      expect(countdowns.claim('order-1')).toBe(true);

      // Successful send: forget the offer
      countdowns.forget('order-1');
      expect(countdowns.isOpen('order-1')).toBe(false);

      // Later, backend re-offers the same delivery id with a new offerKey
      currentTime += 120000;
      countdowns.sync([
        makeTiming(
          'order-1',
          {
            offerKey: 'key-2',
            offeredAt: currentTime,
            expiresAt: currentTime + 60000,
          },
          now,
        ),
      ]);

      expect(countdowns.isOpen('order-1')).toBe(true);
      expect(countdowns.timeLeft('order-1')).toBe(60000);
      expect(jest.getTimerCount()).toBe(1);

      // Advance past deadline + 4s check delay
      currentTime += 64000;
      jest.advanceTimersByTime(64000);
      expect(onDeadlineMock).toHaveBeenCalledWith('order-1');
    });
  });

  describe('AC-9: Countdown to deadline and manual rider', () => {
    it('returns exact milliseconds left and does not reset on refetch', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      const offer = makeTiming(
        'order-1',
        {
          offerKey: 'key-1',
          offeredAt: currentTime,
          expiresAt: currentTime + 60000,
        },
        now,
      );
      countdowns.sync([offer]);
      expect(countdowns.timeLeft('order-1')).toBe(60000);
      expect(countdowns.totalTime('order-1')).toBe(60000);

      // Advance 20 seconds
      currentTime += 20000;
      jest.advanceTimersByTime(20000);
      expect(countdowns.timeLeft('order-1')).toBe(40000);

      // Refetch occurs with the same offerKey
      countdowns.sync([offer]);

      // Countdown continues from 40s remaining without resetting
      expect(countdowns.timeLeft('order-1')).toBe(40000);
    });

    it('returns 0 and never negative when deadline has passed', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming(
          'order-1',
          { offeredAt: currentTime, expiresAt: currentTime + 60000 },
          now,
        ),
      ]);
      currentTime += 70000; // 10s past deadline
      expect(countdowns.timeLeft('order-1')).toBe(0);
    });

    it('fires onDeadline 4 seconds after deadline (3s grace + 1s check delay), NOT at zero', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming(
          'order-1',
          { offeredAt: currentTime, expiresAt: currentTime + 60000 },
          now,
        ),
      ]);

      // Advance exactly to deadline (60s): onDeadline has NOT fired yet (phone sends nothing at zero)
      currentTime += 60000;
      jest.advanceTimersByTime(60000);
      expect(onDeadlineMock).not.toHaveBeenCalled();

      // Advance by 4s (the OFFER_END_CHECK_DELAY_MS): onDeadline fires
      currentTime += OFFER_END_CHECK_DELAY_MS;
      jest.advanceTimersByTime(OFFER_END_CHECK_DELAY_MS);
      expect(onDeadlineMock).toHaveBeenCalledTimes(1);
      expect(onDeadlineMock).toHaveBeenCalledWith('order-1');
    });

    it('schedules an immediate 0ms onDeadline check on first sight if deadline + 4s has already passed (M3)', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      // Offer whose deadline was 10 seconds ago (overdue past deadline + 4s grace)
      countdowns.sync([
        makeTiming(
          'order-1',
          { offeredAt: currentTime - 70000, expiresAt: currentTime - 10000 },
          now,
        ),
      ]);

      // Exactly one immediate check is scheduled (0 ms timer)
      expect(jest.getTimerCount()).toBe(1);
      jest.advanceTimersByTime(0);
      expect(onDeadlineMock).toHaveBeenCalledTimes(1);
      expect(onDeadlineMock).toHaveBeenCalledWith('order-1');
    });

    it('cancels the 0ms onDeadline check if overdue offer is claimed or forgotten before timer fires (M3)', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming(
          'order-1',
          { offeredAt: currentTime - 70000, expiresAt: currentTime - 10000 },
          now,
        ),
      ]);

      expect(jest.getTimerCount()).toBe(1);
      // Rider claims or offer is forgotten before timer fires
      expect(countdowns.claim('order-1')).toBe(true);
      expect(jest.getTimerCount()).toBe(0);

      jest.advanceTimersByTime(1000);
      expect(onDeadlineMock).not.toHaveBeenCalled();
    });

    it('does not loop into repeated checks when overdue offer is refetched with same key (M3)', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      const timing = makeTiming(
        'order-1',
        {
          offerKey: 'key-1',
          offeredAt: currentTime - 70000,
          expiresAt: currentTime - 10000,
        },
        now,
      );

      // First sync schedules and fires check
      countdowns.sync([timing]);
      jest.advanceTimersByTime(0);
      expect(onDeadlineMock).toHaveBeenCalledTimes(1);

      // Subsequent syncs with identical offerKey do not schedule again
      countdowns.sync([timing]);
      countdowns.sync([timing]);
      expect(jest.getTimerCount()).toBe(0);
      expect(onDeadlineMock).toHaveBeenCalledTimes(1);
    });

    it('does not schedule a deadline check when an overdue offer send fails and is undone via release (M3)', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming(
          'order-1',
          { offeredAt: currentTime - 70000, expiresAt: currentTime - 10000 },
          now,
        ),
      ]);

      // Advance timer so initial check fires
      jest.advanceTimersByTime(0);
      expect(onDeadlineMock).toHaveBeenCalledTimes(1);

      // Rider attempts manual accept (claims offer)
      expect(countdowns.claim('order-1')).toBe(true);

      // Send fails, undone via release (firstSight is false)
      countdowns.release('order-1');

      // No new check timer is scheduled
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(10000);
      expect(onDeadlineMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC-4: Expiry off (expiresAt is null)', () => {
    it('returns timeLeft null and totalTime null when offer has no deadline', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([makeTiming('order-1', { expiresAt: null })]);

      expect(countdowns.timeLeft('order-1')).toBeNull();
      expect(countdowns.totalTime('order-1')).toBeNull();
    });

    it('tracks waitedTime since offeredAt', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming(
          'order-1',
          { offeredAt: currentTime - 15000, expiresAt: null },
          now,
        ),
      ]);

      expect(countdowns.waitedTime('order-1')).toBe(15000);

      currentTime += 30000;
      expect(countdowns.waitedTime('order-1')).toBe(45000);
    });

    it('defaults offeredAt to phone now when server did not send offeredAt (decision 61.31)', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming('order-1', { offeredAt: null, expiresAt: null }, now),
      ]);

      // Immediately upon sighting
      expect(countdowns.waitedTime('order-1')).toBe(0);

      currentTime += 20000;
      expect(countdowns.waitedTime('order-1')).toBe(20000);
    });

    it('triggers onReminder every 30 seconds counted from offeredAt until claimed', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming('order-1', { offeredAt: currentTime, expiresAt: null }, now),
      ]);

      // 30 seconds pass: 1st reminder
      currentTime += OFFER_REMINDER_EVERY_MS;
      jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
      expect(onReminderMock).toHaveBeenCalledTimes(1);
      expect(onReminderMock).toHaveBeenLastCalledWith('order-1', 30000);

      // 60 seconds pass: 2nd reminder
      currentTime += OFFER_REMINDER_EVERY_MS;
      jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
      expect(onReminderMock).toHaveBeenCalledTimes(2);
      expect(onReminderMock).toHaveBeenLastCalledWith('order-1', 60000);

      // 90 seconds pass: 3rd reminder
      currentTime += OFFER_REMINDER_EVERY_MS;
      jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
      expect(onReminderMock).toHaveBeenCalledTimes(3);
      expect(onReminderMock).toHaveBeenLastCalledWith('order-1', 90000);

      // 120 seconds pass: 4th reminder (reaches 2 min)
      currentTime += OFFER_REMINDER_EVERY_MS;
      jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
      expect(onReminderMock).toHaveBeenCalledTimes(4);
      expect(onReminderMock).toHaveBeenLastCalledWith('order-1', 120000);

      // Claiming the offer stops subsequent reminders
      expect(countdowns.claim('order-1')).toBe(true);

      currentTime += OFFER_REMINDER_EVERY_MS * 2;
      jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS * 2);
      expect(onReminderMock).toHaveBeenCalledTimes(4);
    });

    it('stops recurring reminders when offer leaves the list', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming('order-1', { offeredAt: currentTime, expiresAt: null }, now),
      ]);

      currentTime += OFFER_REMINDER_EVERY_MS;
      jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
      expect(onReminderMock).toHaveBeenCalledTimes(1);

      // Offer disappears from next fetch
      countdowns.sync([]);

      currentTime += OFFER_REMINDER_EVERY_MS * 2;
      jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS * 2);
      expect(onReminderMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC-8: Auto accept rider (claimForAutoAccept)', () => {
    it('allows claimForAutoAccept once per offer, and rejects second call', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([makeTiming('order-1')]);

      expect(countdowns.claimForAutoAccept('order-1')).toBe(true);
      expect(countdowns.claimForAutoAccept('order-1')).toBe(false);
    });

    it('rejects claimForAutoAccept if offer is already manually claimed', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([makeTiming('order-1')]);

      // Manually claimed first
      expect(countdowns.claim('order-1')).toBe(true);

      // Auto-accept claim is rejected
      expect(countdowns.claimForAutoAccept('order-1')).toBe(false);
    });

    it('rejects claimForAutoAccept even after release, allowing only manual retry (decision 61.26)', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([makeTiming('order-1')]);

      // Auto-accept claims
      expect(countdowns.claimForAutoAccept('order-1')).toBe(true);

      // Automatic send failed -> release offer back for manual retry
      countdowns.release('order-1');

      // Subsequent auto-accept attempt must be rejected (only 1 auto attempt ever)
      expect(countdowns.claimForAutoAccept('order-1')).toBe(false);

      // But manual claim by rider succeeds
      expect(countdowns.claim('order-1')).toBe(true);
    });
  });

  describe('isOpen and lifecycle', () => {
    it('is true for tracked unclaimed offer', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([makeTiming('order-1')]);
      expect(countdowns.isOpen('order-1')).toBe(true);
    });

    it('is false for an id never seen', () => {
      const countdowns = makeCountdowns();
      expect(countdowns.isOpen('unseen')).toBe(false);
    });

    it('is false while claimed and true after release', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([makeTiming('order-1')]);
      expect(countdowns.claim('order-1')).toBe(true);
      expect(countdowns.isOpen('order-1')).toBe(false);

      countdowns.release('order-1');
      expect(countdowns.isOpen('order-1')).toBe(true);
    });

    it('is false after forget', () => {
      const countdowns = makeCountdowns();
      countdowns.sync([makeTiming('order-1')]);
      countdowns.forget('order-1');
      expect(countdowns.isOpen('order-1')).toBe(false);
    });
  });

  describe('M7: Reminder cancellation when offer ends (onRemindersEnded)', () => {
    it('notifies onRemindersEnded when an offer that rang is forgotten', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming('order-1', { offeredAt: currentTime, expiresAt: null }, now),
      ]);

      // 30s pass: reminder rings
      currentTime += OFFER_REMINDER_EVERY_MS;
      jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
      expect(onReminderMock).toHaveBeenCalledTimes(1);

      // Offer is answered or leaves: forget called
      countdowns.forget('order-1');
      expect(onRemindersEndedMock).toHaveBeenCalledTimes(1);
      expect(onRemindersEndedMock).toHaveBeenCalledWith('order-1');
    });

    it('notifies onRemindersEnded on stopAll for offers that have reminded', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming('order-1', { offeredAt: currentTime, expiresAt: null }, now),
        makeTiming('order-2', { offeredAt: currentTime, expiresAt: null }, now),
      ]);

      // Ring reminder for both
      currentTime += OFFER_REMINDER_EVERY_MS;
      jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
      expect(onReminderMock).toHaveBeenCalledTimes(2);

      // Screen unmounts -> stopAll
      countdowns.stopAll();
      expect(onRemindersEndedMock).toHaveBeenCalledTimes(2);
      expect(onRemindersEndedMock).toHaveBeenCalledWith('order-1');
      expect(onRemindersEndedMock).toHaveBeenCalledWith('order-2');
    });

    it('notifies onRemindersEnded when a newer offer of the same delivery replaces a reminded offer', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming(
          'order-1',
          { offerKey: 'key-v1', offeredAt: currentTime, expiresAt: null },
          now,
        ),
      ]);

      // Reminder rings for v1
      currentTime += OFFER_REMINDER_EVERY_MS;
      jest.advanceTimersByTime(OFFER_REMINDER_EVERY_MS);
      expect(onReminderMock).toHaveBeenCalledTimes(1);

      // Server offers same delivery again with new offeredAt/key
      currentTime += 10000;
      countdowns.sync([
        makeTiming(
          'order-1',
          { offerKey: 'key-v2', offeredAt: currentTime, expiresAt: null },
          now,
        ),
      ]);

      expect(onRemindersEndedMock).toHaveBeenCalledTimes(1);
      expect(onRemindersEndedMock).toHaveBeenCalledWith('order-1');
    });

    it('does NOT notify onRemindersEnded if the offer never rang a reminder', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(now);

      countdowns.sync([
        makeTiming('order-1', { offeredAt: currentTime, expiresAt: null }, now),
      ]);

      // Offer forgotten BEFORE 30s reminder fires
      countdowns.forget('order-1');
      expect(onRemindersEndedMock).not.toHaveBeenCalled();

      // Another offer stopped before reminder
      countdowns.sync([
        makeTiming('order-2', { offeredAt: currentTime, expiresAt: null }, now),
      ]);
      countdowns.stopAll();
      expect(onRemindersEndedMock).not.toHaveBeenCalled();
    });
  });
});
