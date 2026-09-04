import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
