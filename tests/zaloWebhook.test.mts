import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createWebhookHandler, webhookSignature, type ConsentEvent } from '../supabase/functions/zalo-webhook/core.ts';

const appId = '4024811304212206084', apiKey = 'fake-open-api-key-for-tests';
const payload = { event: 'user.revoke.consent', appId, userId: '123456789', timestamp: 1791610000000 };
const signature = (data: Record<string, unknown>) => createHash('sha256')
  .update(Object.keys(data).sort().map(key => typeof data[key] === 'object' ? JSON.stringify(data[key]) : String(data[key])).join('') + apiKey).digest('hex');
const request = (data: unknown = payload, proof = signature(payload)) => new Request('https://example.test/zalo-webhook', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ZEvent-Signature': proof }, body: JSON.stringify(data),
});

test('webhook signature follows Zalo sorted values, including nested values and field reordering', async () => {
  const data = { versionId: 1, status: 0, event: 'versions.review.done', appId, description: '', timestamp: 1791610000000,
    extra: { a: 'x', b: null } };
  assert.equal(await webhookSignature(data, apiKey), signature(data));
  assert.equal(await webhookSignature({ timestamp: payload.timestamp, userId: payload.userId, appId, event: payload.event }, apiKey), signature(payload));
});

test('webhook checks signatures, app, payload and configuration before saving any event', async () => {
  const saved: ConsentEvent[] = [];
  const handler = createWebhookHandler({ appId, apiKey, save: async value => { saved.push(value); } });
  const health = await handler(new Request('https://example.test'));
  assert.deepEqual(await health.json(), { ok: true, configured: true });
  assert.equal((await handler(new Request('https://example.test', { method: 'OPTIONS' }))).status, 405);
  assert.equal((await handler(request(payload, ''))).status, 401);
  assert.equal((await handler(request(payload, '0'.repeat(64)))).status, 401);
  assert.equal((await handler(request({ ...payload, userId: '999' }))).status, 401);
  for (const [data, status] of [[{ ...payload, appId: '999' }, 403], [{ ...payload, event: 'unknown' }, 422],
    [{ ...payload, userId: 123 }, 400], [{ ...payload, timestamp: '1791610000000' }, 400],
    [{ ...payload, timestamp: -1 }, 400]] as const) {
    assert.equal((await handler(request(data, signature(data)))).status, status);
  }
  assert.equal((await handler(request(null))).status, 400);
  assert.equal((await handler(request([]))).status, 400);
  assert.equal((await handler(request({ ...payload, extra: 'x'.repeat(16385) }))).status, 413);
  const unconfigured = createWebhookHandler({ appId, apiKey: '', save: async value => { saved.push(value); } });
  assert.deepEqual(await (await unconfigured(new Request('https://example.test'))).json(), { ok: true, configured: false });
  assert.equal((await unconfigured(request())).status, 503);
  assert.equal(saved.length, 0);
  assert.equal((await handler(request())).status, 200);
  assert.deepEqual(saved, [{ signature: signature(payload), app_id: appId, event_name: 'user.revoke.consent',
    user_id: payload.userId, timestamp_ms: payload.timestamp }]);
  const { timestamp, ...withoutTime } = payload;
  assert.equal((await handler(request(withoutTime, signature(withoutTime)))).status, 200);
  assert.equal(saved[1]!.timestamp_ms, null);
});

test('webhook retries when durable storage fails and never exposes provider data or secrets', async () => {
  const handler = createWebhookHandler({ appId, apiKey, save: async () => { throw new Error(`${apiKey} ${payload.userId}`); } });
  const response = await handler(request());
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'webhook_unavailable' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('webhook inbox is service-only, deduplicates deliveries, and preserves manual review state', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;');
    await db.exec(await readFile(new URL('../supabase/migrations/0011_zalo_webhook.sql', import.meta.url), 'utf8'));
    const record = async () => db.query(`insert into zalo_webhook_events(signature,app_id,event_name,user_id,timestamp_ms)
      values ($1,$2,$3,$4,$5) on conflict(signature) do nothing`, [signature(payload), appId, payload.event, payload.userId, payload.timestamp]);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from zalo_webhook_events'), /permission denied/);
      await assert.rejects(record(), /permission denied/);
      await db.exec('reset role');
    }
    assert.equal((await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid='public.zalo_webhook_events'::regclass")).rows[0]!.relrowsecurity, true);
    await db.exec('set role service_role');
    await record(); await db.exec('update zalo_webhook_events set processed_at=now()'); await record();
    const rows = (await db.query<{ processed_at: unknown }>('select processed_at from zalo_webhook_events')).rows;
    assert.equal(rows.length, 1); assert.notEqual(rows[0]!.processed_at, null);
  } finally { await db.close(); }
});
