import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createAuthHandler, exchangeZaloToken, identityId, zaloProof, type AuthPort, type AuthUser } from '../supabase/functions/zalo-auth/core.ts';

const token = 'a-valid-looking-zalo-token';
const appId = '12345';
const secret = 'server-only-secret';
function harness() {
  let stored: AuthUser | null = null;
  let creates = 0;
  const auth: AuthPort = {
    async findUser() { return stored; },
    async createUser(args) { creates++; stored = args; return args; },
    async issueSession(user) { return { access_token: 'supabase-jwt', refresh_token: 'refresh', expires_at: 9999999999, user: { id: user.id } }; },
  };
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://graph.zalo.me/v2.0/me?fields=id');
    assert.equal((init!.headers as Record<string, string>).access_token, token);
    assert.equal((init!.headers as Record<string, string>).appsecret_proof, createHmac('sha256', secret).update(token).digest('hex'));
    return Response.json({ error: 0, id: '67890' });
  };
  return { auth, fetcher, creates: () => creates, set: (value: AuthUser | null) => { stored = value; } };
}
test('Zalo proof uses HMAC and identities are stable, scoped UUIDs', async () => {
  assert.equal(await zaloProof(token, secret), createHmac('sha256', secret).update(token).digest('hex'));
  const id = await identityId(appId, '67890');
  assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(id, await identityId(appId, '67890'));
  assert.notEqual(id, await identityId('54321', '67890'));
  await assert.rejects(identityId(appId, 'forged-user'), /invalid_identity/);
});
test('verified identity creates one account and later logins reuse it', async () => {
  const h = harness();
  const args = { token, appId, secret, ...h };
  const first = await exchangeZaloToken(args);
  const second = await exchangeZaloToken(args);
  assert.equal(first.user.id, second.user.id); assert.equal(h.creates(), 1);
});
test('concurrent first login re-reads the server-created identity', async () => {
  const h = harness(); const create = h.auth.createUser;
  h.auth.createUser = async args => { await create(args); throw new Error('already exists'); };
  assert.equal((await exchangeZaloToken({ token, appId, secret, ...h })).user.id, await identityId(appId, '67890'));
});
test('invalid Zalo tokens and unexpected identities cannot receive sessions', async () => {
  const h = harness();
  for (const response of [Response.json({ error: -1, id: '67890' }), Response.json({ error: 0, id: 'forged' }), new Response('', { status: 401 })]) {
    await assert.rejects(exchangeZaloToken({ token, appId, secret, auth: h.auth, fetcher: async () => response }), /invalid_token/);
  }
  assert.equal(h.creates(), 0);
  h.set({ id: await identityId(appId, '67890'), app_metadata: { zalo_app_id: 'another-app' } });
  await assert.rejects(exchangeZaloToken({ token, appId, secret, ...h }), /identity_mismatch/);
});
test('a session for another account is rejected even after identity verification', async () => {
  const h = harness(); h.auth.issueSession = async () => ({ access_token: 'wrong', refresh_token: 'wrong', user: { id: 'other' } });
  await assert.rejects(exchangeZaloToken({ token, appId, secret, ...h }), /identity_mismatch/);
});
test('endpoint validates CORS, input, rate budget and redacts failures', async () => {
  const h = harness(); let allowed = true; let attempts = 0;
  const handler = createAuthHandler({ appId, secret, ...h, allowAttempt: async hash => { assert.match(hash, /^[a-f0-9]{64}$/); attempts++; return allowed; } });
  const req = (body: string, origin = 'https://h5.zdn.vn') => new Request('https://example.test', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body });
  const preflight = await handler(new Request('https://example.test', { method: 'OPTIONS', headers: { origin: 'https://h5.zdn.vn' } }));
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://h5.zdn.vn');
  assert.equal((await handler(req('{'))).status, 400);
  assert.equal((await handler(req('null'))).status, 400);
  assert.equal((await handler(req('{}'))).status, 401);
  assert.equal((await handler(req('x'.repeat(5001)))).status, 413);
  assert.equal((await handler(req(JSON.stringify({ accessToken: token }), 'https://malicious.test'))).status, 403);
  assert.equal(attempts, 0);
  const good = await handler(req(JSON.stringify({ accessToken: token, userId: 'forged-client-id' })));
  assert.equal(good.status, 200); const data = await good.json();
  assert.equal(data.user.id, await identityId(appId, '67890')); assert.equal(data.access_token, 'supabase-jwt');
  assert.equal(good.headers.get('Cache-Control'), 'no-store');
  allowed = false; assert.equal((await handler(req(JSON.stringify({ accessToken: token })))).status, 429);
  allowed = true; h.auth.issueSession = async () => { throw new Error(secret); };
  const failure = await handler(req(JSON.stringify({ accessToken: token })));
  assert.equal(failure.status, 503); assert.equal(await failure.text(), '{"error":"login_failed"}');
});
