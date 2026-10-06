import type { NearbyListing, OrderWithListing } from '../../src/lib/types';
import { reserveFailure } from '../../src/lib/reservations';
import type { Reservation } from './pending';
import { zaloToken } from './platform';

export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
const url = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const configured = demoMode || /^https:\/\/[^/]+\.supabase\.co$/.test(url) && anonKey.length > 20;
export type Account = { id: string; credit: number };
type Session = { access_token: string; expires_at: number; user: { id: string } };
let session: Session | null = null;
let loginPromise: Promise<Account> | null = null;
let demo: Awaited<ReturnType<typeof getDemo>> | null = null;
async function getDemo() {
  const [{ createDemoMarketplace }, fixtures] = await Promise.all([
    import('../../src/lib/demoMarketplace'), import('../../src/lib/fixtures'),
  ]);
  return { store: createDemoMarketplace({ listings: fixtures.fixtureListings, orders: fixtures.fixtureOrders,
    userId: fixtures.DEMO_USER_ID, creditVnd: 100000 }), id: fixtures.DEMO_USER_ID };
}
async function demoData() { if (!demo) demo = await getDemo(); return demo; }

export class ApiError extends Error { constructor(message: string, public definite: boolean) { super(message); } }
async function request<T>(path: string, body?: unknown, authenticated = true): Promise<T> {
  if (!configured) throw new Error('not_configured');
  if (authenticated) await signIn();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${url}${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { apikey: anonKey, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
      credentials: 'omit', cache: 'no-store' });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      if (response.status === 401) session = null;
      throw new ApiError(data?.message ?? data?.error ?? 'request_failed', response.status < 500);
    }
    return data as T;
  } finally { clearTimeout(timeout); }
}
export async function signIn(): Promise<Account> {
  if (demoMode) { const data = await demoData(); return { id: data.id, credit: data.store.creditBalance() }; }
  if (session && session.expires_at > Date.now() / 1000 + 60) return { id: session.user.id, credit: 0 };
  if (loginPromise) return loginPromise;
  loginPromise = (async () => {
    const accessToken = await zaloToken();
    const value = await request<Session>('/functions/v1/zalo-auth', { accessToken }, false);
    if (!value.access_token || !value.user?.id || !value.expires_at) throw new Error('invalid_session');
    session = value;
    return { id: value.user.id, credit: 0 };
  })();
  try { return await loginPromise; } finally { loginPromise = null; }
}
export async function account(): Promise<Account> {
  const user = await signIn();
  if (demoMode) return user;
  const rows = await request<{ credit_balance_vnd: number }[]>(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=credit_balance_vnd`);
  if (!rows[0]) throw new Error('profile_missing');
  return { id: user.id, credit: rows[0].credit_balance_vnd };
}
export async function meals(lat: number, lng: number): Promise<NearbyListing[]> {
  if (demoMode) return (await demoData()).store.nearby(5000);
  return request('/rest/v1/rpc/nearby_listings', { in_lat: lat, in_lng: lng, in_radius_m: 3000, in_limit: 50 }, false);
}
export async function orders(): Promise<OrderWithListing[]> {
  if (demoMode) return (await demoData()).store.myOrders();
  return request('/rest/v1/rpc/my_orders', {});
}
export async function reserve(value: Reservation): Promise<string> {
  if (demoMode) {
    const result = (await demoData()).store.reserve(value);
    if (!result.ok) throw new ApiError(result.reason, true);
    return result.orderId;
  }
  try {
    const rows = await request<{ id: string }[] | { id: string }>('/rest/v1/rpc/reserve_listing', {
      in_listing_id: value.listingId, in_portions: value.portions,
      in_payment_method: value.paymentMethod, in_request_id: value.requestId });
    const order = Array.isArray(rows) ? rows[0] : rows;
    if (!order?.id) throw new Error('invalid_reservation');
    return order.id;
  } catch (error) {
    // Only a known RPC rejection proves no reservation was committed.
    if (error instanceof ApiError) error.definite = reserveFailure(error.message) !== 'unknown';
    throw error;
  }
}
export async function cancel(id: string): Promise<void> {
  if (demoMode) {
    const result = (await demoData()).store.cancel(id);
    if (!result.ok) throw new ApiError(result.reason, true);
  } else await request('/rest/v1/rpc/cancel_order', { in_order_id: id });
}
