export type PickupQr = { restaurantId: string; orderId: string; code: string };

const identifier = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/;
const codePattern = /^\d{4}$/;

/** Locally generated, versioned payload. Contains no customer or payment data. */
export function encodePickupQr(pass: PickupQr): string {
  if (!identifier.test(pass.restaurantId) || !identifier.test(pass.orderId)
    || !codePattern.test(pass.code)) throw new Error('invalid_pickup_pass');
  return `buakip:pickup:v1:${pass.restaurantId}:${pass.orderId}:${pass.code}`;
}

export function decodePickupQr(value: string): PickupQr | null {
  const parts = value.split(':');
  if (parts.length !== 6 || parts[0] !== 'buakip' || parts[1] !== 'pickup'
    || parts[2] !== 'v1') return null;
  const [, , , restaurantId, orderId, code] = parts;
  if (!restaurantId || !orderId || !code || !identifier.test(restaurantId)
    || !identifier.test(orderId) || !codePattern.test(code)) return null;
  return { restaurantId, orderId, code };
}
