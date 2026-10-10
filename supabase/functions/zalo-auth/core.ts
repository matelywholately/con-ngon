export type AuthUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };
export type Session = { access_token: string; refresh_token: string; expires_at?: number; user: { id: string } };
export type AuthPort = {
  findUser(id: string): Promise<AuthUser | null>;
  createUser(args: { id: string; email: string; app_metadata: Record<string, string> }): Promise<AuthUser>;
  issueSession(user: AuthUser): Promise<Session>;
};
type GraphRelay = { url: string; key: string };

const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
class ZaloVerificationError extends Error {
  status: number;
  code: number | null;
  ipRestricted: boolean;
  constructor(status: number, code: number | null, message: unknown) {
    super(code === -501 ? 'zalo_server_blocked' : code === -104 || code === -1241 ? 'zalo_app_mismatch'
      : code === null || code === 0 || status >= 500 ? 'login_failed' : 'invalid_token');
    this.status = status; this.code = code;
    this.ipRestricted = code === -501 && typeof message === 'string' && /\bip\b|country|region|outside|geo(?:graph|location)/i.test(message);
  }
}
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
  token: string; appId: string; secret: string; auth: AuthPort; fetcher?: typeof fetch; relay?: GraphRelay;
}): Promise<Session> {
  if (typeof args.token !== 'string' || args.token.length < 16 || args.token.length > 4096) throw new Error('invalid_token');
  if (args.relay) {
    try {
      const url = new URL(args.relay.url);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || args.relay.key.length < 32) throw new Error();
    } catch { throw new Error('not_configured'); }
  }
  const proof = await zaloProof(args.token, args.secret);
  const response = await (args.fetcher ?? fetch)(args.relay?.url ?? 'https://graph.zalo.me/v2.0/me?fields=id', {
    ...(args.relay ? { method: 'POST', headers: { Authorization: `Bearer ${args.relay.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: args.token, appsecretProof: proof }) }
      : { headers: { access_token: args.token, appsecret_proof: proof } }),
    signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  const identity = await response.json().catch(() => null) as { id?: unknown; error?: number; message?: unknown } | null;
  if (!response.ok || !identity || identity.error !== 0) {
    throw new ZaloVerificationError(response.status, Number.isSafeInteger(identity?.error) ? identity!.error! : null, identity?.message);
  }
  if (typeof identity.id !== 'string' || !/^\d{1,30}$/.test(identity.id)) throw new Error('invalid_token');
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
  relay?: GraphRelay;
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
      if (error instanceof ZaloVerificationError) {
        console.warn(JSON.stringify({ event: 'zalo_verification_failed', status: error.status, code: error.code, ipRestricted: error.ipRestricted }));
      }
      const message = error instanceof Error ? error.message : '';
      return reply({ error: ['invalid_token', 'zalo_app_mismatch', 'zalo_server_blocked', 'not_configured'].includes(message) ? message : 'login_failed' },
        message === 'invalid_token' ? 401 : 503);
    }
  };
}
