import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupByStore,
  listingsForStore,
  storePickupWindow,
  storeUrgency,
} from '../src/lib/stores.ts';
import type { NearbyListing } from '../src/lib/types.ts';

const NOW = new Date('2026-09-05T18:00:00+07:00');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

/** Only the fields the grouping reads; the rest is filler. */
function listing(over: Partial<NearbyListing> & { id: string }): NearbyListing {
  return {
    restaurant_id: 'r1',
    title: 'Cơm rang dưa bò',
    description: null,
    photo_url: null,
    portions_total: 4,
    portions_left: 2,
    price_vnd: 30_000,
    original_price_vnd: 60_000,
    handling_class: 'hot',
    prepared_at: at(-60),
    pickup_from: at(-30),
    pickup_until: at(120),
    safety_deadline: at(120),
    status: 'live',
    allergens: [],
    is_vegetarian: false,
    created_at: at(-60),
    restaurant_name: 'Quán Một',
    restaurant_address: '1 Trần Thái Tông, Cầu Giấy',
    restaurant_lat: 21.0305,
    restaurant_lng: 105.7887,
    distance_m: 420,
    ...over,
  };
}

test('two listings at one kitchen make one pin, not two', () => {
  const stores = groupByStore([
    listing({ id: 'a' }),
    listing({ id: 'b' }),
    listing({ id: 'c', restaurant_id: 'r2', restaurant_name: 'Quán Hai' }),
  ]);
  assert.equal(stores.length, 2);
  assert.equal(stores[0]!.offerCount, 2);
  assert.equal(stores[1]!.offerCount, 1);
});

test('a store totals the portions across its listings', () => {
  const stores = groupByStore([
    listing({ id: 'a', portions_left: 2 }),
    listing({ id: 'b', portions_left: 5 }),
  ]);
  assert.equal(stores[0]!.portionsLeft, 7);
});

test('the card price is the cheapest thing in the shop', () => {
  const stores = groupByStore([
    listing({ id: 'a', price_vnd: 30_000 }),
    listing({ id: 'b', price_vnd: 12_000 }),
    listing({ id: 'c', price_vnd: 25_000 }),
  ]);
  assert.equal(stores[0]!.minPriceVnd, 12_000);
});

test('the best discount wins, and none means null', () => {
  const discounted = groupByStore([
    listing({ id: 'a', price_vnd: 30_000, original_price_vnd: 60_000 }), // 50%
    listing({ id: 'b', price_vnd: 10_000, original_price_vnd: 50_000 }), // 80%
  ]);
  assert.equal(discounted[0]!.bestDiscountPercent, 80);

  const plain = groupByStore([listing({ id: 'a', original_price_vnd: null })]);
  assert.equal(plain[0]!.bestDiscountPercent, null);
});

test('the soonest deadline is what the pin counts down to', () => {
  const stores = groupByStore([
    listing({ id: 'a', pickup_until: at(120), safety_deadline: at(120) }),
    listing({ id: 'b', pickup_until: at(20), safety_deadline: at(20) }),
  ]);
  assert.equal(stores[0]!.soonestDeadline.toISOString(), at(20));
});

test('the safety deadline can beat the closing time to it', () => {
  // Prepared 170 minutes ago and hot: the 180-minute rule bites at +10,
  // well before the 19:00 closing time the restaurant advertised.
  const stores = groupByStore([
    listing({ id: 'a', handling_class: 'hot', prepared_at: at(-170), pickup_until: at(120) }),
  ]);
  assert.equal(stores[0]!.soonestDeadline.toISOString(), at(10));
});

test('a store with nothing left is unavailable — the grey pin', () => {
  const stores = groupByStore([listing({ id: 'a', portions_left: 0 })]);
  assert.equal(stores[0]!.available, false);
  assert.equal(stores[0]!.portionsLeft, 0);
});

test('one collectable listing is enough to keep a store green', () => {
  const stores = groupByStore([
    listing({ id: 'a', portions_left: 0 }),
    listing({ id: 'b', portions_left: 3 }),
  ]);
  assert.equal(stores[0]!.available, true);
});

test('the free track is flagged, wherever in the list it appears', () => {
  const stores = groupByStore([
    listing({ id: 'a', price_vnd: 25_000 }),
    listing({ id: 'b', price_vnd: 0 }),
  ]);
  assert.equal(stores[0]!.hasFree, true);
  assert.equal(stores[0]!.minPriceVnd, 0);
});

test('given an origin, distance is recomputed rather than trusted', () => {
  // The listing claims 420m. From a metre away it is not 420m, and a panned
  // map has to say so or "search this area" means nothing.
  const stores = groupByStore([listing({ id: 'a', distance_m: 420 })], {
    origin: { lat: 21.0305, lng: 105.7887 },
  });
  assert.ok(stores[0]!.distance_m < 1, `expected ~0, got ${stores[0]!.distance_m}`);
});

test('without an origin the listing distance is taken as given', () => {
  const stores = groupByStore([listing({ id: 'a', distance_m: 420 })]);
  assert.equal(stores[0]!.distance_m, 420);
});

test('grouping preserves first-appearance order', () => {
  const stores = groupByStore([
    listing({ id: 'a', restaurant_id: 'r3' }),
    listing({ id: 'b', restaurant_id: 'r1' }),
    listing({ id: 'c', restaurant_id: 'r3' }),
  ]);
  assert.deepEqual(stores.map((s) => s.id), ['r3', 'r1']);
});

test('grouping nothing gives nothing', () => {
  assert.deepEqual(groupByStore([]), []);
});

test('a store urgency comes from its soonest listing', () => {
  const [store] = groupByStore([
    listing({ id: 'a', pickup_until: at(600), safety_deadline: at(600) }),
    listing({ id: 'b', pickup_until: at(12), safety_deadline: at(12) }),
  ]);
  assert.equal(storeUrgency(store!, NOW), 'urgent');
});

test("a store's listings come back soonest first", () => {
  const all = [
    listing({ id: 'late', pickup_until: at(180), safety_deadline: at(180) }),
    listing({ id: 'soon', pickup_until: at(15), safety_deadline: at(15) }),
    listing({ id: 'other', restaurant_id: 'r2' }),
  ];
  assert.deepEqual(
    listingsForStore(all, 'r1').map((l) => l.id),
    ['soon', 'late'],
  );
});

test('the pickup window spans from the earliest open to the latest good', () => {
  const all = [
    // Prepared 30 minutes ago and hot, so safety allows until +150.
    listing({ id: 'a', prepared_at: at(-30), pickup_from: at(-30), pickup_until: at(60) }),
    listing({ id: 'b', prepared_at: at(-30), pickup_from: at(15), pickup_until: at(140) }),
  ];
  const window = storePickupWindow(all, 'r1')!;
  assert.equal(window.from.toISOString(), at(-30));
  assert.equal(window.until.toISOString(), at(140));
});

test('a store cannot advertise a window past its own safety limit', () => {
  // Prepared 60 minutes ago and hot: the 180-minute rule ends this at +120,
  // whatever closing time the restaurant typed in.
  const all = [listing({ id: 'a', prepared_at: at(-60), pickup_until: at(600) })];
  const window = storePickupWindow(all, 'r1')!;
  assert.equal(window.until.toISOString(), at(120));
});

test('a store with no listings has no window', () => {
  assert.equal(storePickupWindow([listing({ id: 'a' })], 'nobody'), null);
});
