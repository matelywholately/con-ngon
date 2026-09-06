/**
 * Pin clustering.
 *
 * Zoom out on Too Good To Go and the individual pins merge into one bubble
 * carrying a count, so a neighbourhood reads as a density before it reads as
 * a list. `expo-maps` ships no clustering on either platform — the SDK 57
 * types offer markers and nothing above them — so it is ours to do.
 *
 * Grid bucketing rather than k-means: at one walking radius there are tens of
 * stores, not thousands, and a grid is stable under panning. k-means would
 * reshuffle every cluster each time the camera moved a metre, which looks
 * broken even when the maths is right.
 *
 * Pure — no React, no map SDK — so it is tested under `node --test`.
 */
import { toScreen } from './geo.ts';
import type { Coords, Viewport } from './geo.ts';
import type { StoreMarker } from './stores.ts';

/**
 * How far apart two pins must be on screen to stay separate, in pixels.
 * Roughly the width of a pin plus its label: below this they overlap and the
 * one underneath cannot be tapped at all.
 */
export const CLUSTER_RADIUS_PX = 64;

export type Cluster = {
  /** Stable across renders: derived from the grid cell, not the array index. */
  id: string;
  coords: Coords;
  /** The stores inside. Always at least one. */
  stores: StoreMarker[];
  /** True when this is a real group rather than a lone pin. */
  isCluster: boolean;
  /** True when anything inside is still collectable — green vs grey. */
  available: boolean;
};

export type Camera = { centre: Coords; zoom: number };

/**
 * Bucket stores into clusters for a given camera.
 *
 * The grid is measured in screen pixels rather than degrees, so a cluster
 * means the same thing visually at every zoom and at every latitude — which
 * is the only definition that matches what the eye complains about.
 */
export function clusterStores(
  stores: readonly StoreMarker[],
  camera: Camera,
  viewport: Viewport,
  options: { radiusPx?: number } = {},
): Cluster[] {
  const radius = options.radiusPx ?? CLUSTER_RADIUS_PX;
  if (radius <= 0 || stores.length === 0) {
    return stores.map((store) => soloCluster(store));
  }

  const cells = new Map<string, StoreMarker[]>();
  const order: string[] = [];

  for (const store of stores) {
    const point = toScreen({ lat: store.lat, lng: store.lng }, camera, viewport);
    const key = `${Math.floor(point.x / radius)}:${Math.floor(point.y / radius)}`;
    const bucket = cells.get(key);
    if (bucket) {
      bucket.push(store);
    } else {
      cells.set(key, [store]);
      order.push(key);
    }
  }

  const bucketed = order.map((key) => {
    const group = cells.get(key)!;
    if (group.length === 1) return soloCluster(group[0]!);
    return {
      id: `cluster:${key}`,
      coords: centroid(group),
      stores: group,
      isCluster: true,
      available: group.some((s) => s.available),
    };
  });

  return mergeAdjacent(bucketed, camera, viewport, radius);
}

/**
 * Merge clusters that ended up in neighbouring cells but still overlap.
 *
 * Grid bucketing has one visible flaw: two stores a few pixels apart on
 * opposite sides of a cell boundary land in different buckets and draw on top
 * of each other, so the map shows a "2" half-hidden behind a "4". Sweeping
 * once more over the bucketed results and folding together anything still
 * closer than the radius fixes exactly that case, and leaves everything else
 * alone.
 *
 * The sweep is ordered, so the result stays stable under panning — which is
 * the property grid bucketing was chosen for in the first place.
 */
function mergeAdjacent(
  clusters: readonly Cluster[],
  camera: Camera,
  viewport: Viewport,
  radius: number,
): Cluster[] {
  const merged: { stores: StoreMarker[]; id: string }[] = [];
  const points = clusters.map((c) => toScreen(c.coords, camera, viewport));

  for (let i = 0; i < clusters.length; i += 1) {
    const cluster = clusters[i]!;
    const point = points[i]!;

    const host = merged.find((candidate) => {
      const at = toScreen(centroid(candidate.stores), camera, viewport);
      return Math.hypot(at.x - point.x, at.y - point.y) < radius;
    });

    if (host) {
      host.stores.push(...cluster.stores);
    } else {
      merged.push({ id: cluster.id, stores: [...cluster.stores] });
    }
  }

  return merged.map((entry) =>
    entry.stores.length === 1
      ? soloCluster(entry.stores[0]!)
      : {
          id: entry.id.startsWith('cluster:') ? entry.id : `cluster:${entry.id}`,
          coords: centroid(entry.stores),
          stores: entry.stores,
          isCluster: true,
          available: entry.stores.some((s) => s.available),
        },
  );
}

/**
 * The zoom that would break a cluster apart.
 *
 * Tapping a bubble should reveal what is inside rather than nudge the camera
 * and leave it a bubble. Each zoom level doubles the pixel distance between
 * two points, so the number of doublings needed is a logarithm — plus a
 * little, so the pins clear the threshold instead of landing exactly on it.
 */
export function zoomToBreak(
  cluster: Cluster,
  camera: Camera,
  viewport: Viewport,
  options: { radiusPx?: number; maxZoom?: number } = {},
): number {
  const radius = options.radiusPx ?? CLUSTER_RADIUS_PX;
  const { maxZoom = 18 } = options;
  if (!cluster.isCluster) return Math.min(maxZoom, camera.zoom + 1);

  // The widest gap inside the cluster is what has to exceed the radius.
  let widest = 0;
  const points = cluster.stores.map((s) =>
    toScreen({ lat: s.lat, lng: s.lng }, camera, viewport),
  );
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[i]!.x - points[j]!.x;
      const dy = points[i]!.y - points[j]!.y;
      widest = Math.max(widest, Math.hypot(dx, dy));
    }
  }

  // Several stores at one address never separate, however far you zoom.
  if (widest === 0) return Math.min(maxZoom, camera.zoom + 2);
  return Math.min(maxZoom, camera.zoom + Math.log2(radius / widest) + 1);
}

function soloCluster(store: StoreMarker): Cluster {
  return {
    id: `store:${store.id}`,
    coords: { lat: store.lat, lng: store.lng },
    stores: [store],
    isCluster: false,
    available: store.available,
  };
}

function centroid(stores: readonly StoreMarker[]): Coords {
  const lat = stores.reduce((sum, s) => sum + s.lat, 0) / stores.length;
  const lng = stores.reduce((sum, s) => sum + s.lng, 0) / stores.length;
  return { lat, lng };
}
