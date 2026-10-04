import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Execute the actual lifecycle migrations on Postgres/WASM. PGlite lacks
// PostGIS: only geography and coordinate expressions are substituted. The
// unchanged nearby-listings RPC is omitted. Geo search needs a Supabase test.
const migration = async (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const eater = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const staff = '10000000-0000-4000-8000-000000000003';
const ngo = '10000000-0000-4000-8000-000000000004';
const restaurant = '20000000-0000-4000-8000-000000000001';
const firstListing = '30000000-0000-4000-8000-000000000001';
const secondListing = '30000000-0000-4000-8000-000000000002';

test('Postgres reservation lifecycle and access policies', async (t) => {
  const db = new PGlite();
  const login = async (id: string) => {
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  };
  const admin = async (sql: string, params: unknown[] = []) => {
    await db.exec('reset role');
    return db.query(sql, params);
  };
  const reserve = (id = firstListing, method = 'credit', request = randomUUID(), portions = 1) =>
    db.query<{ id: string; pickup_code: string; credit_used_vnd: number }>(
      'select * from reserve_listing($1, $2, $3, $4)', [id, portions, method, request]);
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, phone text);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth, public to anon, authenticated, service_role;
    `);
    const schema = (await migration('0001_schema.sql'))
      .replace('create extension if not exists postgis;', '')
      .replace('create extension if not exists pgcrypto;', '')
      .replace('geography(Point, 4326)', 'point')
      .replace('create index restaurants_location_idx on restaurants using gist (location);', '');
    await db.exec(schema);
    // Mirror Supabase's broad initial grants, then verify the migration narrows them.
    await db.exec('grant all on all tables in schema public to anon, authenticated, service_role');
    await db.exec(await migration('0002_rls.sql'));
    const originalFunctions = await migration('0003_functions.sql');
    await db.exec(originalFunctions.slice(originalFunctions.indexOf('create or replace function reserve_listing(')));
    const lifecycle = (await migration('0005_reservation_lifecycle.sql'))
      .replaceAll('st_y(r.location::geometry)', '(r.location)[1]')
      .replaceAll('st_x(r.location::geometry)', '(r.location)[0]');
    await db.exec(lifecycle);
    await db.exec(await migration('0006_backfill_profiles.sql'));

    t.beforeEach(async () => {
      await db.exec('reset role; truncate auth.users, profiles, restaurants, restaurant_staff, listings, orders, credit_ledger, reports cascade');
      for (const id of [eater, other, staff, ngo]) await db.query('insert into auth.users(id) values ($1)', [id]);
      await db.query("update profiles set credit_balance_vnd = 40000 where id = $1", [eater]);
      await db.query("update profiles set role = 'ngo' where id = $1", [ngo]);
      await db.query(`insert into restaurants(id, name, address, district, location, status)
        values ($1, 'Test kitchen', 'Hanoi', 'Cau Giay', point(105.8,21.03), 'approved')`, [restaurant]);
      await db.query('insert into restaurant_staff(restaurant_id, profile_id) values ($1,$2)', [restaurant, staff]);
      for (const id of [firstListing, secondListing]) await db.query(`insert into listings
        (id, restaurant_id, title, portions_total, portions_left, price_vnd, handling_class,
         prepared_at, pickup_from, pickup_until, status)
        values ($1,$2,'Dinner',2,2,20000,'hot',now(),now()-interval '1 minute',now()+interval '2 hours','live')`, [id, restaurant]);
    });

    await t.test('new auth users receive a profile; users cannot forge role, balance, or restaurant approval', async () => {
      await login(eater);
      assert.equal((await db.query('select * from profiles')).rows.length, 1);
      await assert.rejects(db.query("update profiles set role='admin' where id=$1", [eater]), /permission denied/);
      await assert.rejects(db.query('update profiles set credit_balance_vnd=999999 where id=$1', [eater]), /permission denied/);
      await db.query("update profiles set full_name='Minh', locale='en' where id=$1", [eater]);
      await assert.rejects(db.query('select issue_credit($1,20000,\'fake grant\')', [eater]), /not_credit_issuer/);
      await login(staff);
      await assert.rejects(db.query("update restaurants set status='approved' where id=$1", [restaurant]), /permission denied/);
    });
    await t.test('credit reservation debits the ledger and balance in the same transaction', async () => {
      await login(eater);
      const order = (await reserve()).rows[0]!;
      assert.equal(order.credit_used_vnd, 20000);
      assert.equal((await db.query<{ credit_balance_vnd: number }>('select credit_balance_vnd from profiles')).rows[0]!.credit_balance_vnd, 20000);
      assert.equal((await db.query<{ delta_vnd: number }>('select delta_vnd from credit_ledger')).rows[0]!.delta_vnd, -20000);
      const passes = (await db.query<{ my_orders: { id: string; listing: { restaurant: { lat: number } } }[] }>('select my_orders()')).rows[0]!.my_orders;
      assert.equal(passes[0]!.id, order.id);
      assert.equal(passes[0]!.listing.restaurant.lat, 21.03);
    });
    await t.test('retries are idempotent and mismatched reuse is rejected', async () => {
      await login(eater);
      const request = randomUUID();
      const a = (await reserve(firstListing, 'credit', request)).rows[0]!;
      const b = (await reserve(firstListing, 'credit', request)).rows[0]!;
      assert.equal(a.id, b.id);
      await assert.rejects(reserve(secondListing, 'credit', request), /request_conflict/);
      assert.equal((await db.query('select * from orders')).rows.length, 1);
      assert.equal((await db.query('select * from credit_ledger')).rows.length, 1);
    });
    await t.test('insufficient credit rolls back stock and order creation', async () => {
      await login(eater);
      await reserve(firstListing, 'credit', randomUUID(), 2);
      await assert.rejects(reserve(secondListing), /insufficient_credit/);
      assert.equal((await admin('select portions_left from listings where id=$1', [secondListing])).rows[0]!.portions_left, 2);
      assert.equal((await admin('select count(*)::int as n from orders')).rows[0]!.n, 1);
    });
    await t.test('cancellation restores sold-out stock and credit exactly once; direct edits cannot bypass it', async () => {
      await login(eater);
      const order = (await reserve(firstListing, 'credit', randomUUID(), 2)).rows[0]!;
      const passes = (await db.query<{ my_orders: unknown[] }>('select my_orders()')).rows[0]!.my_orders;
      assert.equal(passes.length, 1, 'sold-out listing still has a pickup pass');
      await assert.rejects(db.query("update orders set status='cancelled' where id=$1", [order.id]), /permission denied/);
      await db.query('select cancel_order($1)', [order.id]);
      await db.query('select cancel_order($1)', [order.id]);
      assert.equal((await db.query<{ credit_balance_vnd: number }>('select credit_balance_vnd from profiles')).rows[0]!.credit_balance_vnd, 40000);
      assert.equal((await db.query('select * from credit_ledger')).rows.length, 2);
      const stock = (await admin('select status, portions_left from listings where id=$1', [firstListing])).rows[0]!;
      assert.deepEqual(stock, { status: 'live', portions_left: 2 });
    });
    await t.test('one caller cannot cancel or read another caller’s order', async () => {
      await login(eater);
      const order = (await reserve()).rows[0]!;
      await login(other);
      await assert.rejects(db.query('select cancel_order($1)', [order.id]), /order_not_found/);
      assert.deepEqual((await db.query<{ my_orders: unknown[] }>('select my_orders()')).rows[0]!.my_orders, []);
    });
    await t.test('only restaurant staff collect; collected orders cannot be cancelled or collected twice', async () => {
      await login(eater);
      const order = (await reserve()).rows[0]!;
      await assert.rejects(db.query('select collect_order($1,$2)', [restaurant, order.pickup_code]), /not_staff/);
      await login(staff);
      await db.query('select collect_order($1,$2)', [restaurant, order.pickup_code]);
      await assert.rejects(db.query('select collect_order($1,$2)', [restaurant, order.pickup_code]), /code_not_found/);
      await login(eater);
      await assert.rejects(db.query('select cancel_order($1)', [order.id]), /order_not_reserved/);
    });
    await t.test('future pickup is reservable but handover waits for opening time', async () => {
      await admin("update listings set pickup_from=now()+interval '1 hour' where id=$1", [firstListing]);
      await login(eater);
      const order = (await reserve()).rows[0]!;
      await login(staff);
      await assert.rejects(db.query('select collect_order($1,$2)', [restaurant, order.pickup_code]), /pickup_not_started/);
    });
    await t.test('expired reservations cannot be handed over or cancelled before the sweep runs', async () => {
      await admin("update listings set prepared_at=now()-interval '4 hours', pickup_from=now()-interval '3 hours', pickup_until=now()-interval '1 hour' where id=$1", [firstListing]);
      const order = (await admin(`insert into orders(listing_id,eater_id,portions,price_paid_vnd,payment_method,pickup_code)
        values($1,$2,1,20000,'cash','8888') returning id`, [firstListing, eater])).rows[0]!;
      await login(staff);
      await assert.rejects(db.query('select collect_order($1,\'8888\')', [restaurant]), /past_pickup_window/);
      await login(eater);
      await assert.rejects(db.query('select cancel_order($1)', [order.id]), /past_pickup_window/);
      await assert.rejects(reserve(firstListing, 'cash'), /past_pickup_window/);
      await assert.rejects(db.query('select expire_listings()'), /permission denied/);
    });
    await t.test('staff cannot change a reserved window; suspended restaurants cannot accept reservations', async () => {
      await login(eater);
      await reserve();
      await login(staff);
      await assert.rejects(db.query("update listings set prepared_at=now()+interval '1 minute' where id=$1", [firstListing]), /reserved_window_locked/);
      await admin("update restaurants set status='suspended' where id=$1", [restaurant]);
      await login(eater);
      await assert.rejects(reserve(secondListing), /restaurant_unavailable/);
    });
    await t.test('NGO credits are issued with an auditable ledger entry', async () => {
      await login(ngo);
      const result = await db.query<{ issue_credit: number }>('select issue_credit($1,25000,\'pilot support\')', [eater]);
      assert.equal(result.rows[0]!.issue_credit, 65000);
      await assert.rejects(db.query('select issue_credit($1,-100,\'bad grant\')', [eater]), /invalid_credit/);
      const entry = (await admin('select issued_by, delta_vnd from credit_ledger')).rows[0]!;
      assert.deepEqual(entry, { issued_by: ngo, delta_vnd: 25000 });
    });
    await t.test('unsupported wallets cannot reserve stock', async () => {
      await login(eater);
      await assert.rejects(reserve(firstListing, 'momo'), /unsupported_payment_method/);
      assert.equal((await db.query('select * from orders')).rows.length, 0);
    });
    await t.test('codes are unique across dishes, and legacy ambiguity is rejected', async () => {
      await login(eater);
      const a = (await reserve(firstListing, 'cash')).rows[0]!;
      const b = (await reserve(secondListing, 'cash')).rows[0]!;
      assert.notEqual(a.pickup_code, b.pickup_code);
      await admin('update orders set pickup_code=$1 where id=$2', [a.pickup_code, b.id]);
      await login(staff);
      await assert.rejects(db.query('select collect_order($1,$2)', [restaurant, a.pickup_code]), /ambiguous_code/);
    });
    await t.test('the last portion can only be reserved once', async () => {
      await admin('update listings set portions_left=1 where id=$1', [firstListing]);
      await login(eater);
      await reserve(firstListing, 'cash');
      await login(other);
      await assert.rejects(reserve(firstListing, 'cash'), /sold_out/);
      assert.equal((await admin('select count(*)::int as n from orders')).rows[0]!.n, 1);
    });
  } finally { await db.close(); }
});
