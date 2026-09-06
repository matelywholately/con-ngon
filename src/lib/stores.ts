/**
 * Folding listings into the stores that sell them.
 *
 * The map used to drop one pin per listing, which meant a kitchen with two
 * trays left produced two pins at one address, stacked exactly on top of each
 * other. Too Good To Go pins a *store* and lets the card say how much is
 * inside, which is also the honest shape: you walk to a restaurant, not to a
 * portion.
 *
 * Pure — no React, no map SDK — so the grouping can be tested under
 * `node --test`. It is also what makes fixture mode work: with no Supabase
 * there is no `nearby_stores` RPC to call, and this reproduces its output from
 * the listings already in hand.
 */
import { distanceMetres } from './geo.ts';
import type { Coords } from './geo.ts';
import { effectiveDeadline, urgencyOf } from './safety.ts';
import type { Urgency } from './safety.ts';
import type { NearbyListing } from './types.ts';

/**
 * A store as the map draws it: identity, where it is, and an aggregate of
 * everything collectable there right now.
 */
export type StoreMarker = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_m: number;
  /** How many distinct listings are live here. */
  offerCount: number;
  /** Total portions across those listings — what "sold out" is judged on. */
  portionsLeft: number;
  /** The cheapest thing here, in đồng. Drives the "from X₫" on the card. */
  minPriceVnd: number;
  /** Deepest saving against the usual price, or null if nothing is discounted. */
  bestDiscountPercent: number | null;
  /** The soonest any of it stops being collectable. */
  soonestDeadline: Date;
  /** Whether anything is actually still available. Green pin vs grey pin. */
  available: boolean;
  /** Whether anything here is on the free track. */
  hasFree: boolean;
};

/** The deadline a listing is really judged by: safety or closing, whichever first. */
export function listingDeadline(listing: NearbyListing): Date {
  return effectiveDeadline(
    new Date(listing.prepared_at),
    listing.handling_class,
    new Date(listing.pickup_until),
  );
}

/** The urgency a store inherits from its soonest listing. */
export function storeUrgency(store: StoreMarker, now: Date): Urgency {
  return urgencyOf(store.soonestDeadline, now);
}

/**
 * Group listings by the restaurant selling them.
 *
 * Order is stable — first appearance wins — so a caller that sorted its input
 * gets a predictable result and can sort again deliberately with
 * `rankStores`. `origin` recomputes distance when given, which is what lets a
 * panned map answer "how far from *here*"; without it the listing's own
 * `distance_m` is trusted.
 */
export function groupByStore(
  listings: readonly NearbyListing[],
  options: { origin?: Coords } = {},
): StoreMarker[] {
  const byId = new Map<string, StoreMarker>();

  for (const listing of listings) {
    const coords = { lat: listing.restaurant_lat, lng: listing.restaurant_lng };
    const deadline = listingDeadline(listing);
    const collectable = listing.portions_left > 0;
    const discount =
      listing.original_price_vnd && listing.original_price_vnd > listing.price_vnd
        ? Math.floor(
            ((listing.original_price_vnd - listing.price_vnd) /
              listing.original_price_vnd) *
              100,
          )
        : null;

    const existing = byId.get(listing.restaurant_id);
    if (!existing) {
      byId.set(listing.restaurant_id, {
        id: listing.restaurant_id,
        name: listing.restaurant_name,
        address: listing.restaurant_address,
        lat: listing.restaurant_lat,
        lng: listing.restaurant_lng,
        distance_m: options.origin
          ? distanceMetres(options.origin, coords)
          : listing.distance_m,
        offerCount: 1,
        portionsLeft: listing.portions_left,
        minPriceVnd: listing.price_vnd,
        bestDiscountPercent: discount,
        soonestDeadline: deadline,
        available: collectable,
        hasFree: listing.price_vnd === 0,
      });
      continue;
    }

    existing.offerCount += 1;
    existing.portionsLeft += listing.portions_left;
    existing.available ||= collectable;
    existing.hasFree ||= listing.price_vnd === 0;
    if (listing.price_vnd < existing.minPriceVnd) existing.minPriceVnd = listing.price_vnd;
    if (discount !== null && (existing.bestDiscountPercent ?? -1) < discount) {
      existing.bestDiscountPercent = discount;
    }
    if (deadline.getTime() < existing.soonestDeadline.getTime()) {
      existing.soonestDeadline = deadline;
    }
  }

  return [...byId.values()];
}

/** Every listing belonging to one store, soonest deadline first. */
export function listingsForStore(
  listings: readonly NearbyListing[],
  storeId: string,
): NearbyListing[] {
  return listings
    .filter((l) => l.restaurant_id === storeId)
    .sort((a, b) => listingDeadline(a).getTime() - listingDeadline(b).getTime());
}

/**
 * The collection window a store advertises: the earliest anything can be
 * picked up, and the latest anything is still good. Null when it has nothing.
 */
export function storePickupWindow(
  listings: readonly NearbyListing[],
  storeId: string,
): { from: Date; until: Date } | null {
  const mine = listings.filter((l) => l.restaurant_id === storeId);
  if (mine.length === 0) return null;
  return {
    from: new Date(Math.min(...mine.map((l) => new Date(l.pickup_from).getTime()))),
    until: new Date(Math.max(...mine.map((l) => listingDeadline(l).getTime()))),
  };
}
