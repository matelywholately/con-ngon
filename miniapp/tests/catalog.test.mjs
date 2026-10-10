import test from 'node:test';
import assert from 'node:assert/strict';
import { mealCatalog } from '../src/catalog.ts';
import { fixtureListings } from '../../src/lib/fixtures.ts';

const now = new Date('2026-10-06T12:00:00Z');
const meals = fixtureListings.map((meal, index) => ({ ...meal,
  pickup_until: new Date(+now + (index + 1) * 20 * 60_000).toISOString(),
  safety_deadline: new Date(+now + (index + 1) * 15 * 60_000).toISOString(),
}));
test('Vietnamese search matches unaccented words across dish and restaurant fields', () => {
  assert.equal(mealCatalog(meals, now, '  dau phu AN LAC ')[0].id, meals[3].id);
  assert.equal(mealCatalog(meals, now, 'banh mi').length, 1);
});
test('filters respect dietary fields, price and the earlier safety deadline', () => {
  assert.deepEqual(mealCatalog(meals, now, '', 'vegetarian').map(m => m.id), [meals[3].id, meals[4].id]);
  assert.equal(mealCatalog([{ ...meals[0], price_vnd: 25_001 }], now, '', 'budget').length, 0);
  assert.equal(mealCatalog(meals, now, '', 'soon').length, 2);
});
test('sorting leaves source intact and never brings back expired or sold-out meals', () => {
  const source = [...meals].reverse();
  const result = mealCatalog([...source, { ...meals[0], id: 'empty', portions_left: 0 },
    { ...meals[0], id: 'expired', safety_deadline: now.toISOString() }], now, '', 'all', 'price');
  assert.equal(result.length, 5); assert.equal(result[0].price_vnd, 0);
  assert.equal(source[0].id, meals[4].id);
  assert.equal(mealCatalog(source, now, '', 'all', 'deadline')[0].id, meals[0].id);
});
