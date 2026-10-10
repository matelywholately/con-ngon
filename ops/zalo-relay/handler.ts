/// <reference types="node" />
import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

/** Run only on an owner-controlled server whose IP Zalo permits. Never log requests. */
export function createRelayHandler(key: string, fetcher: typeof fetch = fetch) {
  if (key.length < 32) throw new Error('relay_key_required');
  const credential = Buffer.from(`Bearer ${key}`);
  const reply = (body: unknown, status = 200) => Response.json(body, { status,
    headers: { 'Cache-Control': 'no-store' } });
  return async (request: Request): Promise<Response> => {
    const supplied = Buffer.from(request.headers.get('authorization') ?? '');
    if (supplied.length !== credential.length || !timingSafeEqual(supplied, credential)) return reply({ error: 'unauthorized' }, 401);
    if (new URL(request.url).pathname !== '/verify') return reply({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    if (!request.headers.get('content-type')?.includes('application/json')) return reply({ error: 'invalid_request' }, 400);
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: 'invalid_request' }, 400);
      const chunks: Uint8Array[] = []; let bytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 5000) { await reader.cancel(); return reply({ error: 'invalid_request' }, 413); }
        chunks.push(value);
      }
      let input: { accessToken?: unknown; appsecretProof?: unknown } | null;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return reply({ error: 'invalid_request' }, 400); }
      if (!input || typeof input.accessToken !== 'string' || input.accessToken.length < 16 || input.accessToken.length > 4096
        || typeof input.appsecretProof !== 'string' || !/^[a-f0-9]{64}$/.test(input.appsecretProof)) return reply({ error: 'invalid_request' }, 400);
      const upstream = await fetcher('https://graph.zalo.me/v2.0/me?fields=id', {
        headers: { access_token: input.accessToken, appsecret_proof: input.appsecretProof },
        signal: AbortSignal.timeout(10000), redirect: 'error',
      });
      const value = await upstream.json() as { error?: unknown; id?: unknown; message?: unknown };
      if (!upstream.ok || !Number.isSafeInteger(value?.error)) return reply({ error: 'upstream_unavailable' }, 503);
      if (value.error === 0) return typeof value.id === 'string' && /^\d{1,30}$/.test(value.id)
        ? reply({ error: 0, id: value.id }) : reply({ error: 'upstream_unavailable' }, 503);
      const ipRestricted = value.error === -501 && typeof value.message === 'string' && /\bip\b|country|region|outside|geo(?:graph|location)/i.test(value.message);
      return reply({ error: value.error, ...(ipRestricted ? { message: 'IP restricted' } : {}) });
    } catch { return reply({ error: 'upstream_unavailable' }, 503); }
  };
}
