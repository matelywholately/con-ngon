import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { checkLimits, checkRelease } from '../scripts/limits.mjs';
import { readPending, savePending, clearPending, requestId } from '../src/pending.ts';

test('limits measure every uncompressed file and the whole app', () => {
  assert.equal(checkLimits([{ path: 'a', bytes: 3_000_000 }]).totalBytes, 3_000_000);
  assert.throws(() => checkLimits([{ path: 'a', bytes: 3_000_001 }]), /3 MB/);
  assert.throws(() => checkLimits(Array.from({ length: 4 }, (_, i) => ({ path: String(i), bytes: 2_600_000 }))), /10 MB/);
});
test('release rejects demo, missing backend and missing real Mini App ID', () => {
  const ready = { demo: false, backendConfigured: true, miniAppId: '123456', files: [{ path: 'app', bytes: 1000 }] };
  assert.doesNotThrow(() => checkRelease(ready));
  assert.throws(() => checkRelease({ ...ready, demo: true }), /Demo/);
  assert.throws(() => checkRelease({ ...ready, backendConfigured: false }), /Supabase/);
  assert.throws(() => checkRelease({ ...ready, miniAppId: '' }), /APP_ID/);
});

test('the deploy launcher prevents the CLI from disabling TLS verification', () => {
  const result = spawnSync(process.execPath, ['--require', './scripts/require-tls.cjs', '-e',
    'process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";process.stdout.write(process.env.NODE_TLS_REJECT_UNAUTHORIZED)'], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(result.stdout, '1');
});
test('pending reservations survive retries, are scoped to an owner and reject corrupt data', () => {
  const values = new Map();
  const storage = { get: key => values.get(key) ?? null, set: (key, value) => values.set(key, value), remove: key => values.delete(key) };
  const pending = { ownerId: 'owner', listingId: 'listing-1', portions: 2, paymentMethod: 'credit', requestId: requestId() };
  savePending(storage, pending); assert.deepEqual(readPending(storage, 'owner'), pending);
  assert.equal(readPending(storage, 'another-owner'), null);
  assert.equal(readPending(storage, 'owner').requestId, pending.requestId);
  storage.set('buakip:pending:owner', JSON.stringify({ ...pending, portions: -1 })); assert.equal(readPending(storage, 'owner'), null);
  storage.set('buakip:pending:owner', 'bad json'); assert.equal(readPending(storage, 'owner'), null);
  clearPending(storage, 'owner'); assert.equal(readPending(storage, 'owner'), null);
});
test('generated bootstrap assets exist and the size report covers them', async () => {
  const config = JSON.parse(await readFile('dist/app-config.json', 'utf8'));
  const report = JSON.parse(await readFile('size-report.json', 'utf8'));
  assert.ok(config.listSyncJS.length); assert.ok(config.listCSS.length);
  for (const path of [...config.listCSS, ...config.listSyncJS]) {
    assert.equal((await stat(`dist/${path}`)).size, report.files.find(file => file.path === path).bytes);
  }
  assert.equal(checkLimits(report.files).totalBytes, report.totalBytes);
});
