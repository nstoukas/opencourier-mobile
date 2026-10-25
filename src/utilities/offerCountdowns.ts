// One countdown per offer, set by the server's deadline (rows 60 and 61).
//
// Row 60 made sure each offer has at most one timer, so a refetch never
// restarts it and accept or decline goes out at most once. Row 61 (spec 0002)
// changes where the time comes from and what happens when it runs out:
//
// - The deadline is the server's `offerExpiresAt`, already moved onto the
//   phone's clock (`utilities/offerClock.ts`). It replaces row 60's "60 s from
//   the moment the phone first saw the offer" (decision 60.1).
// - At zero the phone sends nothing. The server ends the offer itself and
//   tells the phone; as a fallback the phone fetches the list once, a moment
//   after the server's grace period (`onDeadline`).
// - An offer with no deadline (Offer expiry off, or an admin's offer) has no
//   countdown. Instead it alerts the rider again every 30 s (`onReminder`)
//   until the rider answers or the offer leaves (AC-4).
//
// It still guards sending: accept or decline goes out at most once per offer,
// whether the rider tapped or the phone accepted for an auto accept rider.

import { OFFER_END_CHECK_DELAY_MS, OFFER_REMINDER_EVERY_MS } from './constants';

// What the screen knows about one offer's timing when it syncs.
export type OfferTiming = {
  id: string;
  // The server's `offeredAt` text, unchanged. Only used to tell a new offer of
  // the same delivery (it gets a new `offeredAt`) from the same offer fetched
  // again (same text), so a refetch never restarts a countdown.
  offerKey: string | null;
  // Phone clock milliseconds; null when the server did not send the time.
  offeredAt: number | null;
  // Phone clock milliseconds; null means this offer never ends by time.
  expiresAt: number | null;
};

export type OfferCountdownHandlers = {
  // The deadline and the server's grace have passed: fetch the list again to
  // see whether the server ended the offer. Never an accept or a decline.
  onDeadline: (offerId: string) => void;
  // An offer with no deadline has waited another 30 s: alert the rider.
  onReminder: (offerId: string, waitedMs: number) => void;
};

// What we remember about one offer that is on screen.
type OfferEntry = {
  offerKey: string | null;
  // When the offer was made (phone clock). If the server did not send it (an
  // offer made before the server knew about offer times), the moment the
  // phone first saw it.
  offeredAt: number;
  expiresAt: number | null;
  // The pending deadline check or next reminder; undefined when none.
  timeout?: ReturnType<typeof setTimeout>;
  // True while an accept or decline for this offer is in flight or done.
  claimed: boolean;
  // True once the phone has accepted this offer for an auto accept rider, so
  // a failed automatic accept is never sent again on its own.
  autoAccepted: boolean;
};

export class OfferCountdowns {
  private entries = new Map<string, OfferEntry>();

  // `now` is a parameter so tests can control the clock; the app uses Date.now.
  constructor(
    private readonly handlers: OfferCountdownHandlers,
    private readonly now: () => number = Date.now,
  ) {}

  // Call with the offers currently on offer, after every fetch. New offers
  // are tracked; offers already tracked keep their countdown untouched (unless
  // the server made a new offer for the same delivery); offers that
  // disappeared have their timer stopped and are forgotten.
  sync(offers: OfferTiming[]) {
    const current = new Set(offers.map(offer => offer.id));

    for (const offer of offers) {
      const entry = this.entries.get(offer.id);
      if (!entry || entry.offerKey !== offer.offerKey) {
        this.track(offer);
      }
    }

    for (const id of this.entries.keys()) {
      if (!current.has(id)) {
        this.forget(id);
      }
    }
  }

  // Milliseconds left before the offer's deadline, never below zero; null for
  // an offer with no deadline (no countdown is shown) or one not tracked.
  timeLeft(offerId: string): number | null {
    const entry = this.entries.get(offerId);
    if (!entry || entry.expiresAt === null) {
      return null;
    }
    return Math.max(0, entry.expiresAt - this.now());
  }

  // The whole length of the offer's countdown (deadline minus offered time),
  // for drawing how much of the bar is already used; null with no deadline.
  totalTime(offerId: string): number | null {
    const entry = this.entries.get(offerId);
    if (!entry || entry.expiresAt === null) {
      return null;
    }
    return Math.max(0, entry.expiresAt - entry.offeredAt);
  }

  // How long the offer has waited since it was made; null if not tracked.
  waitedTime(offerId: string): number | null {
    const entry = this.entries.get(offerId);
    if (!entry) {
      return null;
    }
    return Math.max(0, this.now() - entry.offeredAt);
  }

  // Ask permission to send accept or decline for this offer. Returns true the
  // first time only; any later call (a second tap) gets false, so the caller
  // sends nothing. Claiming also stops the offer's timer.
  claim(offerId: string): boolean {
    const entry = this.entries.get(offerId);
    if (!entry || entry.claimed) {
      return false;
    }
    entry.claimed = true;
    this.stopTimer(entry);
    return true;
  }

  // Like `claim`, for the phone accepting on behalf of an auto accept rider
  // (AC-8). True at most once per offer, ever: if that accept fails, the offer
  // goes back on screen for the rider to answer by hand, and the phone does
  // not try again by itself.
  claimForAutoAccept(offerId: string): boolean {
    const entry = this.entries.get(offerId);
    if (!entry || entry.autoAccepted) {
      return false;
    }
    if (!this.claim(offerId)) {
      return false;
    }
    entry.autoAccepted = true;
    return true;
  }

  // Undo a claim after the send failed, so the rider can try again by hand.
  // The deadline check or reminders start again: neither sends an answer, so
  // a failing network cannot loop into repeated sends.
  release(offerId: string) {
    const entry = this.entries.get(offerId);
    if (entry && entry.claimed) {
      entry.claimed = false;
      this.schedule(offerId, entry);
    }
  }

  // The offer is done with (the send succeeded, the server ended it, or it
  // left the list): forget it. If the server offers the same delivery again
  // later, that is a new offer with its own times.
  forget(offerId: string) {
    const entry = this.entries.get(offerId);
    if (entry) {
      this.stopTimer(entry);
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
      this.stopTimer(entry);
    }
    this.entries.clear();
  }

  private track(offer: OfferTiming) {
    const previous = this.entries.get(offer.id);
    if (previous) {
      this.stopTimer(previous);
    }
    const entry: OfferEntry = {
      offerKey: offer.offerKey,
      offeredAt: offer.offeredAt ?? this.now(),
      expiresAt: offer.expiresAt,
      claimed: false,
      autoAccepted: false,
    };
    this.entries.set(offer.id, entry);
    this.schedule(offer.id, entry);
  }

  // Set the one timer this offer needs: the deadline check if it has a
  // deadline, otherwise the next 30 s reminder.
  private schedule(offerId: string, entry: OfferEntry) {
    this.stopTimer(entry);
    const now = this.now();

    if (entry.expiresAt !== null) {
      const checkAt = entry.expiresAt + OFFER_END_CHECK_DELAY_MS;
      // Already past (the server should have ended it): no check, so a
      // stuck offer never turns into a loop of fetches.
      if (checkAt > now) {
        entry.timeout = setTimeout(() => {
          entry.timeout = undefined;
          this.handlers.onDeadline(offerId);
        }, checkAt - now);
      }
      return;
    }

    // Reminders fall on whole 30 s steps after the offer was made, so a
    // refetch or a failed send never shifts them.
    const waited = Math.max(0, now - entry.offeredAt);
    const steps = Math.floor(waited / OFFER_REMINDER_EVERY_MS) + 1;
    const nextAt = entry.offeredAt + steps * OFFER_REMINDER_EVERY_MS;
    entry.timeout = setTimeout(() => {
      entry.timeout = undefined;
      this.handlers.onReminder(offerId, this.now() - entry.offeredAt);
      // Still on screen and unanswered: set the next reminder.
      if (this.entries.get(offerId) === entry && !entry.claimed) {
        this.schedule(offerId, entry);
      }
    }, nextAt - now);
  }

  private stopTimer(entry: OfferEntry) {
    if (entry.timeout !== undefined) {
      clearTimeout(entry.timeout);
      entry.timeout = undefined;
    }
  }
}
