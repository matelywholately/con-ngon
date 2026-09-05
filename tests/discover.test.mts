import test from 'node:test';
import assert from 'node:assert/strict';
import { CHEAP_CEILING_VND, filterListings } from '../src/lib/discover.ts';
import type { NearbyListing } from '../src/lib/types.ts';

const NOW = new Date('2026-09-05T18:00:00+07:00');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

/** Only the fields the filters actually read; the rest is filler. */
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
    // 3h before now, so the 'hot' rule leaves 3h of the safety window unused.
    prepared_at: at(-180),
    pickup_from: at(-60),
    pickup_until: at(600),
    safety_deadline: at(600),
    status: 'live',
    allergens: [],
    is_vegetarian: false,
    created_at: at(-60),
    restaurant_name: 'Cơm Bình Dân Dịch Vọng',
    restaurant_address: '87 Dịch Vọng Hậu',
    restaurant_lat: 21.03,
    restaurant_lng: 105.78,
    distance_m: 500,
    ...over,
  };
}

const all = (rows: NearbyListing[], query = '') =>
  filterListings(rows, { query, filter: 'all', now: NOW });

test('an empty query keeps everything', () => {
  const rows = [listing({ id: 'a' }), listing({ id: 'b' })];
  assert.equal(all(rows).length, 2);
  assert.equal(all(rows, '   ').length, 2);
});

test('search matches a dish typed without diacritics', () => {
  const rows = [
    listing({ id: 'a', title: 'Bún chả nướng than' }),
    listing({ id: 'b', title: 'Sữa chua nếp cẩm' }),
  ];
  assert.deepEqual(all(rows, 'bun cha').map((r) => r.id), ['a']);
  assert.deepEqual(all(rows, 'NEP CAM').map((r) => r.id), ['b']);
});

test('search also matches the restaurant, not just the dish', () => {
  const rows = [
    listing({ id: 'a', restaurant_name: 'Quán Chay An Lạc' }),
    listing({ id: 'b', restaurant_name: 'Bánh Mì 25' }),
  ];
  assert.deepEqual(all(rows, 'an lac').map((r) => r.id), ['a']);
});

test('the cheap chip includes its ceiling and free food', () => {
  const rows = [
    listing({ id: 'over', price_vnd: CHEAP_CEILING_VND + 1 }),
    listing({ id: 'exact', price_vnd: CHEAP_CEILING_VND }),
    listing({ id: 'free', price_vnd: 0 }),
  ];
  const ids = filterListings(rows, { query: '', filter: 'cheap', now: NOW }).map((r) => r.id);
  assert.deepEqual(ids, ['exact', 'free']);
});

test('the vegetarian chip keeps only vegetarian listings', () => {
  const rows = [listing({ id: 'a', is_vegetarian: true }), listing({ id: 'b' })];
  const ids = filterListings(rows, { query: '', filter: 'vegetarian', now: NOW }).map((r) => r.id);
  assert.deepEqual(ids, ['a']);
});

test('closing soon excludes both the relaxed and the already expired', () => {
  const rows = [
    // 'hot' allows 180 usable minutes after preparation, so preparing 170
    // minutes ago leaves 10 — urgent.
    listing({ id: 'urgent', prepared_at: at(-170), pickup_until: at(600) }),
    // Prepared 60 min ago leaves 120 of the 180 usable minutes, which is
    // above the 90-minute 'soon' band — still fresh, so the chip drops it.
    listing({ id: 'fresh', prepared_at: at(-60), pickup_until: at(600) }),
    // Closing in 40 minutes because the restaurant shuts, not for safety.
    listing({ id: 'soon', prepared_at: at(-10), pickup_until: at(40) }),
    listing({ id: 'gone', prepared_at: at(-10), pickup_until: at(-5) }),
  ];
  const ids = filterListings(rows, { query: '', filter: 'closing_soon', now: NOW }).map(
    (r) => r.id,
  );
  assert.deepEqual(ids, ['urgent', 'soon']);
});

test('closing soon sorts by the deadline you actually have to beat', () => {
  const rows = [
    listing({ id: 'later', prepared_at: at(-10), pickup_until: at(80) }),
    listing({ id: 'sooner', prepared_at: at(-10), pickup_until: at(20) }),
  ];
  const ids = filterListings(rows, { query: '', filter: 'closing_soon', now: NOW }).map(
    (r) => r.id,
  );
  assert.deepEqual(ids, ['sooner', 'later']);
});

test('filtering does not mutate the caller array', () => {
  const rows = [
    listing({ id: 'later', prepared_at: at(-10), pickup_until: at(80) }),
    listing({ id: 'sooner', prepared_at: at(-10), pickup_until: at(20) }),
  ];
  filterListings(rows, { query: '', filter: 'closing_soon', now: NOW });
  assert.deepEqual(rows.map((r) => r.id), ['later', 'sooner']);
});
