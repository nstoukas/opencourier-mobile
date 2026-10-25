import { OfferCountdowns } from './offerCountdowns';

describe('OfferCountdowns', () => {
  const DURATION_MS = 60000;
  let onExpireMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    onExpireMock = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Clause 1: Countdown never restarts on refetch', () => {
    it('keeps counting down from the first sighting across refetches without resetting to 60s', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = new OfferCountdowns(DURATION_MS, onExpireMock, now);

      // First sighting: countdown starts with full 60s
      countdowns.sync(['order-1']);
      expect(countdowns.timeLeft('order-1')).toBe(60000);

      // Advance clock and fake timers by 20 seconds
      currentTime += 20000;
      jest.advanceTimersByTime(20000);
      expect(countdowns.timeLeft('order-1')).toBe(40000);

      // Refetch occurs (sync called again with the same id)
      countdowns.sync(['order-1']);

      // Time left must continue counting down (40s), not jump back to 60s
      expect(countdowns.timeLeft('order-1')).toBe(40000);

      // Advance by remaining 40 seconds
      currentTime += 40000;
      jest.advanceTimersByTime(40000);

      // Timer expires exactly 60s after first sighting
      expect(onExpireMock).toHaveBeenCalledTimes(1);
      expect(onExpireMock).toHaveBeenCalledWith('order-1');
      expect(countdowns.timeLeft('order-1')).toBe(0);
    });
  });

  describe('Clause 2: Accept or decline sent at most once per offer', () => {
    it('permits claim only once when rider taps multiple times (two taps)', () => {
      const countdowns = new OfferCountdowns(DURATION_MS, onExpireMock);
      countdowns.sync(['order-1']);

      // First tap succeeds
      const firstTap = countdowns.claim('order-1');
      expect(firstTap).toBe(true);

      // Second tap is blocked
      const secondTap = countdowns.claim('order-1');
      expect(secondTap).toBe(false);
    });

    it('cancels timer when rider claims before expiry so onExpire never fires (a tap then the timer)', () => {
      const countdowns = new OfferCountdowns(DURATION_MS, onExpireMock);
      countdowns.sync(['order-1']);

      // Rider taps accept/decline after 10s
      jest.advanceTimersByTime(10000);
      expect(countdowns.claim('order-1')).toBe(true);

      // Timer reaches 60s deadline
      jest.advanceTimersByTime(50000);

      // onExpire must NOT be called because offer was already claimed
      expect(onExpireMock).not.toHaveBeenCalled();
    });

    it('rejects subsequent claim if timer expiration handler already claimed it (timer firing before tap)', () => {
      let countdowns: OfferCountdowns;
      countdowns = new OfferCountdowns(DURATION_MS, id => {
        onExpireMock(id);
        countdowns.claim(id);
      });
      countdowns.sync(['order-1']);

      // Timer runs out and expires, expiration handler claims the offer
      jest.advanceTimersByTime(60000);
      expect(onExpireMock).toHaveBeenCalledWith('order-1');

      // Subsequent tap attempt by rider is rejected because offer is already claimed
      expect(countdowns.claim('order-1')).toBe(false);
    });

    it('fires onExpire at most once even after several refetches before expiry', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = new OfferCountdowns(DURATION_MS, onExpireMock, now);

      countdowns.sync(['order-1']);

      // Refetch at 15s
      currentTime += 15000;
      jest.advanceTimersByTime(15000);
      countdowns.sync(['order-1']);

      // Refetch at 30s
      currentTime += 15000;
      jest.advanceTimersByTime(15000);
      countdowns.sync(['order-1']);

      // Refetch at 45s
      currentTime += 15000;
      jest.advanceTimersByTime(15000);
      countdowns.sync(['order-1']);

      // Complete the remaining 15s to reach 60s total
      currentTime += 15000;
      jest.advanceTimersByTime(15000);

      expect(onExpireMock).toHaveBeenCalledTimes(1);
      expect(onExpireMock).toHaveBeenCalledWith('order-1');

      // Further time passage produces no extra calls
      currentTime += 30000;
      jest.advanceTimersByTime(30000);
      expect(onExpireMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Clause 3: Second timer prevention', () => {
    it('does not start a second timer for the same offer after several syncs with the same id', () => {
      const countdowns = new OfferCountdowns(DURATION_MS, onExpireMock);

      expect(jest.getTimerCount()).toBe(0);

      // First sync starts exactly one timer
      countdowns.sync(['order-1']);
      expect(jest.getTimerCount()).toBe(1);

      // Multiple refetches with the same id must NOT start additional timers
      countdowns.sync(['order-1']);
      countdowns.sync(['order-1']);
      countdowns.sync(['order-1']);

      expect(jest.getTimerCount()).toBe(1);
    });
  });

  describe('Offers leaving the list', () => {
    it('stops the timer and never fires onExpire when offer leaves the list', () => {
      const countdowns = new OfferCountdowns(DURATION_MS, onExpireMock);
      countdowns.sync(['order-1', 'order-2']);

      expect(jest.getTimerCount()).toBe(2);

      // Next fetch no longer contains order-1
      countdowns.sync(['order-2']);

      // Live timer count drops to 1
      expect(jest.getTimerCount()).toBe(1);

      // Advance past 60s
      jest.advanceTimersByTime(60000);

      // Only order-2 fires; order-1 was cancelled and never fires
      expect(onExpireMock).toHaveBeenCalledTimes(1);
      expect(onExpireMock).toHaveBeenCalledWith('order-2');
      expect(countdowns.timeLeft('order-1')).toBe(0);
    });
  });

  describe('Failed send (release)', () => {
    it('lets a manual retry through but does not restart the automatic timer', () => {
      const countdowns = new OfferCountdowns(DURATION_MS, onExpireMock);
      countdowns.sync(['order-1']);

      // Rider taps: claimed is true, timer is cleared
      expect(countdowns.claim('order-1')).toBe(true);
      expect(jest.getTimerCount()).toBe(0);

      // Network send fails, caller releases offer to allow retry
      countdowns.release('order-1');
      expect(countdowns.isClaimed('order-1')).toBe(false);

      // Timer must NOT be restarted
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(60000);
      expect(onExpireMock).not.toHaveBeenCalled();

      // Manual retry can now claim again
      expect(countdowns.claim('order-1')).toBe(true);
    });
  });

  describe('Forget after successful send', () => {
    it('lets a later re-offer of the same id start a fresh countdown', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = new OfferCountdowns(DURATION_MS, onExpireMock, now);

      countdowns.sync(['order-1']);
      expect(countdowns.claim('order-1')).toBe(true);

      // Successful send: forget the offer
      countdowns.forget('order-1');
      expect(countdowns.timeLeft('order-1')).toBe(0);
      expect(countdowns.isClaimed('order-1')).toBe(false);

      // Much later, the backend re-offers the same delivery id
      currentTime += 120000;
      countdowns.sync(['order-1']);

      // Fresh countdown starts from full duration
      expect(countdowns.timeLeft('order-1')).toBe(60000);
      expect(jest.getTimerCount()).toBe(1);

      // Advance by 60s: onExpire fires for the re-offered order
      currentTime += 60000;
      jest.advanceTimersByTime(60000);
      expect(onExpireMock).toHaveBeenCalledWith('order-1');
    });
  });

  describe('stopAll', () => {
    it('stops all pending timers and clears all tracked offers', () => {
      const countdowns = new OfferCountdowns(DURATION_MS, onExpireMock);
      countdowns.sync(['order-1', 'order-2', 'order-3']);

      expect(jest.getTimerCount()).toBe(3);

      countdowns.stopAll();

      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(60000);
      expect(onExpireMock).not.toHaveBeenCalled();

      expect(countdowns.timeLeft('order-1')).toBe(0);
      expect(countdowns.timeLeft('order-2')).toBe(0);
      expect(countdowns.timeLeft('order-3')).toBe(0);
    });
  });

  describe('timeLeft', () => {
    it('returns 0 for untracked offer id', () => {
      const countdowns = new OfferCountdowns(DURATION_MS, onExpireMock);
      expect(countdowns.timeLeft('unknown-order')).toBe(0);
    });

    it('returns 0 and never negative when deadline has passed', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = new OfferCountdowns(DURATION_MS, onExpireMock, now);

      countdowns.sync(['order-1']);
      currentTime += 70000; // 10s past 60s deadline
      expect(countdowns.timeLeft('order-1')).toBe(0);
    });
  });
});
