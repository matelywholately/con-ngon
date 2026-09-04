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
  OrderWithListing,
  PartnerOrder,
  PaymentMethod,
} from './types';
import type { HandlingClass } from './safety';

export type Coords = { lat: number; lng: number };

export async function fetchNearbyListings(
  origin: Coords,
  radiusM = 1500,
): Promise<NearbyListing[]> {
  if (!hasSupabase) {
    return fixtureListings
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
  | { ok: false; reason: 'sold_out' | 'past_pickup_window' | 'unknown' };

export async function reserveListing(args: {
  listingId: string;
  portions: number;
  paymentMethod: PaymentMethod;
}): Promise<ReserveResult> {
  if (!hasSupabase) {
    const listing = fixtureListings.find((l) => l.id === args.listingId);
    if (!listing || listing.portions_left < args.portions) {
      return { ok: false, reason: 'sold_out' };
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
