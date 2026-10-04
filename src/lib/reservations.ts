import type { Listing, Order, OrderStatus, OrderWithListing, PaymentMethod } from './types';

export type ReserveFailure =
  | 'sold_out' | 'past_pickup_window' | 'insufficient_credit'
  | 'restaurant_unavailable' | 'unsupported_payment_method'
  | 'not_authenticated' | 'request_conflict' | 'unknown';
export type ReserveResult =
  | { ok: true; orderId: string; pickupCode: string }
  | { ok: false; reason: ReserveFailure };
export type CancelResult =
  | { ok: true }
  | { ok: false; reason: 'past_pickup_window' | 'order_not_reserved' | 'unknown' };
export type CollectFailure =
  | 'code_not_found' | 'past_pickup_window' | 'pickup_not_started'
  | 'restaurant_unavailable' | 'ambiguous_code' | 'unknown';

export function reserveFailure(message: string): ReserveFailure {
  const reasons: ReserveFailure[] = ['sold_out', 'past_pickup_window',
    'insufficient_credit', 'restaurant_unavailable', 'unsupported_payment_method',
    'not_authenticated', 'request_conflict'];
  return reasons.find((reason) => message.includes(reason)) ?? 'unknown';
}

export function pickupDeadline(listing: Pick<Listing, 'pickup_until' | 'safety_deadline'>): Date {
  return new Date(Math.min(Date.parse(listing.pickup_until), Date.parse(listing.safety_deadline)));
}

export function canReserve(listing: Listing, now: Date): boolean {
  return listing.status === 'live' && listing.portions_left > 0
    && now.getTime() < pickupDeadline(listing).getTime();
}

/** Derive expiry even if the scheduled sweep has not run yet. */
export function displayedOrderStatus(order: OrderWithListing, now: Date): OrderStatus {
  return order.status === 'reserved' && now.getTime() >= pickupDeadline(order.listing).getTime()
    ? 'no_show' : order.status;
}

export function paymentOptions(totalVnd: number, creditVnd: number): PaymentMethod[] {
  return totalVnd > 0 && creditVnd >= totalVnd ? ['cash', 'vietqr', 'credit'] : ['cash', 'vietqr'];
}

export function sameReservation(
  order: Order, listingId: string, portions: number, method: PaymentMethod,
): boolean {
  return order.listing_id === listingId && order.portions === portions && order.payment_method === method;
}
