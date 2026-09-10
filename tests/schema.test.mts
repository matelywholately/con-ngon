import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HANDLING_RULES, type HandlingClass } from '../src/lib/safety.ts';

/**
 * Tests over the migration SQL itself.
 *
 * AGENTS.md states that the safety intervals are mirrored between
 * `src/lib/safety.ts` and the schema, and that changing one means changing the
 * other. Nothing enforced that: the two could drift silently and the first
 * symptom would be a deadline in the database disagreeing with the deadline on
 * the card, on food, in a way no test would catch.
 *
 * These also cover the two defects found the first time these migrations were
 * run against a real Postgres, both of which are the kind that can only fail
 * at apply time and so had never failed at all.
 */

const DIR = new URL('../supabase/migrations/', import.meta.url).pathname;
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const sql = (f: string) => readFileSync(join(DIR, f), 'utf8');
const ALL = FILES.map(sql).join('\n');

test('every migration file is discovered', () => {
  assert.ok(FILES.length >= 10, `expected the migration set, found ${FILES.length}`);
});

// ------------------------------------------------------- the safety mirror

test('safety_window_minutes() matches HANDLING_RULES exactly', () => {
  const body = ALL.match(
    /create or replace function safety_window_minutes[\s\S]*?\$\$([\s\S]*?)\$\$/,
  );
  assert.ok(body, 'safety_window_minutes() not found in the migrations');

  for (const [cls, rule] of Object.entries(HANDLING_RULES)) {
    const expected = rule.maxDangerZoneMinutes - rule.consumerBufferMinutes;
    const found = body[1].match(new RegExp(`when\\s+'${cls}'\\s+then\\s+(\\d+)`));
    assert.ok(found, `handling class '${cls}' is missing from the SQL`);
    assert.equal(
      Number(found[1]),
      expected,
      `'${cls}': SQL says ${found[1]} minutes, safety.ts says ${expected}`,
    );
  }
});

test('the SQL covers every handling class the app knows about', () => {
  const body = ALL.match(
    /create or replace function safety_window_minutes[\s\S]*?\$\$([\s\S]*?)\$\$/,
  )!;
  const inSql = [...body[1].matchAll(/when\s+'(\w+)'\s+then/g)].map((m) => m[1]).sort();
  const inTs = (Object.keys(HANDLING_RULES) as HandlingClass[]).slice().sort();
  assert.deepEqual(inSql, inTs);
});

/**
 * The deadline is a GENERATED column, and Postgres only accepts immutable
 * expressions there. `timestamptz + interval` is merely STABLE, so writing the
 * addition inline fails at apply time with "generation expression is not
 * immutable" -- which is what it did, the first time this schema met a real
 * database. The immutable wrapper is the fix, and it has to stay immutable.
 */
test('the generated deadline goes through an immutable function', () => {
  // Bounded at the function's own body delimiter. An unbounded `[\s\S]*?`
  // here happily runs past the end of this function and matches the
  // `language sql immutable` on some later one -- which it did, and the test
  // passed while the declaration said `stable`.
  const header = ALL.match(/create or replace function safety_deadline_of([\s\S]*?)\$\$/);
  assert.ok(header, 'safety_deadline_of() not found in the migrations');
  assert.match(
    header[1],
    /language sql immutable/,
    'safety_deadline_of() must be declared immutable or the schema will not apply',
  );
  assert.match(
    ALL,
    /generated always as \(\s*safety_deadline_of\(prepared_at, handling_class\)\s*\) stored/,
    'safety_deadline must be generated through safety_deadline_of()',
  );
});

// ------------------------------------------------------------ UUID literals

/**
 * The seed used ids beginning `r1000000-`, meaning "restaurant". `r` is not a
 * hex digit, so every one of them was rejected by Postgres as invalid input
 * for type uuid -- across two migrations, unnoticed, because the SQL had never
 * been run.
 */
test('every uuid literal in the migrations is a valid uuid', () => {
  const shaped = /'[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}'/g;
  const valid = /^'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'$/i;

  for (const file of FILES) {
    for (const literal of sql(file).match(shaped) ?? []) {
      assert.match(literal, valid, `${file}: ${literal} is not valid hex`);
    }
  }
});

// -------------------------------------------------------------------- RLS

/**
 * "RLS on every table, no exceptions" -- AGENTS.md. The app ships the anon key
 * inside its own bundle, so a table without RLS is readable in full by anyone
 * who unzips the APK.
 */
test('every table created gets row level security enabled', () => {
  const created = [...ALL.matchAll(/create table (?:if not exists )?(\w+)/g)].map((m) => m[1]);
  assert.ok(created.length > 0, 'no tables found');

  for (const table of created) {
    assert.match(
      ALL,
      new RegExp(`alter table ${table}\\s+enable row level security`),
      `table '${table}' is created but never has RLS enabled`,
    );
  }
});
