export type Reservation = { listingId: string; portions: number; paymentMethod: 'cash' | 'credit'; requestId: string };
export type Pending = Reservation & { ownerId: string };
export interface StoragePort { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void }
const key = (ownerId: string) => `buakip:pending:${ownerId}`;
export function readPending(storage: StoragePort, ownerId: string): Pending | null {
  const value = storage.get(key(ownerId));
  if (!value) return null;
  try {
    const data = JSON.parse(value) as Pending;
    return data.ownerId === ownerId && /^[a-zA-Z0-9-]{1,80}$/.test(data.listingId)
      && Number.isInteger(data.portions) && data.portions >= 1 && data.portions <= 1000
      && ['cash', 'credit'].includes(data.paymentMethod)
      && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.requestId) ? data : null;
  } catch { return null; }
}
export const savePending = (storage: StoragePort, value: Pending) => storage.set(key(value.ownerId), JSON.stringify(value));
export const clearPending = (storage: StoragePort, ownerId: string) => storage.remove(key(ownerId));

export function requestId(): string {
  // randomUUID is unavailable in older WebViews. getRandomValues is supported.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64; bytes[8] = (bytes[8]! & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
