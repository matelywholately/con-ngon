/**
 * Deciding what is worth interrupting someone for.
 *
 * Following a kitchen is the answer to the liquidity problem — surplus cannot
 * be warehoused, so the app has to come to the eater rather than wait to be
 * opened. But an alert is a phone buzzing in someone's pocket, and the fastest
 * way to lose that channel is to spend it badly. Every rule below exists to
 * throw an alert away.
 *
 * Pure — no React, no push SDK, no I/O. What to send is decided here and
 * tested under `node --test`; the sending lives behind `AlertSender` and is
 * the only part that needs credentials. That split is deliberate: the
 * judgement is the part that can be wrong in ways nobody notices, so it is
 * the part that gets tests.
 */
import { walkMinutes } from './format.ts';
import { minutesRemaining } from './safety.ts';
import { listingDeadline } from './stores.ts';
import type { NearbyListing } from './types.ts';

/** A store the eater has followed, and whether they want to be told. */
export type Favourite = {
  restaurantId: string;
  notify: boolean;
};

export type Alert = {
  listingId: string;
  restaurantId: string;
  restaurantName: string;
  title: string;
  priceVnd: number;
  distanceM: number;
  /** Minutes left when the alert was decided. */
  minutesLeft: number;
};

/**
 * Below this, there is no point telling anyone. If the walk is longer than
 * the food has left, the notification is an advert for something they cannot
 * have — and the second time that happens the alerts get turned off.
 */
export const ALERT_MIN_SLACK_MINUTES = 10;

/**
 * At most this many alerts per batch. A canteen closing for the day can list
 * eight trays at once; eight buzzes is not eight times as useful as one.
 */
export const ALERT_MAX_PER_RUN = 3;

/** Local hours during which nothing is sent, whatever is going spare. */
export const QUIET_FROM_HOUR = 22;
export const QUIET_UNTIL_HOUR = 7;

/** Whether the clock says it is a reasonable moment to buzz someone. */
export function isQuietHour(now: Date): boolean {
  const hour = now.getHours();
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

/**
 * Whether there is time to actually get there.
 *
 * `walkMinutes` paces Hanoi pavements at 80 m/min, the same figure the offer
 * cards use, so the promise the alert makes and the estimate the card shows
 * cannot disagree.
 */
export function isReachable(listing: NearbyListing, now: Date): boolean {
  const left = minutesRemaining(listingDeadline(listing), now);
  return left - walkMinutes(listing.distance_m) >= ALERT_MIN_SLACK_MINUTES;
}

/**
 * The alerts that should go out for one person, given what they follow and
 * what is currently listed.
 *
 * `alreadySent` is the set of listing ids they have been told about before.
 * It is passed in rather than tracked here so this stays pure and so the
 * caller can decide how long that memory lasts.
 */
export function alertsFor(
  favourites: readonly Favourite[],
  listings: readonly NearbyListing[],
  args: { alreadySent?: ReadonlySet<string>; now: Date; maxPerRun?: number },
): Alert[] {
  const { now, alreadySent = new Set<string>(), maxPerRun = ALERT_MAX_PER_RUN } = args;

  // Quiet hours beat everything. Food going to waste at midnight is a real
  // loss, and it is still not worth waking someone for.
  if (isQuietHour(now)) return [];

  const notifying = new Set(
    favourites.filter((f) => f.notify).map((f) => f.restaurantId),
  );
  if (notifying.size === 0) return [];

  return listings
    .filter(
      (listing) =>
        notifying.has(listing.restaurant_id) &&
        !alreadySent.has(listing.id) &&
        listing.status === 'live' &&
        listing.portions_left > 0 &&
        isReachable(listing, now),
    )
    // Soonest to expire first: if only some of these get sent, send the ones
    // that will otherwise be binned.
    .sort(
      (a, b) => listingDeadline(a).getTime() - listingDeadline(b).getTime(),
    )
    .slice(0, Math.max(0, maxPerRun))
    .map((listing) => ({
      listingId: listing.id,
      restaurantId: listing.restaurant_id,
      restaurantName: listing.restaurant_name,
      title: listing.title,
      priceVnd: listing.price_vnd,
      distanceM: listing.distance_m,
      minutesLeft: minutesRemaining(listingDeadline(listing), now),
    }));
}

/**
 * The one piece that needs credentials.
 *
 * Everything above is decided and tested offline; this is where a real Expo
 * push call goes. It is an interface rather than an implementation so the
 * rest of the app can be finished, run and reviewed without an Expo project
 * id, and so tests can assert on what *would* have been sent.
 */
export type AlertSender = {
  send: (alerts: readonly Alert[]) => Promise<void>;
};

/**
 * The sender used until push credentials exist. It records rather than sends,
 * which is what makes the whole path exercisable today — see
 * `tests/alerts.test.mts`.
 */
export function createRecordingSender(): AlertSender & { sent: Alert[] } {
  const sent: Alert[] = [];
  return {
    sent,
    async send(alerts) {
      sent.push(...alerts);
    },
  };
}
