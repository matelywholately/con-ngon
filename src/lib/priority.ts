/**
 * Who may take a free portion, and when.
 *
 * The free track existed but was not actually aimed at anyone: a listing at
 * price 0 was reservable by whoever tapped first, so the fastest phone won
 * rather than the hungriest person. "Two tracks, one storefront" delivered
 * dignity at the counter and nothing at all at allocation time.
 *
 * The fix is a priority window rather than a hard gate. For the first stretch
 * of its life a free portion may only be reserved by someone the NGO has
 * funded; after that it opens to everyone. A hard gate would have been easy
 * and wrong — it would let food rot when nobody eligible is inside a walking
 * radius, and not wasting food is the entire point of the product.
 *
 * Pure — no React, no React Native — so the rule that decides who eats is
 * testable under `node --test`.
 *
 * This rule is mirrored in `supabase/migrations/0005_free_track_priority.sql`,
 * which is the authoritative copy: the client uses this to decide what to
 * *show*, the database uses its copy to decide what to *allow*. Change one and
 * you must change the other.
 */

/** How long a free portion is held for credit holders, at most. */
export const PRIORITY_MINUTES = 30;

const MINUTE_MS = 60_000;

export type FreeTrackWindow = {
  readonly isFree: boolean;
  /** When the window closes. Null when there is no window to close. */
  readonly priorityUntil: Date | null;
  /** True while only credit holders may reserve. */
  readonly inPriorityWindow: boolean;
};

/**
 * Eligibility is "the NGO has funded this person", read off their credit
 * balance rather than a separate verified flag.
 *
 * That keeps one source of truth, but it does couple priority to the purse:
 * if credits ever start being debited — today `reserve_listing` never spends
 * them — someone could lose priority on *free* food by spending credit on
 * *discounted* food, which is backwards. At that point this should become an
 * explicit verification status on the profile, separate from the balance.
 */
export function hasSupportCredit(creditBalanceVnd: number): boolean {
  return creditBalanceVnd > 0;
}

export function freeTrackWindow(args: {
  priceVnd: number;
  /** When the listing went up — the window runs from there, not from now. */
  listedAt: Date;
  /** Safety deadline or the restaurant's closing time, whichever is first. */
  deadline: Date;
  now: Date;
}): FreeTrackWindow {
  const isFree = args.priceVnd === 0;
  if (!isFree) {
    return { isFree: false, priorityUntil: null, inPriorityWindow: false };
  }

  const lifeMs = args.deadline.getTime() - args.listedAt.getTime();
  if (lifeMs <= 0) {
    return { isFree: true, priorityUntil: null, inPriorityWindow: false };
  }

  // Never hold a portion for more than half the time it has left. A meal with
  // forty minutes on it would otherwise spend most of its life unavailable to
  // most of the people who can see it.
  const windowMs = Math.min(PRIORITY_MINUTES * MINUTE_MS, Math.floor(lifeMs / 2));
  const priorityUntil = new Date(args.listedAt.getTime() + windowMs);

  return {
    isFree: true,
    priorityUntil,
    inPriorityWindow: args.now.getTime() < priorityUntil.getTime(),
  };
}

/** The whole rule, in one line, for a specific person. */
export function canReserveNow(
  window: FreeTrackWindow,
  creditBalanceVnd: number,
): boolean {
  return !window.inPriorityWindow || hasSupportCredit(creditBalanceVnd);
}
