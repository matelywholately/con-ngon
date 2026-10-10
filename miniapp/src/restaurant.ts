import { safetyDeadline, validateListing, type HandlingClass } from '../../src/lib/safety.ts';
import type { StoragePort } from './pending';

export type ListingDraft = {
  title: string; description: string; portions: string; price: string; originalPrice: string;
  handling: HandlingClass; preparedAt: string; pickupUntil: string;
  vegetarian: boolean; allergens: string; photoUrl: string;
};
export const vietnamTimeInput = (date: Date) => new Date(+date + 7 * 60 * 60_000).toISOString().slice(0, 16);

export function listingInput(draft: ListingDraft, restaurantId: string, id: string, now = new Date()) {
  const integer = (value: string, min: number) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value))
    && Number(value) >= min && Number(value) <= 2_147_483_647;
  if (!draft.title.trim() || draft.title.trim().length > 160 || !integer(draft.portions, 1)
    || !integer(draft.price, 0) || draft.originalPrice && (!integer(draft.originalPrice, Number(draft.price)))) {
    throw new Error('invalid_listing');
  }
  if (!['hot', 'chilled', 'ambient', 'shelf_stable'].includes(draft.handling)) throw new Error('invalid_listing');
  if (draft.photoUrl) {
    try {
      const photo = new URL(draft.photoUrl);
      if (photo.protocol !== 'https:' || !photo.hostname || photo.username || photo.password) throw new Error();
    } catch { throw new Error('invalid_photo'); }
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.preparedAt)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.pickupUntil)) throw new Error('invalid_listing');
  const preparedAt = new Date(`${draft.preparedAt}:00+07:00`);
  const requestedUntil = new Date(`${draft.pickupUntil}:00+07:00`);
  if (!Number.isFinite(+preparedAt) || !Number.isFinite(+requestedUntil)) throw new Error('invalid_listing');
  if (vietnamTimeInput(preparedAt) !== draft.preparedAt || vietnamTimeInput(requestedUntil) !== draft.pickupUntil) throw new Error('invalid_listing');
  const pickupUntil = new Date(Math.min(+requestedUntil, +safetyDeadline(preparedAt, draft.handling)));
  const check = validateListing({ preparedAt, handling: draft.handling, pickupFrom: now, pickupUntil, now });
  if (!check.ok) throw new Error(check.reason);
  return { id, restaurant_id: restaurantId, title: draft.title.trim(), description: draft.description.trim() || null,
    portions_total: Number(draft.portions), portions_left: Number(draft.portions), price_vnd: Number(draft.price),
    original_price_vnd: draft.originalPrice ? Number(draft.originalPrice) : null, handling_class: draft.handling,
    prepared_at: preparedAt.toISOString(), pickup_from: now.toISOString(), pickup_until: pickupUntil.toISOString(),
    is_vegetarian: draft.vegetarian, allergens: draft.allergens.split(',').map(value => value.trim()).filter(Boolean),
    photo_url: draft.photoUrl || null, status: 'live' as const };
}

export type PendingListing = { id: string; ownerId: string; restaurantId: string; draft: ListingDraft };
const pendingKey = (ownerId: string, restaurantId: string) => `buakip:listing:${ownerId}:${restaurantId}`;
export function readPendingListing(storage: StoragePort, ownerId: string, restaurantId: string): PendingListing | null {
  const raw = storage.get(pendingKey(ownerId, restaurantId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PendingListing;
    return value.ownerId === ownerId && value.restaurantId === restaurantId
      && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id)
      && value.draft && typeof value.draft.vegetarian === 'boolean'
      && ['hot', 'chilled', 'ambient', 'shelf_stable'].includes(value.draft.handling)
      && ['title', 'description', 'portions', 'price', 'originalPrice', 'handling', 'preparedAt', 'pickupUntil', 'allergens', 'photoUrl']
        .every(key => typeof value.draft[key as keyof ListingDraft] === 'string') ? value : null;
  } catch { return null; }
}
export const savePendingListing = (storage: StoragePort, value: PendingListing) => storage.set(pendingKey(value.ownerId, value.restaurantId), JSON.stringify(value));
export const clearPendingListing = (storage: StoragePort, ownerId: string, restaurantId: string) => storage.remove(pendingKey(ownerId, restaurantId));
