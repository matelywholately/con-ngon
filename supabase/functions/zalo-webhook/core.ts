type Payload = Record<string, unknown>;
export type ConsentEvent = {
  signature: string; app_id: string; event_name: 'user.revoke.consent';
  user_id: string; timestamp_ms: number | null;
};

// Zalo Open API signs sorted field values plus the API key, not the raw JSON body.
export async function webhookSignature(data: Payload, apiKey: string): Promise<string> {
  const content = Object.keys(data).sort().map(key => typeof data[key] === 'object'
    ? JSON.stringify(data[key]) : String(data[key])).join('');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content + apiKey));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createWebhookHandler(args: {
  appId: string; apiKey: string; save: (event: ConsentEvent) => Promise<void>;
}) {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  return async (request: Request): Promise<Response> => {
    if (request.method === 'GET') return reply({ ok: true, configured: !!args.apiKey && /^\d{1,30}$/.test(args.appId) });
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    const signature = request.headers.get('x-zevent-signature') ?? '';
    if (!/^[a-f0-9]{64}$/.test(signature)) return reply({ error: 'invalid_signature' }, 401);
    if (!args.apiKey || !/^\d{1,30}$/.test(args.appId)) return reply({ error: 'not_configured' }, 503);
    if (!request.headers.get('content-type')?.includes('application/json')) return reply({ error: 'invalid_request' }, 400);
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: 'invalid_request' }, 400);
      const chunks: Uint8Array[] = []; let length = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 16384) { await reader.cancel(); return reply({ error: 'invalid_request' }, 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let data: Payload;
      try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch { return reply({ error: 'invalid_request' }, 400); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return reply({ error: 'invalid_request' }, 400);
      const expected = await webhookSignature(data, args.apiKey);
      let difference = 0;
      for (let index = 0; index < 64; index++) difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
      if (difference) return reply({ error: 'invalid_signature' }, 401);
      if (data.appId !== args.appId) return reply({ error: 'wrong_app' }, 403);
      if (data.event !== 'user.revoke.consent') return reply({ error: 'unsupported_event' }, 422);
      if (typeof data.userId !== 'string' || !/^\d{1,30}$/.test(data.userId)
        || data.timestamp !== undefined && (!Number.isSafeInteger(data.timestamp) || Number(data.timestamp) <= 0)) {
        return reply({ error: 'invalid_request' }, 400);
      }
      await args.save({ signature, app_id: args.appId, event_name: data.event, user_id: data.userId,
        timestamp_ms: data.timestamp === undefined ? null : data.timestamp as number });
      return reply({ received: true });
    } catch { return reply({ error: 'webhook_unavailable' }, 503); }
  };
}
