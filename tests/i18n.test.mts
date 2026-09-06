import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolate, plural, pluralForm } from '../src/i18n/strings.ts';
import { en } from '../src/i18n/en.ts';
import { vi } from '../src/i18n/vi.ts';

test('English takes the singular at exactly one, and nowhere else', () => {
  assert.equal(plural(en.offer.portions, 1), '1 portion');
  assert.equal(plural(en.offer.portions, 6), '6 portions');
  // Zero is plural in English: "0 portions", never "0 portion".
  assert.equal(plural(en.offer.portions, 0), '0 portions');
  assert.equal(plural(en.discover.subtitle, 1), '1 meal available now');
  assert.equal(plural(en.discover.subtitle, 5), '5 meals available now');
  assert.equal(plural(en.profile.mealsSaved, 1), '1 meal rescued');
});

test('Vietnamese has one form, so the count never changes the words', () => {
  assert.equal(plural(vi.offer.portions, 1), '1 suất');
  assert.equal(plural(vi.offer.portions, 6), '6 suất');
  assert.equal(plural(vi.discover.subtitle, 1), 'Còn 1 suất đang bán');
  assert.equal(plural(vi.profile.mealsSaved, 1), '1 suất được cứu');
});

test('pluralForm treats minus one as singular and leaves plain strings alone', () => {
  assert.equal(pluralForm({ one: 'a', other: 'b' }, -1), 'a');
  assert.equal(pluralForm({ one: 'a', other: 'b' }, 2), 'b');
  assert.equal(pluralForm('only one form', 7), 'only one form');
});

test('plural exposes the count as {n} and still takes other placeholders', () => {
  assert.equal(plural('{n} of {total}', 3, { total: 9 }), '3 of 9');
});

test('interpolate leaves a placeholder it has no value for visible', () => {
  assert.equal(interpolate('{a} and {b}', { a: 'x' }), 'x and {b}');
  assert.equal(interpolate('nothing to do'), 'nothing to do');
});

/** Every path in a dictionary whose value is a `{one, other}` pair. */
function pluralPaths(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object') return [];
  const record = node as Record<string, unknown>;
  if (typeof record.one === 'string' && typeof record.other === 'string') {
    return [prefix];
  }
  return Object.entries(record).flatMap(([key, value]) =>
    pluralPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

/**
 * The type system makes a *missing key* a build error, but a key the
 * Vietnamese source marked `Countable` would still typecheck if `en.ts`
 * answered with a bare string — and would quietly read "1 portions" again.
 * Pinning the list closes that gap from both directions: a forgotten English
 * plural drops a path, an unmarked new one adds it.
 */
test('English supplies both forms for exactly the countable keys', () => {
  assert.deepEqual(pluralPaths(en).sort(), [
    'discover.subtitle',
    'offer.portions',
    'profile.mealsSaved',
  ]);
});

test('Vietnamese needs no plural pairs at all', () => {
  assert.deepEqual(pluralPaths(vi), []);
});
