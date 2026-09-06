/**
 * Data access. Every function returns the same shape whether it is talking to
 * Supabase or to fixtures, so screens never branch on which one is live.
 */
import { hasSupabase, supabase } from './supabase';
import {
  fixtureListings,
  fixtureOrders,
  fixturePartnerListings,
  fixturePartnerOrders,
} from './fixtures';
import type {
  NearbyListing,
  NearbyStoreRow,
  OrderWithListing,
  PartnerOrder,
  PaymentMethod,
} from './types';
import type { HandlingClass } from './safety';
import { canReserveNow, freeTrackWindow } from './priority';
import { distanceMetres } from './geo';
import type { Coords } from './geo';
import { groupByStore, listingDeadline } from './stores';
import type { StoreMarker } from './stores';

/**
 * Re-exported so the many call sites that import `Coords` from here keep
 * working. It is defined in `geo.ts`, which is where the maths that uses it
 * lives and which this module depends on rather than the other way round.
 */
export type { Coords };

/**
 * Recompute a fixture's distance from wherever the caller actually is.
 *
 * The fixtures ship a hardcoded `distance_m` measured from the middle of Cầu
 * Giấy. That was fine while the only origin was the middle of Cầu Giấy, but a
 * map you can pan has a different origin every time you let go of it — and a
 * "search this area" button that returns the same five distances wherever you
 * point it is theatre. Against Supabase this is `st_distance`'s job.
 */
function atOrigin(listings: readonly NearbyListing[], origin: Coords): NearbyListing[] {
  return listings.map((listing) => ({
    ...listing,
    distance_m: distanceMetres(origin, {
      lat: listing.restaurant_lat,
      lng: listing.restaurant_lng,
    }),
  }));
}

/**
 * The fixture equivalent of the `nearby_listings` predicate: live, with
 * something left, and not yet past whichever deadline binds first. Kept in one
 * place so the two paths cannot drift — a sold-out fixture that shows up in
 * the feed on a laptop but not on a phone is the kind of difference that gets
 * noticed only in production.
 */
function collectableFixtures(now: Date): NearbyListing[] {
  return fixtureListings.filter(
    (l) =>
      l.status === 'live' &&
      l.portions_left > 0 &&
      listingDeadline(l).getTime() > now.getTime(),
  );
}

export async function fetchNearbyListings(
  origin: Coords,
  radiusM = 1500,
): Promise<NearbyListing[]> {
  if (!hasSupabase) {
    return atOrigin(collectableFixtures(new Date()), origin)
      .filter((l) => l.distance_m <= radiusM)
      .sort((a, b) => deadlineOf(a) - deadlineOf(b));
  }

  const { data, error } = await supabase.rpc('nearby_listings', {
    in_lat: origin.lat,
    in_lng: origin.lng,
    in_radius_m: radiusM,
    in_limit: 50,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as NearbyListing[];
}

/**
 * The stores to draw on the map.
 *
 * Deliberately wider than `fetchNearbyListings`: a store that has sold out
 * stays in the result, because a grey pin is information. It says this street
 * does take part and you were simply late, which is a different message from
 * an empty map — and it is the difference between coming back tomorrow and
 * deciding the app has nothing near you.
 */
export async function fetchNearbyStores(
  origin: Coords,
  radiusM = 1500,
): Promise<StoreMarker[]> {
  if (!hasSupabase) {
    const now = new Date();
    const onOffer = fixtureListings.filter(
      (l) =>
        (l.status === 'live' || l.status === 'sold_out') &&
        listingDeadline(l).getTime() > now.getTime(),
    );
    return groupByStore(atOrigin(onOffer, origin), { origin }).filter(
      (store) => store.distance_m <= radiusM,
    );
  }

  const { data, error } = await supabase.rpc('nearby_stores', {
    in_lat: origin.lat,
    in_lng: origin.lng,
    in_radius_m: radiusM,
    in_limit: 100,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as NearbyStoreRow[]).map(rowToStore);
}

/** One store and everything collectable there, for the store page. */
export async function fetchStore(
  storeId: string,
  origin: Coords,
): Promise<{ store: StoreMarker; listings: NearbyListing[] } | null> {
  const listings = await fetchStoreListings(storeId, origin);
  if (listings.length === 0) return null;
  const [store] = groupByStore(listings, { origin });
  return store ? { store, listings } : null;
}

async function fetchStoreListings(
  storeId: string,
  origin: Coords,
): Promise<NearbyListing[]> {
  if (!hasSupabase) {
    const now = new Date();
    return atOrigin(
      fixtureListings.filter(
        (l) =>
          l.restaurant_id === storeId &&
          (l.status === 'live' || l.status === 'sold_out') &&
          listingDeadline(l).getTime() > now.getTime(),
      ),
      origin,
    ).sort((a, b) => deadlineOf(a) - deadlineOf(b));
  }

  const { data, error } = await supabase.rpc('store_listings', {
    in_restaurant_id: storeId,
    in_lat: origin.lat,
    in_lng: origin.lng,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as NearbyListing[];
}

/** Map the flat RPC row onto the shape the map components consume. */
function rowToStore(row: NearbyStoreRow): StoreMarker {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    distance_m: row.distance_m,
    offerCount: row.offer_count,
    portionsLeft: row.portions_left,
    minPriceVnd: row.min_price_vnd,
    bestDiscountPercent: row.best_discount_percent,
    soonestDeadline: new Date(row.soonest_deadline),
    available: row.portions_left > 0,
    hasFree: row.has_free,
  };
}

export async function fetchListing(id: string): Promise<NearbyListing | null> {
  if (!hasSupabase) return fixtureListings.find((l) => l.id === id) ?? null;

  const { data, error } = await supabase
    .from('listings')
    .select('*, restaurant:restaurants(name, address, location)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as NearbyListing | null) ?? null;
}

export type ReserveResult =
  | { ok: true; orderId: string; pickupCode: string }
  | {
      ok: false;
      reason: 'sold_out' | 'past_pickup_window' | 'priority_window' | 'unknown';
    };

export async function reserveListing(args: {
  listingId: string;
  portions: number;
  paymentMethod: PaymentMethod;
  /**
   * Only the fixture path reads this. Against Supabase the balance is read
   * from the profile inside `reserve_listing`, because a number the client
   * sends about its own eligibility is not evidence of anything.
   */
  creditBalanceVnd: number;
}): Promise<ReserveResult> {
  if (!hasSupabase) {
    const listing = fixtureListings.find((l) => l.id === args.listingId);
    if (!listing || listing.portions_left < args.portions) {
      return { ok: false, reason: 'sold_out' };
    }
    const window = freeTrackWindow({
      priceVnd: listing.price_vnd,
      listedAt: new Date(listing.created_at),
      deadline: new Date(deadlineOf(listing)),
      now: new Date(),
    });
    if (!canReserveNow(window, args.creditBalanceVnd)) {
      return { ok: false, reason: 'priority_window' };
    }
    listing.portions_left -= args.portions;
    return { ok: true, orderId: 'demo-order', pickupCode: '0421' };
  }

  const { data, error } = await supabase.rpc('reserve_listing', {
    in_listing_id: args.listingId,
    in_portions: args.portions,
    in_payment_method: args.paymentMethod,
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('sold_out')) return { ok: false, reason: 'sold_out' };
    if (message.includes('past_pickup_window')) {
      return { ok: false, reason: 'past_pickup_window' };
    }
    if (message.includes('priority_window')) {
      return { ok: false, reason: 'priority_window' };
    }
    return { ok: false, reason: 'unknown' };
  }

  const order = data as { id: string; pickup_code: string };
  return { ok: true, orderId: order.id, pickupCode: order.pickup_code };
}

export async function fetchMyOrders(): Promise<OrderWithListing[]> {
  if (!hasSupabase) return fixtureOrders;

  const { data, error } = await supabase
    .from('orders')
    .select(
      '*, listing:listings(title, photo_url, pickup_from, pickup_until, safety_deadline, prepared_at, handling_class, restaurant:restaurants(name, address, pickup_instructions))',
    )
    .order('reserved_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OrderWithListing[];
}

// ------------------------------------------------------------------ partner

export async function fetchPartnerListings(
  restaurantId: string,
): Promise<NearbyListing[]> {
  if (!hasSupabase) return fixturePartnerListings;

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .in('status', ['live', 'sold_out'])
    .order('pickup_until', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as NearbyListing[];
}

export async function fetchPartnerOrders(
  restaurantId: string,
): Promise<PartnerOrder[]> {
  if (!hasSupabase) return fixturePartnerOrders;

  const { data, error } = await supabase
    .from('orders')
    .select('*, listing:listings!inner(title, restaurant_id), eater:profiles(full_name)')
    .eq('listing.restaurant_id', restaurantId)
    .eq('status', 'reserved')
    .order('reserved_at', { ascending: true });
  if (error) throw new Error(error.message);

  type Row = PartnerOrder & {
    listing: { title: string } | null;
    eater: { full_name: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    ...row,
    listing_title: row.listing?.title ?? '',
    eater_name: row.eater?.full_name ?? null,
  }));
}

export type PublishInput = {
  restaurantId: string;
  title: string;
  description: string | null;
  portions: number;
  priceVnd: number;
  originalPriceVnd: number | null;
  handling: HandlingClass;
  preparedAt: Date;
  pickupFrom: Date;
  pickupUntil: Date;
  isVegetarian: boolean;
  allergens: string[];
  photoUrl: string | null;
};

export async function publishListing(input: PublishInput): Promise<{ id: string }> {
  if (!hasSupabase) return { id: `demo-${Date.now()}` };

  const { data, error } = await supabase
    .from('listings')
    .insert({
      restaurant_id: input.restaurantId,
      title: input.title,
      description: input.description,
      portions_total: input.portions,
      portions_left: input.portions,
      price_vnd: input.priceVnd,
      original_price_vnd: input.originalPriceVnd,
      handling_class: input.handling,
      prepared_at: input.preparedAt.toISOString(),
      pickup_from: input.pickupFrom.toISOString(),
      pickup_until: input.pickupUntil.toISOString(),
      is_vegetarian: input.isVegetarian,
      allergens: input.allergens,
      photo_url: input.photoUrl,
      status: 'live',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string };
}

export type CollectResult =
  | { ok: true; order: PartnerOrder }
  | { ok: false; reason: 'code_not_found' | 'unknown' };

export async function collectOrder(
  restaurantId: string,
  code: string,
): Promise<CollectResult> {
  if (!hasSupabase) {
    const match = fixturePartnerOrders.find(
      (o) => o.pickup_code === code.padStart(4, '0') && o.status === 'reserved',
    );
    if (!match) return { ok: false, reason: 'code_not_found' };
    match.status = 'collected';
    return { ok: true, order: match };
  }

  const { data, error } = await supabase.rpc('collect_order', {
    in_restaurant_id: restaurantId,
    in_code: code,
  });
  if (error) {
    return {
      ok: false,
      reason: error.message?.includes('code_not_found') ? 'code_not_found' : 'unknown',
    };
  }
  return { ok: true, order: data as PartnerOrder };
}

function deadlineOf(listing: NearbyListing): number {
  return Math.min(
    new Date(listing.pickup_until).getTime(),
    new Date(listing.safety_deadline).getTime(),
  );
}
