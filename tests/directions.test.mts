import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAVEL_MODES,
  WALKABLE_BELOW_M,
  defaultTravelMode,
  directionsUrl,
  placeUrl,
} from '../src/lib/directions.ts';

/** Quán Bún Chả Hàng Quạt, 12 Trần Thái Tông — fixture #1. */
const TARGET = { lat: 21.0305, lng: 105.7887, label: 'Quán Bún Chả Hàng Quạt' };

test('Android gets a Google URL carrying the travel mode', () => {
  assert.equal(
    directionsUrl({ ...TARGET, mode: 'two_wheeler' }, 'android'),
    'https://www.google.com/maps/dir/?api=1&destination=21.0305%2C105.7887&travelmode=two_wheeler',
  );
});

test('the motorbike is the default, because Hanoi is', () => {
  const url = directionsUrl({ lat: 21.0305, lng: 105.7887 }, 'android');
  assert.ok(url.includes('travelmode=two_wheeler'), url);
});

test('walking is carried through when asked for', () => {
  const url = directionsUrl({ ...TARGET, mode: 'walking' }, 'android');
  assert.ok(url.includes('travelmode=walking'), url);
});

test('the web build gets the same universal URL as Android', () => {
  assert.equal(
    directionsUrl({ ...TARGET, mode: 'walking' }, 'web'),
    directionsUrl({ ...TARGET, mode: 'walking' }, 'android'),
  );
});

test('iOS opens Apple Maps directly', () => {
  const url = directionsUrl({ ...TARGET, mode: 'walking' }, 'ios');
  assert.ok(url.startsWith('maps://?daddr=21.0305,105.7887'), url);
  assert.ok(url.includes('dirflg=w'), url);
});

test('Apple has no motorbike, so a bike routes as driving', () => {
  const bike = directionsUrl({ ...TARGET, mode: 'two_wheeler' }, 'ios');
  const car = directionsUrl({ ...TARGET, mode: 'driving' }, 'ios');
  assert.ok(bike.includes('dirflg=d'), bike);
  assert.ok(car.includes('dirflg=d'), car);
});

test('every travel mode maps to an Apple flag', () => {
  for (const mode of [...TRAVEL_MODES, 'transit' as const]) {
    const url = directionsUrl({ ...TARGET, mode }, 'ios');
    assert.ok(/dirflg=[wrd]&?/.test(url), `${mode} produced ${url}`);
  }
});

test('a restaurant name with a space survives the URL', () => {
  const url = directionsUrl(TARGET, 'ios');
  assert.ok(url.includes('q=Qu%C3%A1n%20B%C3%BAn%20Ch%E1%BA%A3%20H%C3%A0ng%20Qu%E1%BA%A1t'), url);
  assert.ok(!url.includes('Quán Bún'), 'the raw name must not be left unencoded');
});

test('an unnamed destination is still routable', () => {
  const url = directionsUrl({ lat: 21.0305, lng: 105.7887 }, 'ios');
  assert.ok(url.includes('daddr=21.0305,105.7887'), url);
  assert.ok(!url.includes('&q='), 'no label means no empty q parameter');
});

test('a negative longitude survives — this code should not be Hanoi-only', () => {
  const url = directionsUrl({ lat: -33.8688, lng: 151.2093 }, 'android');
  assert.ok(url.includes('destination=-33.8688%2C151.2093'), url);
});

test('showing a place is not the same as routing to it', () => {
  assert.ok(!placeUrl(TARGET, 'android').includes('dir'), 'must not start navigation');
  assert.ok(placeUrl(TARGET, 'android').startsWith('geo:21.0305,105.7887'));
  assert.ok(placeUrl(TARGET, 'ios').startsWith('maps://?ll=21.0305,105.7887'));
  assert.ok(placeUrl(TARGET, 'web').includes('query=21.0305,105.7887'));
});

test('a short hop defaults to walking, a real trip to the bike', () => {
  assert.equal(defaultTravelMode(0), 'walking');
  assert.equal(defaultTravelMode(WALKABLE_BELOW_M), 'walking');
  assert.equal(defaultTravelMode(WALKABLE_BELOW_M + 1), 'two_wheeler');
  assert.equal(defaultTravelMode(3_000), 'two_wheeler');
});

test('the walkable threshold is a realistic walk, not a marathon', () => {
  // walkMinutes() paces Hanoi pavements at 80 m/min, so this is under ten
  // minutes on foot — past that, getting the bike out wins.
  assert.ok(WALKABLE_BELOW_M > 200 && WALKABLE_BELOW_M <= 1_000);
});
