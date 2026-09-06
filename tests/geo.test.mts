import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boundsOf,
  centreOf,
  distanceMetres,
  fromScreen,
  padBounds,
  project,
  toScreen,
  unproject,
  viewportRadiusM,
  worldPixels,
  zoomToFit,
} from '../src/lib/geo.ts';

/** The fixture map centre: roughly the middle of Cầu Giấy. */
const CAU_GIAY = { lat: 21.0313, lng: 105.7902 };
/** Quán Bún Chả Hàng Quạt, 12 Trần Thái Tông — fixture #1. */
const BUN_CHA = { lat: 21.0305, lng: 105.7887 };

test('distance to a point is zero', () => {
  assert.equal(distanceMetres(CAU_GIAY, CAU_GIAY), 0);
});

test('distance is symmetric', () => {
  assert.equal(
    distanceMetres(CAU_GIAY, BUN_CHA).toFixed(6),
    distanceMetres(BUN_CHA, CAU_GIAY).toFixed(6),
  );
});

test('distance across Cầu Giấy matches the fixture walking distance', () => {
  // The fixtures claim 420m from the district centre to the bún chả place.
  // Haversine on the real coordinates should agree to within a pavement's
  // width of that, or one of the two numbers is wrong.
  const metres = distanceMetres(CAU_GIAY, BUN_CHA);
  assert.ok(metres > 150 && metres < 250, `expected ~180m, got ${metres}`);
});

test('one degree of latitude is about 111km anywhere', () => {
  const north = distanceMetres({ lat: 21, lng: 105.79 }, { lat: 22, lng: 105.79 });
  assert.ok(Math.abs(north - 111_195) < 300, `got ${north}`);
});

test('projection and its inverse round-trip', () => {
  for (const coords of [CAU_GIAY, BUN_CHA, { lat: 0, lng: 0 }, { lat: -33.9, lng: 151.2 }]) {
    const back = unproject(project(coords));
    assert.ok(Math.abs(back.lat - coords.lat) < 1e-9, `lat ${back.lat}`);
    assert.ok(Math.abs(back.lng - coords.lng) < 1e-9, `lng ${back.lng}`);
  }
});

test('the null island projects to the middle of the square', () => {
  assert.deepEqual(project({ lat: 0, lng: 0 }), { x: 0.5, y: 0.5 });
});

test('projection clamps past the Mercator limit instead of returning infinity', () => {
  const pole = project({ lat: 89.9, lng: 0 });
  assert.ok(Number.isFinite(pole.y), 'y must stay finite at the pole');
  assert.ok(pole.y >= 0 && pole.y <= 1);
});

test('each zoom level doubles the world', () => {
  assert.equal(worldPixels(0), 256);
  assert.equal(worldPixels(1), 512);
  assert.equal(worldPixels(10), 256 * 1024);
});

test('bounds cover every point, and are null for none', () => {
  assert.equal(boundsOf([]), null);
  const bounds = boundsOf([CAU_GIAY, BUN_CHA, { lat: 21.0421, lng: 105.7935 }])!;
  assert.equal(bounds.north, 21.0421);
  assert.equal(bounds.south, 21.0305);
  assert.equal(bounds.east, 105.7935);
  assert.equal(bounds.west, 105.7887);
});

test('the centre of a box sits inside it', () => {
  const bounds = boundsOf([CAU_GIAY, BUN_CHA])!;
  const centre = centreOf(bounds);
  assert.ok(centre.lat <= bounds.north && centre.lat >= bounds.south);
  assert.ok(centre.lng <= bounds.east && centre.lng >= bounds.west);
});

test('padding grows a box on every side', () => {
  const bounds = { north: 21.05, south: 21.03, east: 105.8, west: 105.78 };
  const padded = padBounds(bounds, 0.1);
  assert.ok(padded.north > bounds.north);
  assert.ok(padded.south < bounds.south);
  assert.ok(padded.east > bounds.east);
  assert.ok(padded.west < bounds.west);
});

test('padding a zero-size box still gives it a size', () => {
  const pin = { north: 21.03, south: 21.03, east: 105.79, west: 105.79 };
  const padded = padBounds(pin, 0.2);
  assert.ok(padded.north > padded.south, 'a single pin must still get a window');
  assert.ok(padded.east > padded.west);
});

test('a wider spread fits at a lower zoom', () => {
  const viewport = { width: 390, height: 600 };
  const tight = zoomToFit({ north: 21.032, south: 21.030, east: 105.791, west: 105.789 }, viewport);
  const wide = zoomToFit({ north: 21.09, south: 20.97, east: 105.86, west: 105.72 }, viewport);
  assert.ok(wide < tight, `wide ${wide} should be lower than tight ${tight}`);
});

test('a single pin takes the ceiling rather than zooming to the pavement', () => {
  const zoom = zoomToFit(
    { north: 21.03, south: 21.03, east: 105.79, west: 105.79 },
    { width: 390, height: 600 },
    { maxZoom: 16 },
  );
  assert.equal(zoom, 16);
});

test('zoom to fit is clamped at both ends', () => {
  const whole = zoomToFit(
    { north: 85, south: -85, east: 180, west: -180 },
    { width: 390, height: 600 },
    { minZoom: 3, maxZoom: 16 },
  );
  assert.equal(whole, 3);
});

test('the camera centre lands in the middle of the viewport', () => {
  const point = toScreen(CAU_GIAY, { centre: CAU_GIAY, zoom: 14 }, { width: 390, height: 600 });
  assert.ok(Math.abs(point.x - 195) < 1e-6);
  assert.ok(Math.abs(point.y - 300) < 1e-6);
});

test('north of the centre draws above it', () => {
  const north = toScreen(
    { lat: CAU_GIAY.lat + 0.01, lng: CAU_GIAY.lng },
    { centre: CAU_GIAY, zoom: 14 },
    { width: 390, height: 600 },
  );
  assert.ok(north.y < 300, 'further north must be a smaller y');
});

test('screen projection round-trips back to the coordinate', () => {
  const camera = { centre: CAU_GIAY, zoom: 15 };
  const viewport = { width: 390, height: 600 };
  const back = fromScreen(toScreen(BUN_CHA, camera, viewport), camera, viewport);
  assert.ok(Math.abs(back.lat - BUN_CHA.lat) < 1e-9);
  assert.ok(Math.abs(back.lng - BUN_CHA.lng) < 1e-9);
});

test('the viewport radius shrinks as you zoom in', () => {
  const viewport = { width: 390, height: 600 };
  const far = viewportRadiusM({ centre: CAU_GIAY, zoom: 13 }, viewport);
  const near = viewportRadiusM({ centre: CAU_GIAY, zoom: 15 }, viewport);
  assert.ok(near < far);
  // Two zoom levels is a factor of four.
  assert.ok(Math.abs(far / near - 4) < 0.05, `ratio ${far / near}`);
});

test('the viewport radius measures the nearer edge, never the corner', () => {
  // A tall thin window: the radius must follow the width, so it never claims
  // results from outside what is actually on screen.
  const radius = viewportRadiusM(
    { centre: CAU_GIAY, zoom: 14 },
    { width: 390, height: 900 },
  );
  const square = viewportRadiusM(
    { centre: CAU_GIAY, zoom: 14 },
    { width: 390, height: 390 },
  );
  assert.ok(Math.abs(radius - square) < 1e-6);
});
