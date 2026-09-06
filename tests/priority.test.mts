import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIORITY_MINUTES,
  canReserveNow,
  freeTrackWindow,
  hasSupportCredit,
} from '../src/lib/priority.ts';

const NOW = new Date('2026-09-06T19:00:00+07:00');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

const FREE = 0;
const PAID = 20_000;

test('a priced listing has no priority window at all', () => {
  const w = freeTrackWindow({
    priceVnd: PAID,
    listedAt: at(-5),
    deadline: at(120),
    now: NOW,
  });
  assert.equal(w.isFree, false);
  assert.equal(w.priorityUntil, null);
  assert.equal(w.inPriorityWindow, false);
  // Anyone may take it, credit or not — the discount is the whole offer.
  assert.equal(canReserveNow(w, 0), true);
});

test('a fresh free listing is held for credit holders', () => {
  const w = freeTrackWindow({
    priceVnd: FREE,
    listedAt: at(-5),
    deadline: at(180),
    now: NOW,
  });
  assert.equal(w.inPriorityWindow, true);
  // 185 minutes of life, so the 30-minute cap binds, not the half rule.
  assert.deepEqual(w.priorityUntil, at(-5 + PRIORITY_MINUTES));
  assert.equal(canReserveNow(w, 0), false);
  assert.equal(canReserveNow(w, 50_000), true);
});

test('the window opens to everyone once it passes', () => {
  const w = freeTrackWindow({
    priceVnd: FREE,
    listedAt: at(-45),
    deadline: at(120),
    now: NOW,
  });
  assert.equal(w.inPriorityWindow, false);
  // Not wasted: with nobody eligible nearby, a paying user can still take it.
  assert.equal(canReserveNow(w, 0), true);
});

test('the window never exceeds half the life left', () => {
  // Listed 2 minutes ago with 40 minutes to go: 42 minutes of life, so the
  // half rule binds at 21 minutes rather than the 30-minute cap.
  const w = freeTrackWindow({
    priceVnd: FREE,
    listedAt: at(-2),
    deadline: at(40),
    now: NOW,
  });
  assert.deepEqual(w.priorityUntil, at(19));
  assert.equal(w.inPriorityWindow, true);
});

test('a listing past its deadline holds nothing back', () => {
  // 89 minutes of life, so it did get a window — it simply expired long ago.
  const w = freeTrackWindow({
    priceVnd: FREE,
    listedAt: at(-90),
    deadline: at(-1),
    now: NOW,
  });
  assert.deepEqual(w.priorityUntil, at(-60));
  assert.equal(w.inPriorityWindow, false);
  assert.equal(canReserveNow(w, 0), true);
});

test('a listing with no life at all gets no window', () => {
  // Deadline at or before the moment it was listed: there is nothing to
  // allocate, so there is nothing to hold back either.
  for (const deadline of [at(-30), at(-30.0001)]) {
    const w = freeTrackWindow({
      priceVnd: FREE,
      listedAt: at(-30),
      deadline,
      now: NOW,
    });
    assert.equal(w.priorityUntil, null);
    assert.equal(w.inPriorityWindow, false);
    assert.equal(canReserveNow(w, 0), true);
  }
});

test('the boundary is exclusive, so the window ends cleanly', () => {
  const listedAt = at(-PRIORITY_MINUTES);
  const w = freeTrackWindow({
    priceVnd: FREE,
    listedAt,
    deadline: at(120),
    now: NOW,
  });
  assert.deepEqual(w.priorityUntil, NOW);
  assert.equal(w.inPriorityWindow, false, 'at the boundary it is already open');
});

test('eligibility is a positive balance, and zero is not eligible', () => {
  assert.equal(hasSupportCredit(1), true);
  assert.equal(hasSupportCredit(0), false);
  assert.equal(hasSupportCredit(-1), false);
});
