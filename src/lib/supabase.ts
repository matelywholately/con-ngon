import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * The app is usable without a backend during design work — screens fall back
 * to the fixtures in `src/lib/fixtures.ts` when this is false. That keeps the
 * UI reviewable before the Supabase project exists.
 */
export const hasSupabase = Boolean(url && anonKey);

if (!hasSupabase && __DEV__) {
  console.warn(
    '[con-ngon] EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are unset — running on local fixtures. Copy .env.example to .env to connect.',
  );
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Required for React Native: there is no URL bar to parse a session from.
    detectSessionInUrl: false,
  },
});
