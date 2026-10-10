import { writeFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
  plugins: [react(), { name: 'record-release-config', closeBundle() {
    writeFileSync('.build-metadata.json', JSON.stringify({
      demo: env.VITE_DEMO_MODE === 'true', supabaseUrl: env.VITE_SUPABASE_URL ?? '',
      backendConfigured: /^https:\/\/[^/]+\.supabase\.co$/.test(env.VITE_SUPABASE_URL ?? '') && (env.VITE_SUPABASE_ANON_KEY?.length ?? 0) > 20,
      miniAppId: env.APP_ID ?? '',
    }));
  } }],
  base: './',
  build: {
    target: 'es2015', sourcemap: false,
    modulePreload: false,
    rolldownOptions: { output: {
      entryFileNames: 'assets/[name].[hash].module.js',
      chunkFileNames: 'assets/[name].[hash].module.js',
    } },
  },
  };
});
