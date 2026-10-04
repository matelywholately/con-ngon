import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { hasSupabase, supabase } from '@/lib/supabase';
import { DEMO_RESTAURANT_ID } from '@/lib/fixtures';
import { getDemoCreditBalance } from '@/lib/queries';
import type { UserRole } from '@/lib/types';

export type SessionUser = {
  id: string;
  phone: string | null;
  name: string | null;
  role: UserRole;
  /** Set when the user is staff at a restaurant; drives the partner routes. */
  restaurantId: string | null;
  creditBalanceVnd: number;
};

type SessionState = {
  loading: boolean;
  user: SessionUser | null;
  signInWithPhone: (phone: string) => Promise<{ ok: boolean; error?: string }>;
  verifyCode: (phone: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  /** Lets a partner-staff account flip between the two experiences. */
  setActiveRole: (role: 'eater' | 'partner_staff') => void;
  activeRole: 'eater' | 'partner_staff';
  refreshProfile: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

/**
 * Without Supabase credentials the app runs on fixtures with a signed-in
 * demo account, so every screen is reachable for design review. The demo user
 * is staff at the demo restaurant so both sides of the marketplace open.
 */
const DEMO_USER: SessionUser = {
  id: 'u1000000-0000-4000-8000-000000000001',
  phone: '+84912345678',
  name: 'Minh',
  role: 'partner_staff',
  restaurantId: DEMO_RESTAURANT_ID,
  creditBalanceVnd: 100_000,
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeRole, setActiveRole] = useState<'eater' | 'partner_staff'>('eater');

  const loadProfile = useCallback(async (userId: string, phone: string | null) => {
    const [{ data: profile }, { data: staff }] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, role, credit_balance_vnd')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('profile_id', userId)
        .maybeSingle(),
    ]);

    setUser({
      id: userId,
      phone,
      name: profile?.full_name ?? null,
      role: (profile?.role as UserRole | undefined) ?? 'eater',
      restaurantId: staff?.restaurant_id ?? null,
      creditBalanceVnd: profile?.credit_balance_vnd ?? 0,
    });
  }, []);

  useEffect(() => {
    if (!hasSupabase) {
      setUser({ ...DEMO_USER, creditBalanceVnd: getDemoCreditBalance() });
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const session = data.session;
      if (session) await loadProfile(session.user.id, session.user.phone ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) void loadProfile(session.user.id, session.user.phone ?? null);
      else setUser(null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithPhone = useCallback(async (phone: string) => {
    if (!hasSupabase) return { ok: true };
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const verifyCode = useCallback(async (phone: string, code: string) => {
    if (!hasSupabase) {
      setUser({ ...DEMO_USER, creditBalanceVnd: getDemoCreditBalance() });
      return { ok: true };
    }
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    if (hasSupabase) await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!hasSupabase) {
      setUser((current) => current ? { ...current, creditBalanceVnd: getDemoCreditBalance() } : null);
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) await loadProfile(data.session.user.id, data.session.user.phone ?? null);
  }, [loadProfile]);

  const value = useMemo<SessionState>(
    () => ({
      loading,
      user,
      signInWithPhone,
      verifyCode,
      signOut,
      activeRole,
      setActiveRole,
      refreshProfile,
    }),
    [loading, user, signInWithPhone, verifyCode, signOut, activeRole, refreshProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}
