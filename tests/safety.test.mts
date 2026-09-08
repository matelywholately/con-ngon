import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREPARED_BUCKETS,
  bucketRemainingMinutes,
  preparedAtFromBucket,
  HANDLING_RULES,
  effectiveDeadline,
  listingWindow,
  minutesRemaining,
  safetyDeadline,
  urgencyOf,
  validateListing,
} from '../src/lib/safety.ts';

const at = (iso: string) => new Date(iso);
const PREPARED = at('2026-09-04T18:30:00+07:00');

test('hot food gets 4h danger-zone allowance minus a 1h consumer buffer', () => {
  assert.equal(
    safetyDeadline(PREPARED, 'hot').toISOString(),
    at('2026-09-04T21:30:00+07:00').toISOString(),
  );
});

test('every handling class reserves a buffer it does not hand to the eater', () => {
  for (const [name, rule] of Object.entries(HANDLING_RULES)) {
    assert.ok(
      rule.consumerBufferMinutes >= 0 &&
        rule.consumerBufferMinutes < rule.maxDangerZoneMinutes,
      `${name} has an unusable buffer`,
    );
  }
});

test('chilled holds far longer than hot for identical prep time', () => {
  assert.ok(
    safetyDeadline(PREPARED, 'chilled').getTime() >
      safetyDeadline(PREPARED, 'hot').getTime(),
  );
});

test('closing time wins when it lands before the safety deadline', () => {
  const closing = at('2026-09-04T20:00:00+07:00');
  assert.equal(
    effectiveDeadline(PREPARED, 'hot', closing).toISOString(),
    closing.toISOString(),
  );
});

test('safety wins when the restaurant would stay open past it', () => {
  const closing = at('2026-09-05T02:00:00+07:00');
  assert.equal(
    effectiveDeadline(PREPARED, 'hot', closing).toISOString(),
    safetyDeadline(PREPARED, 'hot').toISOString(),
  );
});

test('a restaurant cannot extend its window past the safety limit', () => {
  // The whole point: pickupUntil is an input, but it can only ever shorten.
  const greedy = at('2026-09-06T23:00:00+07:00');
  const deadline = effectiveDeadline(PREPARED, 'hot', greedy);
  assert.ok(deadline.getTime() <= safetyDeadline(PREPARED, 'hot').getTime());
});

test('minutesRemaining floors and never goes negative', () => {
  const deadline = at('2026-09-04T20:00:00+07:00');
  assert.equal(minutesRemaining(deadline, at('2026-09-04T19:30:30+07:00')), 29);
  assert.equal(minutesRemaining(deadline, at('2026-09-04T21:00:00+07:00')), 0);
});

test('urgency thresholds', () => {
  const deadline = at('2026-09-04T20:00:00+07:00');
  assert.equal(urgencyOf(deadline, at('2026-09-04T18:00:00+07:00')), 'fresh');
  assert.equal(urgencyOf(deadline, at('2026-09-04T18:45:00+07:00')), 'soon');
  assert.equal(urgencyOf(deadline, at('2026-09-04T19:45:00+07:00')), 'urgent');
  assert.equal(urgencyOf(deadline, at('2026-09-04T20:00:00+07:00')), 'expired');
});

test('listingWindow reports which limit is binding', () => {
  const early = listingWindow({
    preparedAt: PREPARED,
    handling: 'hot',
    pickupFrom: at('2026-09-04T19:00:00+07:00'),
    pickupUntil: at('2026-09-04T20:00:00+07:00'),
    now: at('2026-09-04T19:10:00+07:00'),
  });
  assert.equal(early.limitedByOpeningHours, true);
  assert.equal(early.isCollectable, true);
  assert.equal(early.minutesRemaining, 50);
});

test('not collectable before the pickup window opens', () => {
  const w = listingWindow({
    preparedAt: PREPARED,
    handling: 'hot',
    pickupFrom: at('2026-09-04T19:00:00+07:00'),
    pickupUntil: at('2026-09-04T21:00:00+07:00'),
    now: at('2026-09-04T18:40:00+07:00'),
  });
  assert.equal(w.isCollectable, false);
});

test('food prepared this morning cannot be listed tonight as hot', () => {
  const result = validateListing({
    preparedAt: at('2026-09-04T08:00:00+07:00'),
    handling: 'hot',
    pickupFrom: at('2026-09-04T19:00:00+07:00'),
    pickupUntil: at('2026-09-04T21:00:00+07:00'),
    now: at('2026-09-04T19:00:00+07:00'),
  });
  assert.deepEqual(result, { ok: false, reason: 'already_past_safety_deadline' });
});

test('the same food is listable when it was genuinely chilled', () => {
  const result = validateListing({
    preparedAt: at('2026-09-04T08:00:00+07:00'),
    handling: 'chilled',
    pickupFrom: at('2026-09-04T19:00:00+07:00'),
    pickupUntil: at('2026-09-04T21:00:00+07:00'),
    now: at('2026-09-04T19:00:00+07:00'),
  });
  assert.equal(result.ok, true);
});

test('a future prepared_at beyond clock skew is rejected', () => {
  const result = validateListing({
    preparedAt: at('2026-09-04T20:00:00+07:00'),
    handling: 'hot',
    pickupFrom: at('2026-09-04T19:00:00+07:00'),
    pickupUntil: at('2026-09-04T21:00:00+07:00'),
    now: at('2026-09-04T19:00:00+07:00'),
  });
  assert.deepEqual(result, { ok: false, reason: 'prepared_in_future' });
});

test('small clock skew is tolerated', () => {
  const result = validateListing({
    preparedAt: at('2026-09-04T19:02:00+07:00'),
    handling: 'hot',
    pickupFrom: at('2026-09-04T19:00:00+07:00'),
    pickupUntil: at('2026-09-04T21:00:00+07:00'),
    now: at('2026-09-04T19:00:00+07:00'),
  });
  assert.equal(result.ok, true);
});

test('an inverted pickup window is rejected', () => {
  const result = validateListing({
    preparedAt: PREPARED,
    handling: 'hot',
    pickupFrom: at('2026-09-04T21:00:00+07:00'),
    pickupUntil: at('2026-09-04T19:00:00+07:00'),
    now: at('2026-09-04T18:40:00+07:00'),
  });
  assert.deepEqual(result, { ok: false, reason: 'window_ends_before_it_starts' });
});

// --------------------------------------------------- prepared-time buckets

test('a bucket is read at its worst case, not its best', () => {
  const now = new Date('2026-09-08T18:00:00+07:00');
  // "1 – 2 giờ" must count as two hours, not one. Reading it as one would
  // hand out an extra hour of safe life on food that has three in total.
  assert.equal(
    preparedAtFromBucket('under120', now).toISOString(),
    new Date(now.getTime() - 120 * 60_000).toISOString(),
  );
  assert.equal(
    preparedAtFromBucket('under30', now).toISOString(),
    new Date(now.getTime() - 30 * 60_000).toISOString(),
  );
});

test('every bucket is pessimistic about elapsed time', () => {
  const now = new Date('2026-09-08T18:00:00+07:00');
  for (const bucket of PREPARED_BUCKETS) {
    const preparedAt = preparedAtFromBucket(bucket.id, now);
    assert.ok(
      preparedAt.getTime() <= now.getTime() - bucket.worstCaseMinutes * 60_000,
      `${bucket.id} is not pessimistic enough`,
    );
  }
});

test('buckets are ordered and cover the three hours hot food gets', () => {
  const minutes = PREPARED_BUCKETS.map((b) => b.worstCaseMinutes);
  assert.deepEqual(minutes, [...minutes].sort((a, b) => a - b), 'buckets must ascend');
  assert.equal(Math.max(...minutes), 180, 'the widest bucket is the hot-food limit');
});

test('the oldest bucket leaves hot food nothing, and says so', () => {
  // 240 danger-zone minutes less a 60-minute consumer buffer is 180 usable.
  // Three-hour-old rice is waste, not surplus, and must not be listable.
  assert.equal(bucketRemainingMinutes('under180', 'hot'), 0);
  assert.ok(bucketRemainingMinutes('under120', 'hot') > 0);
});

test('the same bucket is generous to food that is being held cold', () => {
  // Chilled gets 1320 usable minutes, so three hours is nothing to it.
  assert.ok(bucketRemainingMinutes('under180', 'chilled') > 1000);
  assert.ok(bucketRemainingMinutes('under180', 'ambient') > 400);
});

test('a bucket that leaves no time is rejected by validateListing', () => {
  const now = new Date('2026-09-08T18:00:00+07:00');
  const result = validateListing({
    preparedAt: preparedAtFromBucket('under180', now),
    handling: 'hot',
    pickupFrom: now,
    pickupUntil: new Date(now.getTime() + 60 * 60_000),
    now,
  });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, 'already_past_safety_deadline');
});

test('an unknown bucket id is an error, not a silent zero', () => {
  assert.throws(
    () => preparedAtFromBucket('under90' as never, new Date()),
    /unknown prepared bucket/,
  );
});
