export type AuthUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };
export type Session = { access_token: string; refresh_token: string; expires_at?: number; user: { id: string } };
export type AuthPort = {
  findUser(id: string): Promise<AuthUser | null>;
  createUser(args: { id: string; email: string; app_metadata: Record<string, string> }): Promise<AuthUser>;
  issueSession(user: AuthUser): Promise<Session>;
};

const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
export async function zaloProof(token: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(token)));
}

/** Stable UUID scoped to the parent Zalo App. No identity is accepted from the client. */
export async function identityId(appId: string, zaloId: string): Promise<string> {
  if (!/^\d{1,30}$/.test(appId) || !/^\d{1,30}$/.test(zaloId)) throw new Error('invalid_identity');
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`bua-kip:zalo:${appId}:${zaloId}`))).slice(0, 16);
  bytes[6] = (bytes[6]! & 15) | 128;
  bytes[8] = (bytes[8]! & 63) | 128;
  const id = hex(bytes.buffer);
  return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`;
}

export async function exchangeZaloToken(args: {
  token: string; appId: string; secret: string; auth: AuthPort; fetcher?: typeof fetch;
}): Promise<Session> {
  if (typeof args.token !== 'string' || args.token.length < 16 || args.token.length > 4096) throw new Error('invalid_token');
  const response = await (args.fetcher ?? fetch)('https://graph.zalo.me/v2.0/me?fields=id', {
    headers: { access_token: args.token, appsecret_proof: await zaloProof(args.token, args.secret) },
    signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  if (!response.ok) throw new Error('invalid_token');
  const identity = await response.json() as { id?: unknown; error?: number };
  if (identity.error !== 0 || typeof identity.id !== 'string' || !/^\d{1,30}$/.test(identity.id)) throw new Error('invalid_token');
  const id = await identityId(args.appId, identity.id);
  let user = await args.auth.findUser(id);
  if (!user) {
    try {
      user = await args.auth.createUser({ id, email: `${id}@zalo.identity.invalid`,
        app_metadata: { zalo_app_id: args.appId, zalo_user_id: identity.id } });
    } catch {
      // A concurrent first login may have created the same deterministic identity.
      user = await args.auth.findUser(id);
      if (!user) throw new Error('identity_unavailable');
    }
  }
  if (user.id !== id || user.app_metadata?.zalo_app_id !== args.appId
    || user.app_metadata?.zalo_user_id !== identity.id) throw new Error('identity_mismatch');
  const session = await args.auth.issueSession(user);
  if (session.user.id !== id) throw new Error('identity_mismatch');
  return session;
}

export function permittedOrigin(origin: string | null, extras: string[] = []): string | null {
  return origin && ['https://h5.zdn.vn', ...extras].includes(origin) ? origin : null;
}

export function createAuthHandler(args: {
  appId: string; secret: string; auth: AuthPort; fetcher?: typeof fetch; origins?: string[];
  allowAttempt: (tokenHash: string) => Promise<boolean>;
}) {
  return async (request: Request): Promise<Response> => {
    const origin = permittedOrigin(request.headers.get('origin'), args.origins);
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });
    if (request.headers.has('origin') && !origin) return reply({ error: 'origin_denied' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    if (!args.appId || !args.secret) return reply({ error: 'not_configured' }, 503);
    if (!request.headers.get('content-type')?.includes('application/json')) return reply({ error: 'invalid_request' }, 400);
    try {
      const body = await request.text();
      if (body.length > 5000) return reply({ error: 'invalid_request' }, 413);
      let data: { accessToken?: unknown } | null;
      try { data = JSON.parse(body); } catch { return reply({ error: 'invalid_request' }, 400); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return reply({ error: 'invalid_request' }, 400);
      if (typeof data.accessToken !== 'string' || data.accessToken.length < 16 || data.accessToken.length > 4096) return reply({ error: 'invalid_token' }, 401);
      const hash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data.accessToken)));
      if (!await args.allowAttempt(hash)) return reply({ error: 'rate_limited' }, 429);
      const session = await exchangeZaloToken({ ...args, token: data.accessToken });
      return reply({ access_token: session.access_token, refresh_token: session.refresh_token,
        expires_at: session.expires_at, user: { id: session.user.id } }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return reply({ error: message === 'invalid_token' ? 'invalid_token' : 'login_failed' },
        message === 'invalid_token' ? 401 : 503);
    }
  };
}
