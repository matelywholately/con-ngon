import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RELEVANCE_WEIGHTS,
  STORE_SORTS,
  rankStores,
  relevanceScore,
} from '../src/lib/recommend.ts';
import type { StoreMarker } from '../src/lib/stores.ts';

const NOW = new Date('2026-09-05T18:00:00+07:00');
const inMinutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

function store(over: Partial<StoreMarker> & { id: string }): StoreMarker {
  return {
    name: 'Quán Một',
    address: '1 Trần Thái Tông, Cầu Giấy',
    lat: 21.0305,
    lng: 105.7887,
    distance_m: 500,
    offerCount: 1,
    portionsLeft: 3,
    minPriceVnd: 25_000,
    bestDiscountPercent: 50,
    soonestDeadline: inMinutes(90),
    available: true,
    hasFree: false,
    ...over,
  };
}

test('the relevance weights sum to one, so a score is a fraction', () => {
  const total = Object.values(RELEVANCE_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
});

test('every score lands inside [0, 1]', () => {
  const extremes = [
    store({ id: 'a', distance_m: 0, bestDiscountPercent: 100, portionsLeft: 99, soonestDeadline: inMinutes(1) }),
    store({ id: 'b', distance_m: 99_000, bestDiscountPercent: null, portionsLeft: 1, soonestDeadline: inMinutes(9999) }),
    store({ id: 'c', distance_m: 500, bestDiscountPercent: 0, portionsLeft: 0, soonestDeadline: inMinutes(-10) }),
  ];
  for (const s of extremes) {
    const score = relevanceScore(s, { now: NOW });
    assert.ok(score >= 0 && score <= 1, `${s.id} scored ${score}`);
  }
});

test('a sold-out store scores nothing however good it otherwise looks', () => {
  const perfect = store({
    id: 'a',
    available: false,
    distance_m: 0,
    bestDiscountPercent: 90,
    portionsLeft: 0,
  });
  assert.equal(relevanceScore(perfect, { now: NOW }), 0);
});

test('closer scores higher, all else equal', () => {
  const near = relevanceScore(store({ id: 'a', distance_m: 200 }), { now: NOW });
  const far = relevanceScore(store({ id: 'b', distance_m: 1_400 }), { now: NOW });
  assert.ok(near > far, `${near} should beat ${far}`);
});

test('a deeper discount scores higher, all else equal', () => {
  const deep = relevanceScore(store({ id: 'a', bestDiscountPercent: 80 }), { now: NOW });
  const shallow = relevanceScore(store({ id: 'b', bestDiscountPercent: 10 }), { now: NOW });
  assert.ok(deep > shallow);
});

test('running out sooner scores higher — that is the point of the product', () => {
  const soon = relevanceScore(store({ id: 'a', soonestDeadline: inMinutes(20) }), { now: NOW });
  const later = relevanceScore(store({ id: 'b', soonestDeadline: inMinutes(300) }), { now: NOW });
  assert.ok(soon > later);
});

test('already expired earns no urgency credit', () => {
  const gone = relevanceScore(store({ id: 'a', soonestDeadline: inMinutes(-5) }), { now: NOW });
  const ticking = relevanceScore(store({ id: 'b', soonestDeadline: inMinutes(5) }), { now: NOW });
  assert.ok(ticking > gone, 'expired must not outrank urgent');
});

test('proximity outweighs a discount — this is a pickup product', () => {
  const closeAndDear = store({ id: 'close', distance_m: 100, bestDiscountPercent: 0 });
  const farAndCheap = store({ id: 'far', distance_m: 1_500, bestDiscountPercent: 100 });
  assert.ok(
    relevanceScore(closeAndDear, { now: NOW }) > relevanceScore(farAndCheap, { now: NOW }),
    'a bargain two kilometres away is not a bargain',
  );
});

test('sold-out stores sink to the bottom of every sort', () => {
  const stores = [
    store({ id: 'gone', available: false, distance_m: 5, minPriceVnd: 0, soonestDeadline: inMinutes(1) }),
    store({ id: 'open', available: true, distance_m: 1_400, minPriceVnd: 90_000, soonestDeadline: inMinutes(400) }),
  ];
  for (const sort of STORE_SORTS) {
    const ranked = rankStores(stores, { now: NOW, sort });
    assert.equal(ranked[0]!.id, 'open', `${sort} put a sold-out store first`);
  }
});

test('distance sorts by metres', () => {
  const ranked = rankStores(
    [
      store({ id: 'far', distance_m: 1_200 }),
      store({ id: 'near', distance_m: 150 }),
      store({ id: 'mid', distance_m: 600 }),
    ],
    { now: NOW, sort: 'distance' },
  );
  assert.deepEqual(ranked.map((s) => s.id), ['near', 'mid', 'far']);
});

test('price sorts by the cheapest thing in the shop, ties broken by distance', () => {
  const ranked = rankStores(
    [
      store({ id: 'dear', minPriceVnd: 40_000, distance_m: 100 }),
      store({ id: 'cheap-far', minPriceVnd: 10_000, distance_m: 900 }),
      store({ id: 'cheap-near', minPriceVnd: 10_000, distance_m: 200 }),
    ],
    { now: NOW, sort: 'price' },
  );
  assert.deepEqual(ranked.map((s) => s.id), ['cheap-near', 'cheap-far', 'dear']);
});

test('urgency sorts by the soonest deadline', () => {
  const ranked = rankStores(
    [
      store({ id: 'later', soonestDeadline: inMinutes(200) }),
      store({ id: 'now', soonestDeadline: inMinutes(10) }),
      store({ id: 'mid', soonestDeadline: inMinutes(60) }),
    ],
    { now: NOW, sort: 'urgency' },
  );
  assert.deepEqual(ranked.map((s) => s.id), ['now', 'mid', 'later']);
});

test('relevance is the default sort', () => {
  const stores = [store({ id: 'a', distance_m: 1_400 }), store({ id: 'b', distance_m: 100 })];
  assert.deepEqual(
    rankStores(stores, { now: NOW }).map((s) => s.id),
    rankStores(stores, { now: NOW, sort: 'relevance' }).map((s) => s.id),
  );
});

test('ranking never mutates its input', () => {
  const stores = [store({ id: 'a', distance_m: 900 }), store({ id: 'b', distance_m: 100 })];
  const before = stores.map((s) => s.id);
  rankStores(stores, { now: NOW, sort: 'distance' });
  assert.deepEqual(stores.map((s) => s.id), before);
});

test('relevance ties break on distance, so the order is total', () => {
  // Same discount, same deadline, same stock — only the walk differs. Two
  // stores that score alike must not land in whatever order the rows arrived.
  const ranked = rankStores(
    [
      store({ id: 'far', distance_m: 1_499 }),
      store({ id: 'near', distance_m: 1_498 }),
    ],
    { now: NOW },
  );
  assert.deepEqual(ranked.map((s) => s.id), ['near', 'far']);
});

test('stores identical on every axis keep their input order', () => {
  const twins = [store({ id: 'first' }), store({ id: 'second' })];
  assert.deepEqual(
    rankStores(twins, { now: NOW }).map((s) => s.id),
    ['first', 'second'],
  );
  assert.deepEqual(
    rankStores([...twins].reverse(), { now: NOW }).map((s) => s.id),
    ['second', 'first'],
  );
});

test('ranking nothing gives nothing', () => {
  assert.deepEqual(rankStores([], { now: NOW }), []);
});
