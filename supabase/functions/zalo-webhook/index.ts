import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { createWebhookHandler } from './core.ts';

Deno.serve(async (request: Request) => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createWebhookHandler({
    appId: Deno.env.get('ZALO_MINIAPP_ID') ?? '4024811304212206084',
    apiKey: Deno.env.get('ZALO_MINIAPP_API_KEY') ?? '',
    save: async event => {
      if (!url || !key) throw new Error('not_configured');
      const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await admin.from('zalo_webhook_events').upsert(event, { onConflict: 'signature', ignoreDuplicates: true });
      if (error) throw new Error('save_failed');
    },
  })(request);
});
