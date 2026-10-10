import { canReserve, pickupDeadline, sameReservation } from './reservations.ts';
import type { CollectFailure, ReserveResult, CancelResult } from './reservations';
import type { NearbyListing, Order, OrderWithListing, PartnerOrder, PaymentMethod } from './types';

/** One in-memory store for both roles. Reloading the app resets demo data. */
export function createDemoMarketplace(seed: {
  listings: NearbyListing[]; orders: Order[]; userId: string; creditVnd: number;
}) {
  const listings = seed.listings.map((listing) => ({ ...listing, allergens: [...listing.allergens] }));
  const orders = seed.orders.map((order) => ({ ...order }));
  let creditVnd = seed.creditVnd;
  let sequence = 0;

  const listingFor = (id: string) => listings.find((listing) => listing.id === id);
  const sweep = (now: Date) => {
    for (const listing of listings) {
      if (now >= pickupDeadline(listing) && ['live', 'sold_out'].includes(listing.status)) {
        listing.status = 'expired';
      }
    }
    for (const order of orders) {
      const listing = listingFor(order.listing_id);
      if (listing && order.status === 'reserved' && now >= pickupDeadline(listing)) order.status = 'no_show';
    }
  };
  const copyListing = (listing: NearbyListing) => ({ ...listing, allergens: [...listing.allergens] });
  const asEaterOrder = (order: Order): OrderWithListing => {
    const listing = listingFor(order.listing_id)!;
    return { ...order, listing: {
      title: listing.title, photo_url: listing.photo_url,
      pickup_from: listing.pickup_from, pickup_until: listing.pickup_until,
      safety_deadline: listing.safety_deadline, prepared_at: listing.prepared_at,
      handling_class: listing.handling_class,
      restaurant: { id: listing.restaurant_id, name: listing.restaurant_name, address: listing.restaurant_address,
        lat: listing.restaurant_lat, lng: listing.restaurant_lng, pickup_instructions: null },
    } };
  };

  return {
    creditBalance: () => creditVnd,
    publish(listing: NearbyListing): NearbyListing {
      const existing = listingFor(listing.id);
      if (existing) return copyListing(existing);
      listings.unshift(copyListing(listing));
      return copyListing(listing);
    },
    nearby(radiusM: number, now = new Date()): NearbyListing[] {
      sweep(now);
      return listings.filter((listing) => canReserve(listing, now) && listing.distance_m <= radiusM)
        .sort((a, b) => pickupDeadline(a).getTime() - pickupDeadline(b).getTime()).map(copyListing);
    },
    listing(id: string, now = new Date()): NearbyListing | null {
      sweep(now);
      const listing = listingFor(id);
      return listing ? copyListing(listing) : null;
    },
    myOrders(now = new Date()): OrderWithListing[] {
      sweep(now);
      return orders.filter((order) => order.eater_id === seed.userId)
        .sort((a, b) => Date.parse(b.reserved_at) - Date.parse(a.reserved_at)).map(asEaterOrder);
    },
    partnerListings(restaurantId: string, now = new Date()): NearbyListing[] {
      sweep(now);
      return listings.filter((listing) => listing.restaurant_id === restaurantId
        && ['live', 'sold_out'].includes(listing.status)).map(copyListing);
    },
    partnerOrders(restaurantId: string, now = new Date()): PartnerOrder[] {
      sweep(now);
      return orders.filter((order) => order.status === 'reserved'
        && listingFor(order.listing_id)?.restaurant_id === restaurantId)
        .map((order) => ({ ...order, listing_title: listingFor(order.listing_id)!.title,
          eater_name: order.eater_id === seed.userId ? 'Minh' : null }));
    },
    reserve(args: { listingId: string; portions: number; paymentMethod: PaymentMethod; requestId: string },
      now = new Date()): ReserveResult {
      const previous = orders.find((order) => order.eater_id === seed.userId
        && order.reservation_request_id === args.requestId);
      if (previous) return sameReservation(previous, args.listingId, args.portions, args.paymentMethod)
        ? { ok: true, orderId: previous.id, pickupCode: previous.pickup_code }
        : { ok: false, reason: 'request_conflict' };
      const listing = listingFor(args.listingId);
      if (!listing) return { ok: false, reason: 'sold_out' };
      if (now >= pickupDeadline(listing)) return { ok: false, reason: 'past_pickup_window' };
      if (!canReserve(listing, now) || !Number.isInteger(args.portions)
        || args.portions < 1 || listing.portions_left < args.portions) return { ok: false, reason: 'sold_out' };
      if (!['cash', 'vietqr', 'credit'].includes(args.paymentMethod)) {
        return { ok: false, reason: 'unsupported_payment_method' };
      }
      const total = listing.price_vnd * args.portions;
      if (args.paymentMethod === 'credit' && creditVnd < total) return { ok: false, reason: 'insufficient_credit' };
      let code = '';
      for (let attempts = 0; attempts < 10000; attempts++) {
        code = String(++sequence % 10000).padStart(4, '0');
        if (!orders.some((order) => order.status === 'reserved' && order.pickup_code === code
          && listingFor(order.listing_id)?.restaurant_id === listing.restaurant_id)) break;
        if (attempts === 9999) return { ok: false, reason: 'unknown' };
      }
      const order: Order = { id: `demo-order-${sequence}`, listing_id: listing.id,
        eater_id: seed.userId, portions: args.portions, price_paid_vnd: total,
        payment_method: args.paymentMethod, pickup_code: code, status: 'reserved',
        reserved_at: now.toISOString(), collected_at: null,
        credit_used_vnd: args.paymentMethod === 'credit' ? total : 0,
        reservation_request_id: args.requestId };
      orders.unshift(order);
      creditVnd -= order.credit_used_vnd;
      listing.portions_left -= args.portions;
      if (listing.portions_left === 0) listing.status = 'sold_out';
      return { ok: true, orderId: order.id, pickupCode: code };
    },
    cancel(id: string, now = new Date()): CancelResult {
      const order = orders.find((candidate) => candidate.id === id && candidate.eater_id === seed.userId);
      if (!order) return { ok: false, reason: 'unknown' };
      if (order.status === 'cancelled') return { ok: true };
      if (order.status !== 'reserved') return { ok: false, reason: 'order_not_reserved' };
      const listing = listingFor(order.listing_id)!;
      if (now >= pickupDeadline(listing)) return { ok: false, reason: 'past_pickup_window' };
      order.status = 'cancelled';
      creditVnd += order.credit_used_vnd;
      listing.portions_left += order.portions;
      if (listing.status === 'sold_out') listing.status = 'live';
      return { ok: true };
    },
    collect(restaurantId: string, code: string, now = new Date(), orderId?: string):
      { ok: true; order: PartnerOrder } | { ok: false; reason: CollectFailure } {
      const matches = orders.filter((order) => order.pickup_code === code && order.status === 'reserved'
        && (!orderId || order.id === orderId)
        && listingFor(order.listing_id)?.restaurant_id === restaurantId);
      if (matches.length > 1) return { ok: false, reason: 'ambiguous_code' };
      const order = matches[0];
      if (!order || !/^\d{4}$/.test(code)) return { ok: false, reason: 'code_not_found' };
      const listing = listingFor(order.listing_id)!;
      if (now < new Date(listing.pickup_from)) return { ok: false, reason: 'pickup_not_started' };
      if (now >= pickupDeadline(listing)) return { ok: false, reason: 'past_pickup_window' };
      order.status = 'collected';
      order.collected_at = now.toISOString();
      return { ok: true, order: { ...order, listing_title: listing.title,
        eater_name: order.eater_id === seed.userId ? 'Minh' : null } };
    },
  };
}
