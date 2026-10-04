import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoMarketplace } from '../src/lib/demoMarketplace.ts';
import { canReserve, displayedOrderStatus, paymentOptions } from '../src/lib/reservations.ts';
import { fixtureListings, DEMO_USER_ID } from '../src/lib/fixtures.ts';

const now = new Date('2026-10-04T20:00:00+07:00');
const listing = { ...fixtureListings[0]!, portions_total: 2, portions_left: 2,
  price_vnd: 20_000, prepared_at: new Date(+now - 60_000).toISOString(),
  pickup_from: new Date(+now - 60_000).toISOString(),
  pickup_until: new Date(+now + 60_000).toISOString(),
  safety_deadline: new Date(+now + 120_000).toISOString() };
const makeStore = (creditVnd = 100_000) => createDemoMarketplace({
  listings: [listing], orders: [], userId: DEMO_USER_ID, creditVnd,
});
const args = { listingId: listing.id, portions: 2, paymentMethod: 'credit' as const, requestId: 'request-1' };

test('demo reserves actual portions, debits credit, and shares the exact order with both roles', () => {
  const store = makeStore();
  const result = store.reserve(args, now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(store.creditBalance(), 60_000);
  assert.equal(store.nearby(1500, now).length, 0);
  assert.equal(store.myOrders(now)[0]!.id, result.orderId);
  assert.equal(store.partnerOrders(listing.restaurant_id, now)[0]!.pickup_code, result.pickupCode);
  assert.equal(store.myOrders(now)[0]!.listing.restaurant.lat, listing.restaurant_lat);
});

test('retry returns the same order without charging or reducing stock twice', () => {
  const store = makeStore();
  const first = store.reserve(args, now);
  assert.deepEqual(store.reserve(args, now), first);
  assert.equal(store.myOrders(now).length, 1);
  assert.equal(store.creditBalance(), 60_000);
  assert.deepEqual(store.reserve({ ...args, portions: 1 }, now), { ok: false, reason: 'request_conflict' });
});

test('cancel restores credits and reopens sold-out stock exactly once', () => {
  const store = makeStore();
  const result = store.reserve(args, now);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(store.cancel(result.orderId, now), { ok: true });
  assert.deepEqual(store.cancel(result.orderId, now), { ok: true });
  assert.equal(store.creditBalance(), 100_000);
  assert.equal(store.listing(listing.id, now)!.portions_left, 2);
  assert.equal(store.listing(listing.id, now)!.status, 'live');
  assert.equal(store.partnerOrders(listing.restaurant_id, now).length, 0);
});

test('collection changes the customer order and prevents later cancellation or repeated collection', () => {
  const store = makeStore();
  const result = store.reserve(args, now);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.ok(store.collect(listing.restaurant_id, result.pickupCode, now).ok);
  assert.equal(store.myOrders(now)[0]!.status, 'collected');
  assert.equal(store.collect(listing.restaurant_id, result.pickupCode, now).ok, false);
  assert.deepEqual(store.cancel(result.orderId, now), { ok: false, reason: 'order_not_reserved' });
  assert.equal(store.creditBalance(), 60_000);
});

test('insufficient credit and unsupported wallets leave the store untouched', () => {
  const store = makeStore(30_000);
  assert.deepEqual(store.reserve(args, now), { ok: false, reason: 'insufficient_credit' });
  assert.deepEqual(store.reserve({ ...args, paymentMethod: 'momo' }, now),
    { ok: false, reason: 'unsupported_payment_method' });
  assert.equal(store.myOrders(now).length, 0);
  assert.equal(store.listing(listing.id, now)!.portions_left, 2);
  assert.equal(store.creditBalance(), 30_000);
});

test('expiry is checked on reservation, collection, cancellation, and customer display', () => {
  const store = makeStore();
  const result = store.reserve(args, now);
  assert.ok(result.ok);
  if (!result.ok) return;
  const late = new Date(+now + 60_000);
  assert.deepEqual(store.collect(listing.restaurant_id, result.pickupCode, late),
    { ok: false, reason: 'past_pickup_window' });
  assert.deepEqual(store.cancel(result.orderId, late), { ok: false, reason: 'past_pickup_window' });
  assert.equal(displayedOrderStatus(store.myOrders(now)[0]!, late), 'no_show');
  assert.equal(store.myOrders(late)[0]!.status, 'no_show');
  assert.equal(store.nearby(1500, late).length, 0);
  assert.equal(store.creditBalance(), 60_000);
});

test('future pickups can be reserved but cannot be handed over early', () => {
  const future = { ...listing, pickup_from: new Date(+now + 30_000).toISOString() };
  const store = createDemoMarketplace({ listings: [future], orders: [], userId: DEMO_USER_ID, creditVnd: 0 });
  assert.equal(canReserve(future, now), true);
  const result = store.reserve({ ...args, paymentMethod: 'cash' }, now);
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(store.collect(future.restaurant_id, result.pickupCode, now),
    { ok: false, reason: 'pickup_not_started' });
});

test('cash and VietQR settle at pickup; credits appear only for an affordable paid meal', () => {
  assert.deepEqual(paymentOptions(20_000, 20_000), ['cash', 'vietqr', 'credit']);
  assert.deepEqual(paymentOptions(20_000, 19_999), ['cash', 'vietqr']);
  assert.deepEqual(paymentOptions(0, 100_000), ['cash', 'vietqr']);
});
