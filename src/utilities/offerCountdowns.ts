// One countdown per offer (scope row 60).
//
// Before this, the Home screen started a brand new timer for every offer each
// time the offer list was fetched again. The countdown restarted, and the old
// timers kept running, so one offer could be accepted or declined twice.
//
// This class keeps at most one timer per offer id. The countdown starts the
// first time the app sees the offer (the backend does not send an "offered at"
// time yet) and is never restarted by a later fetch. It also guards sending:
// accept or decline goes out at most once per offer, whether the rider tapped
// or the timer fired.

// What we remember about one offer that is on screen.
type OfferEntry = {
  // The moment (ms since 1970) the countdown runs out.
  deadline: number;
  // The pending timer; undefined once it fired or was stopped.
  timeout?: ReturnType<typeof setTimeout>;
  // True while an accept or decline for this offer is in flight or done.
  claimed: boolean;
};

export class OfferCountdowns {
  private entries = new Map<string, OfferEntry>();

  // `now` is a parameter so tests can control the clock; the app uses Date.now.
  constructor(
    private readonly durationMs: number,
    private readonly onExpire: (offerId: string) => void,
    private readonly now: () => number = Date.now,
  ) {}

  // Call with the ids of the offers currently on offer, after every fetch.
  // New ids get one countdown; ids already tracked keep theirs untouched;
  // ids that disappeared have their timer stopped and are forgotten.
  sync(offerIds: string[]) {
    const current = new Set(offerIds);

    for (const id of current) {
      if (!this.entries.has(id)) {
        this.start(id);
      }
    }

    for (const [id, entry] of this.entries) {
      if (!current.has(id)) {
        if (entry.timeout !== undefined) {
          clearTimeout(entry.timeout);
        }
        this.entries.delete(id);
      }
    }
  }

  // Milliseconds left on this offer's countdown, never below zero.
  timeLeft(offerId: string): number {
    const entry = this.entries.get(offerId);
    if (!entry) {
      return 0;
    }
    return Math.max(0, entry.deadline - this.now());
  }

  // Ask permission to send accept or decline for this offer. Returns true the
  // first time only; any later call (a second tap, the timer firing after a
  // tap) gets false, so the caller sends nothing. Claiming also stops the
  // offer's timer.
  claim(offerId: string): boolean {
    const entry = this.entries.get(offerId);
    if (!entry || entry.claimed) {
      return false;
    }
    entry.claimed = true;
    if (entry.timeout !== undefined) {
      clearTimeout(entry.timeout);
      entry.timeout = undefined;
    }
    return true;
  }

  // Undo a claim after the send failed, so the rider can try again by hand.
  // The timer is NOT restarted: the automatic action fires at most once per
  // offer, so a failing network cannot loop into repeated automatic sends.
  release(offerId: string) {
    const entry = this.entries.get(offerId);
    if (entry) {
      entry.claimed = false;
    }
  }

  // The send succeeded: forget the offer. If the backend offers the same
  // delivery again later (its list of riders who declined expires), that is a
  // new offer and gets a fresh countdown.
  forget(offerId: string) {
    const entry = this.entries.get(offerId);
    if (entry?.timeout !== undefined) {
      clearTimeout(entry.timeout);
    }
    this.entries.delete(offerId);
  }

  // True while a send for this offer is in flight or done.
  isClaimed(offerId: string): boolean {
    return this.entries.get(offerId)?.claimed ?? false;
  }

  // True for an offer the rider can still answer: seen, not forgotten, and
  // no send in flight. A forgotten offer (its send succeeded) is not open,
  // even if an older fetch still lists it.
  isOpen(offerId: string): boolean {
    const entry = this.entries.get(offerId);
    return entry !== undefined && !entry.claimed;
  }

  // Stop every timer, for when the screen goes away.
  stopAll() {
    for (const entry of this.entries.values()) {
      if (entry.timeout !== undefined) {
        clearTimeout(entry.timeout);
      }
    }
    this.entries.clear();
  }

  private start(offerId: string) {
    const entry: OfferEntry = {
      deadline: this.now() + this.durationMs,
      claimed: false,
    };
    entry.timeout = setTimeout(() => {
      entry.timeout = undefined;
      this.onExpire(offerId);
    }, this.durationMs);
    this.entries.set(offerId, entry);
  }
}
