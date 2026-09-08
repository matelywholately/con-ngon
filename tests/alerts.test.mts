import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_MAX_PER_RUN,
  alertsFor,
  createRecordingSender,
  isQuietHour,
  isReachable,
} from '../src/lib/alerts.ts';
import type { Favourite } from '../src/lib/alerts.ts';
import type { NearbyListing } from '../src/lib/types.ts';

/** 18:00 local — inside the evening window when surplus actually appears. */
const NOW = new Date('2026-09-08T18:00:00');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

function listing(over: Partial<NearbyListing> & { id: string }): NearbyListing {
  return {
    restaurant_id: 'r1',
    title: 'Cơm rang dưa bò',
    description: null,
    photo_url: null,
    portions_total: 4,
    portions_left: 2,
    price_vnd: 20_000,
    original_price_vnd: 45_000,
    handling_class: 'hot',
    prepared_at: at(-30),
    pickup_from: at(-10),
    pickup_until: at(120),
    safety_deadline: at(120),
    status: 'live',
    allergens: [],
    is_vegetarian: false,
    created_at: at(-10),
    restaurant_name: 'Cơm Bình Dân Dịch Vọng',
    restaurant_address: '87 Dịch Vọng Hậu, Cầu Giấy',
    restaurant_lat: 21.0361,
    restaurant_lng: 105.7823,
    distance_m: 400,
    ...over,
  };
}

const follows = (over: Partial<Favourite> = {}): Favourite[] => [
  { restaurantId: 'r1', notify: true, ...over },
];

test('a followed kitchen with something listed produces an alert', () => {
  const alerts = alertsFor(follows(), [listing({ id: 'a' })], { now: NOW });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.listingId, 'a');
  assert.equal(alerts[0]!.restaurantName, 'Cơm Bình Dân Dịch Vọng');
});

test('a kitchen nobody follows produces nothing', () => {
  const alerts = alertsFor(follows(), [listing({ id: 'a', restaurant_id: 'r9' })], {
    now: NOW,
  });
  assert.deepEqual(alerts, []);
});

test('following without notifications is a shortlist, not a subscription', () => {
  const alerts = alertsFor(follows({ notify: false }), [listing({ id: 'a' })], {
    now: NOW,
  });
  assert.deepEqual(alerts, []);
});

test('nobody is told twice about the same listing', () => {
  const alerts = alertsFor(follows(), [listing({ id: 'a' })], {
    now: NOW,
    alreadySent: new Set(['a']),
  });
  assert.deepEqual(alerts, []);
});

test('sold out and expired listings are not worth a buzz', () => {
  const alerts = alertsFor(
    follows(),
    [
      listing({ id: 'gone', portions_left: 0 }),
      listing({ id: 'closed', status: 'sold_out' }),
      listing({ id: 'over', pickup_until: at(-5), safety_deadline: at(-5) }),
    ],
    { now: NOW },
  );
  assert.deepEqual(alerts, []);
});

test('an alert nobody could walk to in time is not sent', () => {
  // 2km is a 25-minute walk; 15 minutes of food life cannot absorb that.
  const tooFar = listing({
    id: 'far',
    distance_m: 2_000,
    pickup_until: at(15),
    safety_deadline: at(15),
  });
  assert.equal(isReachable(tooFar, NOW), false);
  assert.deepEqual(alertsFor(follows(), [tooFar], { now: NOW }), []);
});

test('the same food nearby is worth sending', () => {
  const close = listing({
    id: 'near',
    distance_m: 300,
    pickup_until: at(40),
    safety_deadline: at(40),
  });
  assert.equal(isReachable(close, NOW), true);
  assert.equal(alertsFor(follows(), [close], { now: NOW }).length, 1);
});

test('a canteen dumping eight trays does not send eight buzzes', () => {
  const trays = Array.from({ length: 8 }, (_, i) => listing({ id: `t${i}` }));
  const alerts = alertsFor(follows(), trays, { now: NOW });
  assert.equal(alerts.length, ALERT_MAX_PER_RUN);
});

test('when only some can be sent, the ones closest to being binned go first', () => {
  const alerts = alertsFor(
    follows(),
    [
      listing({ id: 'later', pickup_until: at(110), safety_deadline: at(110) }),
      listing({ id: 'soonest', pickup_until: at(35), safety_deadline: at(35) }),
      listing({ id: 'middle', pickup_until: at(70), safety_deadline: at(70) }),
    ],
    { now: NOW, maxPerRun: 2 },
  );
  assert.deepEqual(alerts.map((a) => a.listingId), ['soonest', 'middle']);
});

test('nothing is sent during quiet hours, however much is going spare', () => {
  for (const hour of [22, 23, 0, 3, 6]) {
    const night = new Date(NOW);
    night.setHours(hour, 0, 0, 0);
    assert.equal(isQuietHour(night), true, `${hour}:00 should be quiet`);
    assert.deepEqual(
      alertsFor(follows(), [listing({ id: 'a' })], { now: night }),
      [],
      `${hour}:00 sent something`,
    );
  }
});

test('the evening service window is not quiet', () => {
  for (const hour of [7, 12, 18, 21]) {
    const evening = new Date(NOW);
    evening.setHours(hour, 0, 0, 0);
    assert.equal(isQuietHour(evening), false, `${hour}:00 should be sendable`);
  }
});

test('the alert carries what the notification has to say', () => {
  const [alert] = alertsFor(follows(), [listing({ id: 'a', distance_m: 640 })], {
    now: NOW,
  });
  assert.equal(alert!.title, 'Cơm rang dưa bò');
  assert.equal(alert!.priceVnd, 20_000);
  assert.equal(alert!.distanceM, 640);
  assert.ok(alert!.minutesLeft > 0);
});

test('the whole path runs today, without any push credentials', () => {
  const sender = createRecordingSender();
  const alerts = alertsFor(follows(), [listing({ id: 'a' })], { now: NOW });
  return sender.send(alerts).then(() => {
    assert.equal(sender.sent.length, 1);
    assert.equal(sender.sent[0]!.listingId, 'a');
  });
});
