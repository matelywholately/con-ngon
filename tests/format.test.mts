import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discountPercent,
  formatCountdown,
  formatDistance,
  formatPickupCode,
  formatTime,
  formatVnd,
  normalisePhone,
  walkMinutes,
} from '../src/lib/format.ts';

test('VND uses dots as thousands separators', () => {
  assert.equal(formatVnd(25000), '25.000₫');
  assert.equal(formatVnd(1250000), '1.250.000₫');
  assert.equal(formatVnd(999), '999₫');
  assert.equal(formatVnd(0), '0₫');
});

test('discount rounds down so the saving is never overstated', () => {
  assert.equal(discountPercent(25000, 60000), 58);
  assert.equal(discountPercent(30000, 60000), 50);
  assert.equal(discountPercent(60000, 60000), null);
  assert.equal(discountPercent(70000, 60000), null);
  assert.equal(discountPercent(0, 0), null);
});

test('times use a 24-hour clock', () => {
  assert.equal(formatTime(new Date(2026, 8, 4, 18, 5)), '18:05');
  assert.equal(formatTime(new Date(2026, 8, 4, 9, 30)), '09:30');
});

test('countdown switches to hours past 60 minutes', () => {
  assert.equal(formatCountdown(45), '0:45');
  assert.equal(formatCountdown(75), '1:15');
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(-5), '0:00');
});

test('distance switches unit at a kilometre', () => {
  assert.equal(formatDistance(450), '450m');
  assert.equal(formatDistance(1200), '1,2km');
});

test('walking time never rounds to zero', () => {
  assert.equal(walkMinutes(40), 1);
  assert.equal(walkMinutes(800), 10);
});

test('pickup codes are zero padded to four digits', () => {
  assert.equal(formatPickupCode('421'), '0421');
  assert.equal(formatPickupCode('1234'), '1234');
});

test('Vietnamese mobile numbers normalise to E.164', () => {
  assert.equal(normalisePhone('0912345678'), '+84912345678');
  assert.equal(normalisePhone('091 234 5678'), '+84912345678');
  assert.equal(normalisePhone('+84912345678'), '+84912345678');
  assert.equal(normalisePhone('84912345678'), '+84912345678');
  assert.equal(normalisePhone('0312345678'), '+84312345678');
});

test('invalid phone numbers are rejected rather than guessed at', () => {
  assert.equal(normalisePhone('0112345678'), null);
  assert.equal(normalisePhone('091234567'), null);
  assert.equal(normalisePhone('abc'), null);
});
