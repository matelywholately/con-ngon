/**
 * Handing a destination to the phone's map app.
 *
 * We do not draw the route ourselves. Turn-by-turn is a solved problem that
 * Google Maps does better than we ever will, it needs a billed Directions API
 * key, and a straight line between two points is not a route — in Hàng Quạt's
 * alleys it is actively misleading. So the app opens the map the person
 * already uses, already trusts, and already has downloaded offline.
 *
 * Pure — it builds a string and returns it. That is deliberate: a deep link
 * that silently builds the wrong URL fails by opening the wrong place, which
 * is the kind of bug nobody notices until someone is standing in the wrong
 * street. Here it is asserted in `tests/directions.test.mts` instead.
 */
import type { Coords } from './geo.ts';

/**
 * How the person is getting there.
 *
 * `two_wheeler` is the default because Hanoi moves by motorbike, and Google
 * supports that mode in Vietnam specifically — it routes down the lanes and
 * one-way exceptions a car route will not use. Walking stays first-class:
 * inside a few hundred metres it is faster than parking.
 */
export type TravelMode = 'two_wheeler' | 'walking' | 'driving' | 'transit';

export const TRAVEL_MODES: readonly TravelMode[] = [
  'two_wheeler',
  'walking',
  'driving',
];

/**
 * Below this many metres, walking beats getting the bike out — the parking
 * alone costs more than the walk. Used to pick the default mode.
 */
export const WALKABLE_BELOW_M = 700;

export function defaultTravelMode(distanceM: number): TravelMode {
  return distanceM <= WALKABLE_BELOW_M ? 'walking' : 'two_wheeler';
}

/** Apple Maps' `dirflg`, which has no motorbike flag — bikes route as driving. */
function appleDirFlag(mode: TravelMode): string {
  switch (mode) {
    case 'walking':
      return 'w';
    case 'transit':
      return 'r';
    case 'driving':
    case 'two_wheeler':
      return 'd';
  }
}

export type DirectionsTarget = Coords & {
  /** Shown as the destination's name in the map app, rather than a raw pin. */
  label?: string;
  mode?: TravelMode;
};

/**
 * The URL that opens directions to a place.
 *
 * `platform` is passed in rather than read from `Platform.OS` so this module
 * stays pure and every branch is reachable from a test on any machine.
 *
 * - **iOS** gets `maps://`, which opens Apple Maps directly. It has no
 *   two-wheeler mode, so a motorbike routes as driving.
 * - **Android** gets Google's universal `https://` URL rather than the `geo:`
 *   scheme, because `geo:` cannot carry a travel mode at all — and the mode is
 *   the part that matters here.
 * - **Anything else** — the web build — gets the same universal URL.
 */
export function directionsUrl(
  target: DirectionsTarget,
  platform: 'ios' | 'android' | 'web',
): string {
  const { lat, lng, label, mode = 'two_wheeler' } = target;
  const destination = `${lat},${lng}`;

  if (platform === 'ios') {
    const query = label ? `&q=${encodeURIComponent(label)}` : '';
    return `maps://?daddr=${destination}&dirflg=${appleDirFlag(mode)}${query}`;
  }

  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * The URL that shows a place without starting a route — for "where is this",
 * as opposed to "take me there".
 */
export function placeUrl(
  target: Coords & { label?: string },
  platform: 'ios' | 'android' | 'web',
): string {
  const point = `${target.lat},${target.lng}`;
  const label = target.label ? encodeURIComponent(target.label) : '';

  if (platform === 'ios') {
    return label ? `maps://?ll=${point}&q=${label}` : `maps://?ll=${point}`;
  }
  if (platform === 'android') {
    return label ? `geo:${point}?q=${point}(${label})` : `geo:${point}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${point}`;
}
