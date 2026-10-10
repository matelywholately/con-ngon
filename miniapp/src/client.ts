import type { Listing, NearbyListing, OrderWithListing, PartnerOrder } from '../../src/lib/types';
import { reserveFailure } from '../../src/lib/reservations';
import type { Reservation } from './pending';
import { zaloToken } from './platform';
import { pickupAreas, type Meal } from './catalog';
import { listingInput, type ListingDraft } from './restaurant';

export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
const url = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const configured = demoMode || /^https:\/\/[^/]+\.supabase\.co$/.test(url) && anonKey.length > 20;
export type StaffRestaurant = { id: string; name: string; address: string; district: string; status: string };
export type Account = { id: string; credit: number; restaurants: StaffRestaurant[] };
type Session = { access_token: string; expires_at: number; user: { id: string } };
let session: Session | null = null;
let loginPromise: Promise<Account> | null = null;
let demo: Awaited<ReturnType<typeof getDemo>> | null = null;
async function getDemo() {
  const [{ createDemoMarketplace }, fixtures] = await Promise.all([
    import('../../src/lib/demoMarketplace'), import('../../src/lib/fixtures'),
  ]);
  const first = fixtures.fixtureListings[0]!;
  return { store: createDemoMarketplace({ listings: fixtures.fixtureListings, orders: fixtures.fixtureOrders,
    userId: fixtures.DEMO_USER_ID, creditVnd: 100000 }), id: fixtures.DEMO_USER_ID,
    restaurants: [{ id: first.restaurant_id, name: first.restaurant_name, address: first.restaurant_address,
      district: 'Cầu Giấy', status: 'approved' }] };
}
async function demoData() { if (!demo) demo = await getDemo(); return demo; }

export class ApiError extends Error { constructor(message: string, public definite: boolean) { super(message); } }
async function request<T>(path: string, body?: unknown, authenticated = true, prefer?: string): Promise<T> {
  if (!configured) throw new Error('not_configured');
  if (authenticated) await signIn();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${url}${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { apikey: anonKey, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
      credentials: 'omit', cache: 'no-store' });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      if (response.status === 401) session = null;
      throw new ApiError(data?.message ?? data?.error ?? 'request_failed', response.status < 500);
    }
    return data as T;
  } finally { clearTimeout(timeout); }
}
export async function signIn(): Promise<Account> {
  if (demoMode) { const data = await demoData(); return { id: data.id, credit: data.store.creditBalance(), restaurants: data.restaurants }; }
  if (session && session.expires_at > Date.now() / 1000 + 60) return { id: session.user.id, credit: 0, restaurants: [] };
  if (loginPromise) return loginPromise;
  loginPromise = (async () => {
    const accessToken = await zaloToken();
    const value = await request<Session>('/functions/v1/zalo-auth', { accessToken }, false);
    if (!value.access_token || !value.user?.id || !value.expires_at) throw new Error('invalid_session');
    session = value;
    return { id: value.user.id, credit: 0, restaurants: [] };
  })();
  try { return await loginPromise; } finally { loginPromise = null; }
}
export async function account(): Promise<Account> {
  const user = await signIn();
  if (demoMode) return user;
  const [rows, staff] = await Promise.all([
    request<{ credit_balance_vnd: number }[]>(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=credit_balance_vnd`),
    request<{ restaurant: StaffRestaurant }[]>(`/rest/v1/restaurant_staff?profile_id=eq.${encodeURIComponent(user.id)}&select=restaurant:restaurants(id,name,address,district,status)`),
  ]);
  if (!rows[0]) throw new Error('profile_missing');
  return { id: user.id, credit: rows[0].credit_balance_vnd, restaurants: staff.map(value => value.restaurant).filter(Boolean) };
}
async function allRows<T>(path: string, authenticated = false): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const rows = await request<T[]>(`${path}&limit=500&offset=${offset}`, undefined, authenticated);
    result.push(...rows);
    if (rows.length < 500) return result;
  }
}
export async function areas(): Promise<string[]> {
  if (demoMode) return pickupAreas((await demoData()).restaurants);
  return pickupAreas(await allRows<{ district: string }>('/rest/v1/restaurants?select=district&status=eq.approved&order=id'));
}
export async function meals(district: string): Promise<Meal[]> {
  if (demoMode) return !district || district === 'Cầu Giấy' ? (await demoData()).store.nearby(Infinity) : [];
  const rows = await allRows<Listing & { restaurant: Pick<StaffRestaurant, 'name' | 'address'> }>(
    '/rest/v1/listings?select=*,restaurant:restaurants!inner(name,address,district,status)&restaurant.status=eq.approved'
    + '&status=eq.live&portions_left=gt.0&pickup_until=gt.' + encodeURIComponent(new Date().toISOString())
    + '&order=pickup_until,id' + (district ? `&restaurant.district=eq.${encodeURIComponent(district)}` : ''));
  return rows.map(({ restaurant, ...listing }) => ({ ...listing, restaurant_name: restaurant.name, restaurant_address: restaurant.address }));
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

export async function partnerListings(restaurantId: string): Promise<Listing[]> {
  if (demoMode) return (await demoData()).store.partnerListings(restaurantId);
  return allRows(`/rest/v1/listings?restaurant_id=eq.${encodeURIComponent(restaurantId)}&status=in.(live,sold_out)&order=pickup_until,id`, true);
}
export async function partnerOrders(restaurantId: string): Promise<PartnerOrder[]> {
  if (demoMode) return (await demoData()).store.partnerOrders(restaurantId);
  const rows = await allRows<PartnerOrder & { listing: { title: string } }>(
    `/rest/v1/orders?select=*,listing:listings!inner(title,restaurant_id)&listing.restaurant_id=eq.${encodeURIComponent(restaurantId)}&status=eq.reserved&order=reserved_at,id`, true);
  return rows.map(({ listing, ...order }) => ({ ...order, listing_title: listing.title, eater_name: null }));
}
export async function publish(draft: ListingDraft, restaurant: StaffRestaurant, id: string): Promise<void> {
  if (!demoMode) {
    try {
      const previous = await request<{ id: string }[]>(`/rest/v1/listings?id=eq.${encodeURIComponent(id)}&restaurant_id=eq.${encodeURIComponent(restaurant.id)}&select=id`);
      if (previous[0]) return;
    } catch (error) {
      // A failed read cannot resolve an earlier publication attempt.
      if (error instanceof ApiError) error.definite = false;
      throw error;
    }
  } else if ((await demoData()).store.listing(id)) return;
  let input: ReturnType<typeof listingInput>;
  try { input = listingInput(draft, restaurant.id, id); }
  catch (error) { throw new ApiError(error instanceof Error ? error.message : 'invalid_listing', true); }
  if (demoMode) {
    const { store, restaurants } = await demoData();
    if (!restaurants.some(value => value.id === restaurant.id)) throw new Error('not_staff');
    store.publish({ ...input, safety_deadline: input.pickup_until, created_at: new Date().toISOString(),
      restaurant_name: restaurant.name, restaurant_address: restaurant.address, restaurant_lat: 0, restaurant_lng: 0, distance_m: 0 } as NearbyListing);
    return;
  }
  // Retrying the same form never creates a second listing or changes its stock.
  await request('/rest/v1/listings?on_conflict=id', input, true, 'resolution=ignore-duplicates');
  let rows: { id: string }[];
  try { rows = await request<{ id: string }[]>(`/rest/v1/listings?id=eq.${encodeURIComponent(id)}&restaurant_id=eq.${encodeURIComponent(restaurant.id)}&select=id`); }
  catch (error) { if (error instanceof ApiError) error.definite = false; throw error; }
  if (!rows[0]) throw new Error('listing_unconfirmed');
}
export async function collect(restaurantId: string, code: string, orderId?: string): Promise<void> {
  if (!/^\d{4}$/.test(code)) throw new Error('code_not_found');
  if (demoMode) {
    const result = (await demoData()).store.collect(restaurantId, code, new Date(), orderId);
    if (!result.ok) throw new Error(result.reason);
  } else await request(orderId ? '/rest/v1/rpc/collect_qr_order' : '/rest/v1/rpc/collect_order', {
    in_restaurant_id: restaurantId, in_code: code, ...(orderId ? { in_order_id: orderId } : {}),
  });
}
