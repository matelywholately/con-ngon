/**
 * Which store to put in front of a hungry person first.
 *
 * Too Good To Go sorts by distance, price, rating or relevance. We have no
 * rating — nothing in the schema records one, and inventing a number to print
 * next to a real restaurant's name would be a lie — so the four sorts here are
 * distance, price, urgency and relevance.
 *
 * `nearby_listings` already encodes a ranking implicitly: it orders by soonest
 * deadline, on the reasoning that the food most at risk of being binned is the
 * food we most want someone to walk to. This module makes that explicit and
 * lets the person override it.
 *
 * Pure — no React, no map SDK — so the rules that decide what gets seen are
 * tested under `node --test` rather than eyeballed.
 */
import { minutesRemaining } from './safety.ts';
import type { StoreMarker } from './stores.ts';

export type StoreSort = 'relevance' | 'distance' | 'price' | 'urgency';

export const STORE_SORTS: readonly StoreSort[] = [
  'relevance',
  'distance',
  'price',
  'urgency',
];

/**
 * The walking radius relevance is measured against, in metres. Beyond this a
 * store scores nothing for proximity — not because it is worthless, but
 * because at that point the walk, not the saving, is the deciding factor.
 */
export const RELEVANCE_RADIUS_M = 1_500;

/**
 * The window in which "leaving now" is the point, in minutes. Inside it,
 * urgency counts for more the less time is left.
 */
export const RELEVANCE_URGENCY_MINUTES = 120;

/**
 * How relevance is weighted. They sum to 1, so a score is always in [0, 1]
 * and the numbers can be compared across sessions and argued about directly.
 *
 * Proximity leads because this is a pickup product on foot or by motorbike in
 * Hanoi traffic: a saving two kilometres away is not a saving. Urgency is
 * second because rescuing food before it is binned is the entire purpose.
 */
export const RELEVANCE_WEIGHTS = {
  proximity: 0.45,
  urgency: 0.25,
  discount: 0.2,
  choice: 0.1,
} as const;

/** Linear falloff from 1 at zero to 0 at `limit`. */
function falloff(value: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - value / limit));
}

/**
 * Score a store in [0, 1]. Exported because a score nobody can inspect is a
 * score nobody can debug, and because the tests assert on it directly.
 *
 * A sold-out store scores zero however close or cheap it is. It still belongs
 * on the map — a grey pin tells you not to walk there, which is useful — but
 * it never outranks somewhere with food.
 */
export function relevanceScore(
  store: StoreMarker,
  args: { now: Date },
): number {
  if (!store.available) return 0;

  const proximity = falloff(store.distance_m, RELEVANCE_RADIUS_M);

  const left = minutesRemaining(store.soonestDeadline, args.now);
  // Already gone is not urgent, it is over.
  const urgency = left <= 0 ? 0 : falloff(left, RELEVANCE_URGENCY_MINUTES);

  const discount = (store.bestDiscountPercent ?? 0) / 100;

  // More on the shelf means a wasted walk is less likely, but the returns
  // flatten fast — four options is not four times better than one.
  const choice = falloff(1 / Math.max(1, store.portionsLeft), 1);

  return (
    RELEVANCE_WEIGHTS.proximity * proximity +
    RELEVANCE_WEIGHTS.urgency * urgency +
    RELEVANCE_WEIGHTS.discount * Math.max(0, Math.min(1, discount)) +
    RELEVANCE_WEIGHTS.choice * choice
  );
}

/**
 * Sort stores for display. Returns a new array; the input is untouched.
 *
 * Every sort puts sold-out stores last regardless of how they score on the
 * chosen axis, because "nearest" meaning "nearest place with nothing in it"
 * is not an answer to the question anybody asked.
 */
export function rankStores(
  stores: readonly StoreMarker[],
  args: { now: Date; sort?: StoreSort },
): StoreMarker[] {
  const sort = args.sort ?? 'relevance';

  return [...stores].sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;

    switch (sort) {
      case 'distance':
        return a.distance_m - b.distance_m;
      case 'price':
        return a.minPriceVnd - b.minPriceVnd || a.distance_m - b.distance_m;
      case 'urgency':
        return (
          a.soonestDeadline.getTime() - b.soonestDeadline.getTime() ||
          a.distance_m - b.distance_m
        );
      case 'relevance': {
        const scored =
          relevanceScore(b, { now: args.now }) - relevanceScore(a, { now: args.now });
        // Ties break on distance, so the order is total and stable rather
        // than dependent on whatever order the rows arrived in.
        return scored !== 0 ? scored : a.distance_m - b.distance_m;
      }
    }
  });
}
