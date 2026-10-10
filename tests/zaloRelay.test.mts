import test from 'node:test';
import assert from 'node:assert/strict';
import { createRelayHandler } from '../ops/zalo-relay/handler.ts';
const key = 'a-server-only-relay-key-at-least-32-characters';
const token = 'a-valid-looking-zalo-token';
const proof = 'a'.repeat(64);
const req = (body: unknown, credential = key) => new Request('https://relay.example/verify', { method: 'POST',
  headers: { authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('relay authenticates and validates input before contacting the fixed Zalo endpoint', async () => {
  assert.throws(() => createRelayHandler('short'), /relay_key_required/);
  let calls = 0;
  const handler = createRelayHandler(key, async (url, init) => {
    calls++; assert.equal(url, 'https://graph.zalo.me/v2.0/me?fields=id');
    assert.deepEqual(init?.headers, { access_token: token, appsecret_proof: proof });
    assert.equal(init?.redirect, 'error');
    return Response.json({ error: 0, id: '12345', name: 'private name', accessToken: token });
  });
  assert.equal((await handler(req({}, 'wrong'))).status, 401);
  for (const value of [null, {}, { accessToken: token, appsecretProof: 'bad' }]) assert.equal((await handler(req(value))).status, 400);
  assert.equal((await handler(req('x'.repeat(5001)))).status, 413);
  assert.equal(calls, 0);
  const result = await handler(req({ accessToken: token, appsecretProof: proof, id: 'forged', url: 'https://attacker.example' }));
  assert.deepEqual(await result.json(), { error: 0, id: '12345' });
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.headers.has('Access-Control-Allow-Origin'), false);
  assert.equal(calls, 1);
});

test('relay fails closed and never exposes upstream error text or invalid identities', async () => {
  for (const response of [Response.json({ error: 0, id: 12345 }), Response.json({ id: '12345' }), new Response('bad json'),
    Response.json({ error: 0, id: 'forged' }), Response.json({ error: -100 }, { status: 500 })]) {
    const handler = createRelayHandler(key, async () => response);
    assert.equal((await handler(req({ accessToken: token, appsecretProof: proof }))).status, 503);
  }
  const handler = createRelayHandler(key, async () => Response.json({ error: -501, message: `IP restricted ${token}` }));
  assert.deepEqual(await (await handler(req({ accessToken: token, appsecretProof: proof }))).json(), { error: -501, message: 'IP restricted' });
});
