import { OfferCountdowns, OfferTiming } from './offerCountdowns';

describe('OfferCountdowns', () => {
  const DURATION_MS = 60000;
  let onExpireMock: jest.Mock;

  // Compile edits for row 61 (spec 0002), no assertion changed: the
  // constructor now takes handlers, and sync takes offer timings instead of
  // ids. Each offer here gets a server deadline DURATION_MS after the clock's
  // current time, which is what these row 60 tests assumed. The row 60 tests
  // of the timer firing an answer at zero were removed with that behavior
  // (decision 61.22); agy writes the row 61 tests.
  const makeCountdowns = (
    onDeadline: (offerId: string) => void,
    now: () => number = Date.now,
  ) => new OfferCountdowns({ onDeadline, onReminder: () => undefined }, now);
  const timings = (
    ids: string[],
    now: () => number = Date.now,
  ): OfferTiming[] =>
    ids.map(id => ({
      id,
      offerKey: 'offered-at',
      offeredAt: now(),
      expiresAt: now() + DURATION_MS,
    }));

  beforeEach(() => {
    jest.useFakeTimers();
    onExpireMock = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Clause 2: Accept or decline sent at most once per offer', () => {
    it('permits claim only once when rider taps multiple times (two taps)', () => {
      const countdowns = makeCountdowns(onExpireMock);
      countdowns.sync(timings(['order-1']));

      // First tap succeeds
      const firstTap = countdowns.claim('order-1');
      expect(firstTap).toBe(true);

      // Second tap is blocked
      const secondTap = countdowns.claim('order-1');
      expect(secondTap).toBe(false);
    });

    it('cancels timer when rider claims before expiry so onExpire never fires (a tap then the timer)', () => {
      const countdowns = makeCountdowns(onExpireMock);
      countdowns.sync(timings(['order-1']));

      // Rider taps accept/decline after 10s
      jest.advanceTimersByTime(10000);
      expect(countdowns.claim('order-1')).toBe(true);

      // Timer reaches 60s deadline
      jest.advanceTimersByTime(50000);

      // onExpire must NOT be called because offer was already claimed
      expect(onExpireMock).not.toHaveBeenCalled();
    });
  });

  describe('Clause 3: Second timer prevention', () => {
    it('does not start a second timer for the same offer after several syncs with the same id', () => {
      const countdowns = makeCountdowns(onExpireMock);

      expect(jest.getTimerCount()).toBe(0);

      // First sync starts exactly one timer
      countdowns.sync(timings(['order-1']));
      expect(jest.getTimerCount()).toBe(1);

      // Multiple refetches with the same id must NOT start additional timers
      countdowns.sync(timings(['order-1']));
      countdowns.sync(timings(['order-1']));
      countdowns.sync(timings(['order-1']));

      expect(jest.getTimerCount()).toBe(1);
    });
  });

  describe('timeLeft', () => {
    it('returns 0 and never negative when deadline has passed', () => {
      let currentTime = 100000;
      const now = () => currentTime;
      const countdowns = makeCountdowns(onExpireMock, now);

      countdowns.sync(timings(['order-1'], now));
      currentTime += 70000; // 10s past 60s deadline
      expect(countdowns.timeLeft('order-1')).toBe(0);
    });
  });

  describe('isOpen', () => {
    it('is true for a tracked unclaimed offer', () => {
      const countdowns = makeCountdowns(onExpireMock);
      countdowns.sync(timings(['order-1']));
      expect(countdowns.isOpen('order-1')).toBe(true);
    });

    it('is false for an id never seen', () => {
      const countdowns = makeCountdowns(onExpireMock);
      expect(countdowns.isOpen('never-seen-order')).toBe(false);
    });

    it('is false while claimed', () => {
      const countdowns = makeCountdowns(onExpireMock);
      countdowns.sync(timings(['order-1']));
      expect(countdowns.claim('order-1')).toBe(true);
      expect(countdowns.isOpen('order-1')).toBe(false);
    });

    it('is true again after release', () => {
      const countdowns = makeCountdowns(onExpireMock);
      countdowns.sync(timings(['order-1']));
      countdowns.claim('order-1');
      expect(countdowns.isOpen('order-1')).toBe(false);

      countdowns.release('order-1');
      expect(countdowns.isOpen('order-1')).toBe(true);
    });

    it('is false after forget', () => {
      const countdowns = makeCountdowns(onExpireMock);
      countdowns.sync(timings(['order-1']));
      countdowns.claim('order-1');
      countdowns.forget('order-1');
      expect(countdowns.isOpen('order-1')).toBe(false);
    });

    it('follows the full lifecycle: unseen -> synced -> claimed -> released -> forgotten', () => {
      const countdowns = makeCountdowns(onExpireMock);

      // (1) Unseen id is not open
      expect(countdowns.isOpen('order-1')).toBe(false);

      // (2) Tracked unclaimed offer is open
      countdowns.sync(timings(['order-1']));
      expect(countdowns.isOpen('order-1')).toBe(true);

      // (3) While claimed (send in flight) is not open
      countdowns.claim('order-1');
      expect(countdowns.isOpen('order-1')).toBe(false);

      // (4) After release (failed send) is open again
      countdowns.release('order-1');
      expect(countdowns.isOpen('order-1')).toBe(true);

      // (5) After forget (successful send) is not open
      countdowns.forget('order-1');
      expect(countdowns.isOpen('order-1')).toBe(false);
    });

    it('remains false when releasing an untracked id', () => {
      const countdowns = makeCountdowns(onExpireMock);
      countdowns.release('untracked-order');
      expect(countdowns.isOpen('untracked-order')).toBe(false);
    });
  });
});
