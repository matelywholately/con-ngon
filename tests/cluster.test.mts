import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUSTER_RADIUS_PX, clusterStores, zoomToBreak } from '../src/lib/cluster.ts';
import type { StoreMarker } from '../src/lib/stores.ts';

const NOW = new Date('2026-09-05T18:00:00+07:00');
const VIEWPORT = { width: 390, height: 700 };
const CAU_GIAY = { lat: 21.0313, lng: 105.7902 };

function store(over: Partial<StoreMarker> & { id: string }): StoreMarker {
  return {
    name: 'Quán Một',
    address: '1 Trần Thái Tông, Cầu Giấy',
    lat: 21.0305,
    lng: 105.7887,
    distance_m: 420,
    offerCount: 1,
    portionsLeft: 3,
    minPriceVnd: 25_000,
    bestDiscountPercent: 58,
    soonestDeadline: new Date(NOW.getTime() + 60 * 60_000),
    available: true,
    hasFree: false,
    ...over,
  };
}

test('clustering nothing gives nothing', () => {
  assert.deepEqual(clusterStores([], { centre: CAU_GIAY, zoom: 14 }, VIEWPORT), []);
});

test('a lone store is a pin, not a cluster', () => {
  const [only] = clusterStores([store({ id: 'a' })], { centre: CAU_GIAY, zoom: 14 }, VIEWPORT);
  assert.equal(only!.isCluster, false);
  assert.equal(only!.stores.length, 1);
  assert.equal(only!.id, 'store:a');
});

test('far apart at high zoom, the stores stay separate pins', () => {
  const clusters = clusterStores(
    [
      store({ id: 'a', lat: 21.0305, lng: 105.7887 }),
      store({ id: 'b', lat: 21.0421, lng: 105.7935 }),
    ],
    { centre: CAU_GIAY, zoom: 16 },
    VIEWPORT,
  );
  assert.equal(clusters.length, 2);
  assert.ok(clusters.every((c) => !c.isCluster));
});

test('zoomed out, the same stores merge into one counted bubble', () => {
  const clusters = clusterStores(
    [
      store({ id: 'a', lat: 21.0305, lng: 105.7887 }),
      store({ id: 'b', lat: 21.0421, lng: 105.7935 }),
    ],
    { centre: CAU_GIAY, zoom: 9 },
    VIEWPORT,
  );
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]!.isCluster, true);
  assert.equal(clusters[0]!.stores.length, 2);
});

test('every store ends up in exactly one cluster', () => {
  const stores = Array.from({ length: 12 }, (_, i) =>
    store({ id: `s${i}`, lat: 21.03 + i * 0.002, lng: 105.788 + (i % 4) * 0.003 }),
  );
  for (const zoom of [8, 11, 13, 15, 17]) {
    const clusters = clusterStores(stores, { centre: CAU_GIAY, zoom }, VIEWPORT);
    const ids = clusters.flatMap((c) => c.stores.map((s) => s.id));
    assert.equal(ids.length, stores.length, `zoom ${zoom} lost or duplicated a store`);
    assert.equal(new Set(ids).size, stores.length, `zoom ${zoom} duplicated a store`);
  }
});

test('zooming out never increases the number of pins', () => {
  const stores = Array.from({ length: 10 }, (_, i) =>
    store({ id: `s${i}`, lat: 21.03 + i * 0.0015, lng: 105.789 + i * 0.0012 }),
  );
  let previous = Number.POSITIVE_INFINITY;
  for (const zoom of [17, 15, 13, 11, 9, 7]) {
    const count = clusterStores(stores, { centre: CAU_GIAY, zoom }, VIEWPORT).length;
    assert.ok(count <= previous, `zoom ${zoom} produced ${count} after ${previous}`);
    previous = count;
  }
});

test('a cluster is available when anything inside it is', () => {
  const clusters = clusterStores(
    [
      store({ id: 'a', available: false, portionsLeft: 0 }),
      store({ id: 'b', lat: 21.0306, lng: 105.7888, available: true }),
    ],
    { centre: CAU_GIAY, zoom: 10 },
    VIEWPORT,
  );
  assert.equal(clusters[0]!.isCluster, true);
  assert.equal(clusters[0]!.available, true);
});

test('a cluster of only sold-out stores stays grey', () => {
  const clusters = clusterStores(
    [
      store({ id: 'a', available: false }),
      store({ id: 'b', lat: 21.0306, lng: 105.7888, available: false }),
    ],
    { centre: CAU_GIAY, zoom: 10 },
    VIEWPORT,
  );
  assert.equal(clusters[0]!.available, false);
});

test('cluster ids come from the grid, so panning does not reshuffle them', () => {
  const stores = [store({ id: 'a' }), store({ id: 'b', lat: 21.0421, lng: 105.7935 })];
  const camera = { centre: CAU_GIAY, zoom: 9 };
  const first = clusterStores(stores, camera, VIEWPORT);
  const again = clusterStores(stores, camera, VIEWPORT);
  assert.deepEqual(first.map((c) => c.id), again.map((c) => c.id));
});

test('a zero radius disables clustering entirely', () => {
  const clusters = clusterStores(
    [store({ id: 'a' }), store({ id: 'b' })],
    { centre: CAU_GIAY, zoom: 4 },
    VIEWPORT,
    { radiusPx: 0 },
  );
  assert.equal(clusters.length, 2);
});

test('breaking a cluster zooms in far enough to actually separate it', () => {
  const stores = [
    store({ id: 'a', lat: 21.0305, lng: 105.7887 }),
    store({ id: 'b', lat: 21.0421, lng: 105.7935 }),
  ];
  const camera = { centre: CAU_GIAY, zoom: 9 };
  const [cluster] = clusterStores(stores, camera, VIEWPORT);
  assert.equal(cluster!.isCluster, true);

  const zoom = zoomToBreak(cluster!, camera, VIEWPORT);
  assert.ok(zoom > camera.zoom, 'must zoom in');

  const after = clusterStores(stores, { centre: CAU_GIAY, zoom }, VIEWPORT);
  assert.equal(after.length, 2, 'the cluster must actually come apart');
});

test('stores at one address cannot separate, so the zoom is merely nudged', () => {
  const camera = { centre: CAU_GIAY, zoom: 12 };
  const [cluster] = clusterStores(
    [store({ id: 'a' }), store({ id: 'b' })],
    camera,
    VIEWPORT,
  );
  const zoom = zoomToBreak(cluster!, camera, VIEWPORT, { maxZoom: 18 });
  assert.ok(zoom > camera.zoom && zoom <= 18);
});

test('breaking is capped at the maximum zoom', () => {
  const camera = { centre: CAU_GIAY, zoom: 17.5 };
  const [cluster] = clusterStores(
    [store({ id: 'a' }), store({ id: 'b' })],
    camera,
    VIEWPORT,
  );
  assert.equal(zoomToBreak(cluster!, camera, VIEWPORT, { maxZoom: 18 }), 18);
});

test('the default cluster radius is wide enough for a pin and its label', () => {
  assert.ok(CLUSTER_RADIUS_PX >= 44, 'below a touch target, pins would overlap untappably');
});

test('clusters that land in neighbouring cells but still overlap are merged', () => {
  // Two pairs, each pair tight, the pairs a few pixels apart. Grid bucketing
  // alone would put them in different cells and draw one behind the other.
  const stores = [
    store({ id: 'a', lat: 21.03100, lng: 105.79000 }),
    store({ id: 'b', lat: 21.03102, lng: 105.79002 }),
    store({ id: 'c', lat: 21.03108, lng: 105.79008 }),
    store({ id: 'd', lat: 21.03110, lng: 105.79010 }),
  ];
  const clusters = clusterStores(stores, { centre: CAU_GIAY, zoom: 16 }, VIEWPORT);
  assert.equal(clusters.length, 1, 'overlapping bubbles must not stack');
  assert.equal(clusters[0]!.stores.length, 4);
});

test('merging never drops or duplicates a store', () => {
  const stores = Array.from({ length: 20 }, (_, i) =>
    store({ id: `s${i}`, lat: 21.028 + i * 0.0009, lng: 105.786 + (i % 5) * 0.0011 }),
  );
  for (const zoom of [9, 12, 14, 16, 18]) {
    const ids = clusterStores(stores, { centre: CAU_GIAY, zoom }, VIEWPORT).flatMap((c) =>
      c.stores.map((s) => s.id),
    );
    assert.equal(new Set(ids).size, stores.length, `zoom ${zoom}`);
    assert.equal(ids.length, stores.length, `zoom ${zoom}`);
  }
});

test('well-separated stores are still left alone after the merge pass', () => {
  const clusters = clusterStores(
    [
      store({ id: 'a', lat: 21.0250, lng: 105.7850 }),
      store({ id: 'b', lat: 21.0420, lng: 105.8010 }),
    ],
    { centre: CAU_GIAY, zoom: 16 },
    VIEWPORT,
  );
  assert.equal(clusters.length, 2);
  assert.ok(clusters.every((c) => !c.isCluster));
});
