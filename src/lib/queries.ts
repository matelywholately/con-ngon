/**
 * Data access. Every function returns the same shape whether it is talking to
 * Supabase or to fixtures, so screens never branch on which one is live.
 */
import { hasSupabase, supabase } from './supabase';
import {
  fixtureListings,
  fixtureOrders,
  fixturePartnerOrders,
  DEMO_USER_ID,
} from './fixtures';
import { createDemoMarketplace } from './demoMarketplace';
import { reserveFailure } from './reservations';
import type { ReserveResult, CancelResult, CollectFailure } from './reservations';
import type {
  NearbyListing,
  OrderWithListing,
  PartnerOrder,
  PaymentMethod,
} from './types';
import type { HandlingClass } from './safety';

export type Coords = { lat: number; lng: number };

const demo = createDemoMarketplace({
  listings: fixtureListings,
  orders: [...fixtureOrders, ...fixturePartnerOrders.filter(
    (order) => !fixtureOrders.some((existing) => existing.id === order.id),
  )],
  userId: DEMO_USER_ID,
  creditVnd: 100_000,
});
export const getDemoCreditBalance = () => demo.creditBalance();

export async function fetchNearbyListings(
  origin: Coords,
  radiusM = 1500,
): Promise<NearbyListing[]> {
  if (!hasSupabase) {
    return demo.nearby(radiusM);
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
  if (!hasSupabase) return demo.listing(id);

  const { data, error } = await supabase.rpc('listing_details', { in_listing_id: id });
  if (error) throw new Error(error.message);
  return (data as NearbyListing | null) ?? null;
}

export async function reserveListing(args: {
  listingId: string;
  portions: number;
  paymentMethod: PaymentMethod;
  requestId: string;
}): Promise<ReserveResult> {
  if (!hasSupabase) {
    return demo.reserve(args);
  }

  const { data, error } = await supabase.rpc('reserve_listing', {
    in_listing_id: args.listingId,
    in_portions: args.portions,
    in_payment_method: args.paymentMethod,
    in_request_id: args.requestId,
  }).single();

  if (error) {
    return { ok: false, reason: reserveFailure(error.message ?? '') };
  }

  const order = data as { id: string; pickup_code: string };
  return { ok: true, orderId: order.id, pickupCode: order.pickup_code };
}

export async function fetchMyOrders(): Promise<OrderWithListing[]> {
  if (!hasSupabase) return demo.myOrders();

  const { data, error } = await supabase.rpc('my_orders');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OrderWithListing[];
}

export async function cancelOrder(orderId: string): Promise<CancelResult> {
  if (!hasSupabase) return demo.cancel(orderId);
  const { error } = await supabase.rpc('cancel_order', { in_order_id: orderId });
  if (!error) return { ok: true };
  return { ok: false, reason: error.message.includes('past_pickup_window')
    ? 'past_pickup_window' : error.message.includes('order_not_reserved')
      ? 'order_not_reserved' : 'unknown' };
}

// ------------------------------------------------------------------ partner

export async function fetchPartnerListings(
  restaurantId: string,
): Promise<NearbyListing[]> {
  if (!hasSupabase) return demo.partnerListings(restaurantId);

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
  if (!hasSupabase) return demo.partnerOrders(restaurantId);

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
  | { ok: false; reason: CollectFailure };

export async function collectOrder(
  restaurantId: string,
  code: string,
): Promise<CollectResult> {
  if (!hasSupabase) {
    return demo.collect(restaurantId, code);
  }

  const { data, error } = await supabase.rpc('collect_order', {
    in_restaurant_id: restaurantId,
    in_code: code,
  }).single();
  if (error) {
    const reasons: CollectFailure[] = ['code_not_found', 'past_pickup_window',
      'pickup_not_started', 'restaurant_unavailable', 'ambiguous_code'];
    return { ok: false, reason: reasons.find((reason) => error.message.includes(reason)) ?? 'unknown' };
  }
  return { ok: true, order: data as PartnerOrder };
}
