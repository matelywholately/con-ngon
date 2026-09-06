/**
 * Search and filtering for the discover feed.
 *
 * Pure — no React, no React Native — so the rules that decide what a hungry
 * person is shown can be tested under `node --test` without a renderer.
 *
 * All of it runs on the device against the already-loaded page of listings.
 * That page is one walking radius' worth of food, which is small enough to
 * filter locally, and doing it locally means results appear as you type on a
 * bad 3G cell in a stairwell instead of after a round trip.
 */
// Explicit `.ts` extensions: this module is imported by `node --test`, whose
// ESM resolver will not guess an extension the way Metro does. Type-only
// imports are erased before Node sees them, so only value imports strictly
// need it — they all carry it here so the rule is not half-applied.
import { foldVi } from './format.ts';
import { effectiveDeadline, urgencyOf } from './safety.ts';
import type { NearbyListing } from './types.ts';

export type DiscoverFilter = 'all' | 'closing_soon' | 'cheap' | 'vegetarian';

/**
 * The ceiling for the "cheap" chip, in đồng. Roughly the price of a bowl of
 * bún at a pavement stall in Cầu Giấy, which is the comparison a user
 * actually makes.
 */
export const CHEAP_CEILING_VND = 20_000;

/** The deadline a listing is really judged by: safety or closing, whichever first. */
function deadlineOf(listing: NearbyListing): Date {
  return effectiveDeadline(
    new Date(listing.prepared_at),
    listing.handling_class,
    new Date(listing.pickup_until),
  );
}

function matchesQuery(listing: NearbyListing, foldedQuery: string): boolean {
  if (foldedQuery.length === 0) return true;
  return (
    foldVi(listing.title).includes(foldedQuery) ||
    foldVi(listing.restaurant_name).includes(foldedQuery)
  );
}

function matchesFilter(
  listing: NearbyListing,
  filter: DiscoverFilter,
  now: Date,
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'closing_soon': {
      const urgency = urgencyOf(deadlineOf(listing), now);
      // Expired listings are not "closing soon", they are gone.
      return urgency === 'urgent' || urgency === 'soon';
    }
    case 'cheap':
      return listing.price_vnd <= CHEAP_CEILING_VND;
    case 'vegetarian':
      return listing.is_vegetarian;
  }
}

/**
 * Apply the search box and the active chip.
 *
 * Under the "closing soon" chip the result is re-sorted by deadline, because
 * a list of urgent things in arbitrary order is not a useful answer to
 * "what do I have to leave for right now".
 */
export function filterListings(
  listings: readonly NearbyListing[],
  args: { query: string; filter: DiscoverFilter; now: Date },
): NearbyListing[] {
  const foldedQuery = foldVi(args.query);
  const matched = listings.filter(
    (listing) =>
      matchesQuery(listing, foldedQuery) &&
      matchesFilter(listing, args.filter, args.now),
  );

  if (args.filter !== 'closing_soon') return matched;
  return matched.sort(
    (a, b) => deadlineOf(a).getTime() - deadlineOf(b).getTime(),
  );
}
