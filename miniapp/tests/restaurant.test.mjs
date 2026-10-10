import test from 'node:test';
import assert from 'node:assert/strict';
import { listingInput, vietnamTimeInput, readPendingListing, savePendingListing, clearPendingListing } from '../src/restaurant.ts';
import { pickupAreas } from '../src/catalog.ts';
import { createDemoMarketplace } from '../../src/lib/demoMarketplace.ts';
import { fixtureListings } from '../../src/lib/fixtures.ts';

const now = new Date('2026-10-10T05:00:00Z');
const id = '12345678-1234-4234-8234-123456789012';
const draft = { title: ' Cơm rau ', description: ' Một phần ', portions: '3', price: '15000', originalPrice: '30000',
  handling: 'hot', preparedAt: '2026-10-10T11:30', pickupUntil: '2026-10-10T18:00',
  vegetarian: true, allergens: ' sữa, đậu phộng, ', photoUrl: 'https://example.com/meal.jpg' };

test('listing input uses integer đồng, Vietnam times and the existing safety cap', () => {
  assert.equal(vietnamTimeInput(now), '2026-10-10T12:00');
  const input = listingInput(draft, 'restaurant', id, now);
  assert.equal(input.title, 'Cơm rau'); assert.equal(input.price_vnd, 15000);
  assert.equal(input.prepared_at, '2026-10-10T04:30:00.000Z');
  assert.equal(input.pickup_until, '2026-10-10T07:30:00.000Z');
  assert.deepEqual(input.allergens, ['sữa', 'đậu phộng']);
  assert.equal('safety_deadline' in input, false);
  assert.equal(listingInput({ ...draft, pickupUntil: '2026-10-10T12:30' }, 'r', id, now).pickup_until, '2026-10-10T05:30:00.000Z');
});

test('listing validation rejects fractional money, invalid dates, unsafe windows and non-HTTPS photos', () => {
  for (const change of [{ price: '1.5' }, { price: '-1' }, { portions: '0' }, { portions: '2.1' },
    { price: '2147483648' }, { originalPrice: '100' }, { title: ' ' }, { handling: 'unknown' },
    { preparedAt: '2026-02-31T11:30' }, { pickupUntil: '2026-10-10T10:00' },
    { preparedAt: '2026-10-10T14:00' }, { preparedAt: '2026-10-09T11:30' },
    { photoUrl: 'http://example.com/meal' }, { photoUrl: 'https://' }, { photoUrl: 'https://secret@example.com/' }]) {
    assert.throws(() => listingInput({ ...draft, ...change }, 'restaurant', id, now));
  }
});

test('pending listings preserve one request per account and venue and reject corrupt storage', () => {
  const values = new Map();
  const storage = { get: key => values.get(key) ?? null, set: (key, value) => values.set(key, value), remove: key => values.delete(key) };
  const value = { id, ownerId: 'staff', restaurantId: 'venue', draft };
  savePendingListing(storage, value); assert.deepEqual(readPendingListing(storage, 'staff', 'venue'), value);
  assert.equal(readPendingListing(storage, 'other', 'venue'), null);
  assert.equal(readPendingListing(storage, 'staff', 'other'), null);
  values.set('buakip:listing:staff:venue', JSON.stringify({ ...value, draft: { ...draft, price: null } }));
  assert.equal(readPendingListing(storage, 'staff', 'venue'), null);
  values.set('buakip:listing:staff:venue', JSON.stringify({ ...value, draft: { ...draft, handling: 'unknown' } }));
  assert.equal(readPendingListing(storage, 'staff', 'venue'), null);
  values.set('buakip:listing:staff:venue', 'bad json'); assert.equal(readPendingListing(storage, 'staff', 'venue'), null);
  savePendingListing(storage, value); clearPendingListing(storage, 'staff', 'venue');
  assert.equal(readPendingListing(storage, 'staff', 'venue'), null);
});

test('pickup areas grow with restaurants, deduplicate and omit empty values', () => {
  const result = pickupAreas(['Cầu Giấy', 'Hà Đông', 'Tây Hồ', 'Ba Đình', ' Cầu Giấy ', ''].map(district => ({ district })));
  assert.equal(result.length, 4); assert.ok(result.includes('Hà Đông')); assert.ok(result.includes('Tây Hồ'));
});

test('a restaurant listing is reservable and collectable; publishing twice never resets stock', () => {
  const store = createDemoMarketplace({ listings: [], orders: [], userId: 'customer', creditVnd: 100000 });
  const meal = { ...fixtureListings[0], ...listingInput(draft, fixtureListings[0].restaurant_id, id, now),
    safety_deadline: '2026-10-10T07:30:00.000Z' };
  store.publish(meal);
  assert.equal(store.nearby(Infinity, now).length, 1);
  const result = store.reserve({ listingId: id, portions: 1, paymentMethod: 'credit', requestId: 'request' }, now);
  assert.equal(result.ok, true);
  store.publish(meal); assert.equal(store.listing(id, now).portions_left, 2);
  assert.equal(store.creditBalance(), 85000);
  assert.equal(store.collect('wrong-restaurant', result.pickupCode, now, result.orderId).ok, false);
  assert.equal(store.collect(meal.restaurant_id, result.pickupCode, now, result.orderId).ok, true);
  assert.equal(store.partnerOrders(meal.restaurant_id, now).length, 0);
  assert.equal(store.myOrders(now)[0].status, 'collected');
});
