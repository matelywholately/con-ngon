/**
 * Geographic maths.
 *
 * Pure — no React, no React Native, no map SDK — so the arithmetic that
 * decides where a pin lands can be tested under `node --test`. It exists
 * because two different renderers need to agree: `expo-maps` projects
 * coordinates itself on device, and the web canvas has to reproduce that
 * projection by hand. Sharing one implementation is what keeps a pin in the
 * same place in a screenshot as it is on a phone.
 *
 * Everything here is Web Mercator (EPSG:3857), which is what Google Maps,
 * Apple Maps and every tile scheme in use agree on.
 */
/**
 * A latitude/longitude pair. It lives here rather than in `queries.ts` because
 * geography is what it is about, and because `queries.ts` imports this module
 * — `queries.ts` re-exports it so the existing import sites keep working.
 */
export type Coords = { lat: number; lng: number };

/** Mean Earth radius in metres (WGS84 authalic). */
const EARTH_RADIUS_M = 6_371_008.8;

/** Web Mercator clamps at the latitude that makes the projection square. */
export const MERCATOR_MAX_LAT = 85.05112878;

/** The tile size every slippy-map zoom level is defined against. */
export const TILE_SIZE = 256;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** A rectangle in degrees. `north >= south`, `east >= west`. */
export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

/** A point in the unit Mercator square: x and y both in [0, 1]. */
export type Point = { x: number; y: number };

/**
 * Great-circle distance in metres.
 *
 * Haversine rather than the spheroidal formula PostGIS uses: over one walking
 * radius the two differ by well under a metre, and `formatDistance` rounds to
 * the nearest metre anyway. This exists so fixture mode can answer "how far is
 * that" without a database — see `fetchNearbyListings`.
 */
export function distanceMetres(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Project a coordinate into the unit Mercator square, origin at the top-left
 * (north-west), which is the convention both tile schemes and SVG use.
 */
export function project(coords: Coords): Point {
  const lat = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, coords.lat));
  const sin = Math.sin(toRad(lat));
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return {
    x: (coords.lng + 180) / 360,
    // At exactly the Mercator limit the arithmetic lands a few ulps either
    // side of 0 and 1. Clamping keeps the "unit square" this function
    // promises actually true, so callers can index and scale without guarding.
    y: Math.max(0, Math.min(1, y)),
  };
}

/** The inverse of `project`. */
export function unproject(point: Point): Coords {
  return {
    lat: toDeg(2 * Math.atan(Math.exp((0.5 - point.y) * 2 * Math.PI)) - Math.PI / 2),
    lng: point.x * 360 - 180,
  };
}

/**
 * How many screen pixels one unit of the Mercator square covers at a zoom.
 * Zoom 0 is the whole world in one 256px tile, and each level doubles.
 */
export function worldPixels(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

/** The smallest box containing every coordinate. Null for an empty list. */
export function boundsOf(coords: readonly Coords[]): Bounds | null {
  if (coords.length === 0) return null;
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const c of coords) {
    if (c.lat > north) north = c.lat;
    if (c.lat < south) south = c.lat;
    if (c.lng > east) east = c.lng;
    if (c.lng < west) west = c.lng;
  }
  return { north, south, east, west };
}

/** The middle of a box. */
export function centreOf(bounds: Bounds): Coords {
  const nw = project({ lat: bounds.north, lng: bounds.west });
  const se = project({ lat: bounds.south, lng: bounds.east });
  return unproject({ x: (nw.x + se.x) / 2, y: (nw.y + se.y) / 2 });
}

/** Grow a box by a fraction of its own size, so pins are not flush to the edge. */
export function padBounds(bounds: Bounds, fraction: number): Bounds {
  const latPad = Math.max((bounds.north - bounds.south) * fraction, 1e-4);
  const lngPad = Math.max((bounds.east - bounds.west) * fraction, 1e-4);
  return {
    north: Math.min(MERCATOR_MAX_LAT, bounds.north + latPad),
    south: Math.max(-MERCATOR_MAX_LAT, bounds.south - latPad),
    east: bounds.east + lngPad,
    west: bounds.west - lngPad,
  };
}

export type Viewport = { width: number; height: number };

/**
 * The highest zoom at which `bounds` still fits inside a viewport.
 *
 * Too Good To Go's map is most often criticised for opening so far out that
 * the pins are one undifferentiated blob and you must pinch several times
 * before anything is tappable. Framing on the actual results avoids that
 * without ever guessing a fixed zoom.
 *
 * `maxZoom` stops a single pin — where the box has no size at all — from
 * zooming to the pavement.
 */
export function zoomToFit(
  bounds: Bounds,
  viewport: Viewport,
  options: { maxZoom?: number; minZoom?: number } = {},
): number {
  const { maxZoom = 16, minZoom = 1 } = options;
  const nw = project({ lat: bounds.north, lng: bounds.west });
  const se = project({ lat: bounds.south, lng: bounds.east });
  const spanX = Math.abs(se.x - nw.x);
  const spanY = Math.abs(se.y - nw.y);

  // A degenerate box (one pin, or several at one address) has no scale to
  // solve for, so there is nothing to fit — take the ceiling.
  const zoomX = spanX > 0 ? Math.log2(viewport.width / (TILE_SIZE * spanX)) : maxZoom;
  const zoomY = spanY > 0 ? Math.log2(viewport.height / (TILE_SIZE * spanY)) : maxZoom;

  return Math.max(minZoom, Math.min(maxZoom, Math.min(zoomX, zoomY)));
}

/**
 * Where a coordinate falls inside a viewport, in pixels from its top-left,
 * given the camera centre and zoom. This is the web canvas's whole rendering
 * model, and it is how `cluster.ts` measures whether two pins overlap.
 */
export function toScreen(
  coords: Coords,
  camera: { centre: Coords; zoom: number },
  viewport: Viewport,
): Point {
  const scale = worldPixels(camera.zoom);
  const target = project(coords);
  const centre = project(camera.centre);
  return {
    x: viewport.width / 2 + (target.x - centre.x) * scale,
    y: viewport.height / 2 + (target.y - centre.y) * scale,
  };
}

/** The inverse of `toScreen`: what a tap at a pixel is pointing at. */
export function fromScreen(
  point: Point,
  camera: { centre: Coords; zoom: number },
  viewport: Viewport,
): Coords {
  const scale = worldPixels(camera.zoom);
  const centre = project(camera.centre);
  return unproject({
    x: centre.x + (point.x - viewport.width / 2) / scale,
    y: centre.y + (point.y - viewport.height / 2) / scale,
  });
}

/**
 * The radius in metres from the camera centre to the nearer viewport edge.
 *
 * "Search this area" has to turn a rectangle the user framed into the single
 * radius the `nearby_*` RPCs take. The nearer edge is the honest choice: it
 * never claims results from outside what is on screen.
 */
export function viewportRadiusM(
  camera: { centre: Coords; zoom: number },
  viewport: Viewport,
): number {
  const halfEdge = Math.min(viewport.width, viewport.height) / 2;
  const scale = worldPixels(camera.zoom);
  const centre = project(camera.centre);
  const edge = unproject({ x: centre.x, y: centre.y - halfEdge / scale });
  return distanceMetres(camera.centre, edge);
}
