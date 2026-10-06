import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { createAuthHandler, type AuthPort } from './core.ts';

Deno.serve(async (request: Request) => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!url || !key || !anon) return Response.json({ error: 'not_configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, key, options);
  const login = createClient(url, anon, options);
  const auth: AuthPort = {
    async findUser(id) {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error && error.status !== 404) throw new Error('auth_unavailable');
      return data.user;
    },
    async createUser(args) {
      const { data, error } = await admin.auth.admin.createUser({ ...args, email_confirm: true });
      if (error || !data.user) throw new Error('auth_unavailable');
      return data.user;
    },
    async issueSession(user) {
      if (!user.email) throw new Error('identity_mismatch');
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email });
      if (error || data.user?.id !== user.id) throw new Error('auth_unavailable');
      const result = await login.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
      if (result.error || !result.data.session) throw new Error('auth_unavailable');
      return result.data.session;
    },
  };
  return createAuthHandler({ auth, appId: Deno.env.get('ZALO_APP_ID') ?? '', secret: Deno.env.get('ZALO_APP_SECRET') ?? '',
    origins: (Deno.env.get('ZALO_AUTH_EXTRA_ORIGINS') ?? '').split(',').map(v => v.trim()).filter(Boolean),
    allowAttempt: async tokenHash => {
      const { data, error } = await admin.rpc('allow_zalo_login', { in_token_hash: tokenHash });
      if (error) throw new Error('rate_limit_unavailable');
      return data === true;
    },
  })(request);
});
