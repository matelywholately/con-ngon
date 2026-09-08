/**
 * Food safety windows.
 *
 * This module is the reason Còn Ngon is not "an app for selling leftovers".
 * A restaurant never types a pickup deadline: it records when the food was
 * *prepared* and how it is being *held*, and the deadline is derived from
 * that. Staff cannot extend it, and a listing whose window has closed stops
 * being purchasable without anyone having to remember to pull it down.
 *
 * The numbers come from the 2-hour/4-hour rule for potentially hazardous
 * food held in the temperature danger zone (5–60 °C), as published by food
 * safety authorities (e.g. HK CFS, SA Health). Ready-to-eat food may spend a
 * cumulative maximum of 4 hours in that zone before it must be discarded.
 *
 * "Cumulative" is the important word: the clock covers prep, holding, the
 * customer's journey home, and the time before they actually eat. So we do
 * not hand out the full allowance at the counter — each handling class
 * reserves a buffer for the part of the journey we do not control.
 *
 * Pure module: no React, no React Native, no I/O. Every function takes `now`
 * so the behaviour is deterministic and testable.
 */

/** How the surplus is being held between preparation and pickup. */
export type HandlingClass = 'hot' | 'chilled' | 'ambient' | 'shelf_stable';

export type HandlingRule = {
  /** Total minutes the food may spend in the danger zone before it is unsafe. */
  readonly maxDangerZoneMinutes: number;
  /** Minutes reserved for the eater's trip home and time before eating. */
  readonly consumerBufferMinutes: number;
};

/**
 * Deliberately conservative. If a partner disagrees with a class the answer
 * is to pick the correct class, never to widen the rule.
 */
export const HANDLING_RULES: Readonly<Record<HandlingClass, HandlingRule>> = {
  /** Cooked and held hot, or cooling after service. The strictest case. */
  hot: { maxDangerZoneMinutes: 240, consumerBufferMinutes: 60 },
  /** Held at or below 5 °C for the whole period — the clock barely runs. */
  chilled: { maxDangerZoneMinutes: 1440, consumerBufferMinutes: 120 },
  /** Low-risk room-temperature goods: bread, pastry, dry baked items. */
  ambient: { maxDangerZoneMinutes: 720, consumerBufferMinutes: 60 },
  /** Sealed, shelf-stable packaging that carries its own printed expiry. */
  shelf_stable: { maxDangerZoneMinutes: 4320, consumerBufferMinutes: 0 },
};

export const MINUTE_MS = 60_000;

/**
 * How long ago the food was finished, as the partner can actually answer it.
 *
 * Nobody standing at a counter at closing time knows that the tray came off
 * the heat at 18:47. They know "about an hour ago". So the question is asked
 * as a range — and the deadline is computed from the **worst case in that
 * range**, never the best.
 *
 * That distinction is the whole point. Reading "1 giờ trước" as exactly 60
 * minutes when the partner meant "somewhere between one and two hours" hands
 * out up to an extra hour of safe life on food that only has three hours of
 * it. The person eating is the one who carries that error, and they are the
 * one with no way to check it. Taking the top of the range costs the partner
 * some sellable stock and costs the eater nothing.
 *
 * It does mean the oldest bucket leaves nothing at all for `hot` food, which
 * is correct rather than unfortunate: three-hour-old rice that has sat in the
 * danger zone is not surplus, it is waste, and `validateListing` says so.
 */
export type PreparedBucketId = 'under30' | 'under60' | 'under120' | 'under180';

export type PreparedBucket = {
  readonly id: PreparedBucketId;
  /**
   * Minutes elapsed at the pessimistic end of the range — the number the
   * deadline is actually derived from.
   */
  readonly worstCaseMinutes: number;
};

export const PREPARED_BUCKETS: readonly PreparedBucket[] = [
  { id: 'under30', worstCaseMinutes: 30 },
  { id: 'under60', worstCaseMinutes: 60 },
  { id: 'under120', worstCaseMinutes: 120 },
  { id: 'under180', worstCaseMinutes: 180 },
];

export function preparedBucket(id: PreparedBucketId): PreparedBucket {
  const bucket = PREPARED_BUCKETS.find((b) => b.id === id);
  if (!bucket) throw new Error(`unknown prepared bucket: ${id}`);
  return bucket;
}

/**
 * The `prepared_at` a bucket implies: the earliest moment the food could have
 * come off the heat, given what the partner said.
 */
export function preparedAtFromBucket(id: PreparedBucketId, now: Date): Date {
  return new Date(now.getTime() - preparedBucket(id).worstCaseMinutes * MINUTE_MS);
}

/**
 * Minutes of collectable life a bucket leaves for a handling class, at worst.
 * Zero or less means the food cannot be listed at all — which the partner
 * form uses to explain the refusal before they fill the rest of it in.
 */
export function bucketRemainingMinutes(
  id: PreparedBucketId,
  handling: HandlingClass,
): number {
  const rule = HANDLING_RULES[handling];
  const usable = rule.maxDangerZoneMinutes - rule.consumerBufferMinutes;
  return usable - preparedBucket(id).worstCaseMinutes;
}

/** Urgency of a listing, used for both sorting and colour. */
export type Urgency = 'fresh' | 'soon' | 'urgent' | 'expired';

export const URGENT_BELOW_MINUTES = 30;
export const SOON_BELOW_MINUTES = 90;

/**
 * The latest moment this food may still be *collected*, ignoring the
 * restaurant's own opening hours.
 */
export function safetyDeadline(preparedAt: Date, handling: HandlingClass): Date {
  const rule = HANDLING_RULES[handling];
  const usable = rule.maxDangerZoneMinutes - rule.consumerBufferMinutes;
  return new Date(preparedAt.getTime() + usable * MINUTE_MS);
}

/**
 * The deadline actually shown to eaters: whichever comes first, the safety
 * limit or the moment the restaurant stops handing food over.
 */
export function effectiveDeadline(
  preparedAt: Date,
  handling: HandlingClass,
  pickupUntil: Date,
): Date {
  const safety = safetyDeadline(preparedAt, handling);
  return safety.getTime() < pickupUntil.getTime() ? safety : pickupUntil;
}

/** Whole minutes left before the effective deadline. Never negative. */
export function minutesRemaining(deadline: Date, now: Date): number {
  const ms = deadline.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / MINUTE_MS);
}

export function urgencyOf(deadline: Date, now: Date): Urgency {
  const left = minutesRemaining(deadline, now);
  if (left <= 0) return 'expired';
  if (left < URGENT_BELOW_MINUTES) return 'urgent';
  if (left < SOON_BELOW_MINUTES) return 'soon';
  return 'fresh';
}

export type ListingWindow = {
  readonly safetyDeadline: Date;
  readonly effectiveDeadline: Date;
  readonly minutesRemaining: number;
  readonly urgency: Urgency;
  /** True when the food may still be sold and collected right now. */
  readonly isCollectable: boolean;
  /** True when the restaurant's own window, not safety, is the binding limit. */
  readonly limitedByOpeningHours: boolean;
};

export function listingWindow(args: {
  preparedAt: Date;
  handling: HandlingClass;
  pickupFrom: Date;
  pickupUntil: Date;
  now: Date;
}): ListingWindow {
  const { preparedAt, handling, pickupFrom, pickupUntil, now } = args;
  const safety = safetyDeadline(preparedAt, handling);
  const effective = effectiveDeadline(preparedAt, handling, pickupUntil);
  const remaining = minutesRemaining(effective, now);
  return {
    safetyDeadline: safety,
    effectiveDeadline: effective,
    minutesRemaining: remaining,
    urgency: urgencyOf(effective, now),
    isCollectable: remaining > 0 && now.getTime() >= pickupFrom.getTime(),
    limitedByOpeningHours: pickupUntil.getTime() < safety.getTime(),
  };
}

export type ListingRejection =
  | 'prepared_in_future'
  | 'already_past_safety_deadline'
  | 'window_ends_before_it_starts'
  | 'window_entirely_in_the_past';

export type ListingValidation =
  | { readonly ok: true; readonly deadline: Date }
  | { readonly ok: false; readonly reason: ListingRejection };

/**
 * Gate for publishing. Called before a listing goes live, and again server
 * side, so a stale client clock cannot push unsafe food onto the marketplace.
 */
export function validateListing(args: {
  preparedAt: Date;
  handling: HandlingClass;
  pickupFrom: Date;
  pickupUntil: Date;
  now: Date;
  /** Tolerance for clock skew between a partner's phone and the server. */
  clockSkewMinutes?: number;
}): ListingValidation {
  const { preparedAt, handling, pickupFrom, pickupUntil, now } = args;
  const skew = (args.clockSkewMinutes ?? 5) * MINUTE_MS;

  if (preparedAt.getTime() > now.getTime() + skew) {
    return { ok: false, reason: 'prepared_in_future' };
  }
  if (pickupUntil.getTime() <= pickupFrom.getTime()) {
    return { ok: false, reason: 'window_ends_before_it_starts' };
  }
  const deadline = effectiveDeadline(preparedAt, handling, pickupUntil);
  if (safetyDeadline(preparedAt, handling).getTime() <= now.getTime()) {
    return { ok: false, reason: 'already_past_safety_deadline' };
  }
  if (deadline.getTime() <= now.getTime()) {
    return { ok: false, reason: 'window_entirely_in_the_past' };
  }
  return { ok: true, deadline };
}
