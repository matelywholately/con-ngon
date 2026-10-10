import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePickupQr, decodePickupQr } from '../src/lib/pickupQr.ts';
import { canAccessRestaurant, signInDestination } from '../src/lib/access.ts';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

const pass = { restaurantId: '20000000-0000-4000-8000-000000000001',
  orderId: '40000000-0000-4000-8000-000000000001', code: '0042' };

test('a scanned pickup QR preserves restaurant, order and leading-zero code', () => {
  assert.deepEqual(decodePickupQr(encodePickupQr(pass)), pass);
  assert.deepEqual(decodePickupQr(encodePickupQr({ ...pass, orderId: 'demo-order-1' })),
    { ...pass, orderId: 'demo-order-1' });
});

test('unrelated codes and URLs ending in four digits never count as pickup QR passes', () => {
  for (const value of ['0042', 'https://example.com/0042', 'fake:pickup:v1:r:o:0042', '', 'other0042']) {
    assert.equal(decodePickupQr(value), null);
  }
});

test('unknown versions, missing fields, extra fields and invalid codes are rejected', () => {
  const encoded = encodePickupQr(pass);
  for (const value of [encoded.replace(':v1:', ':v2:'), encoded + ':extra', encoded.replace(':0042', ':42'),
    encoded.replace(':0042', ':abcd'), 'buakip:pickup:v1::order:0042', 'buakip:pickup:v1:r:order/one:0042']) {
    assert.equal(decodePickupQr(value), null);
  }
  assert.throws(() => encodePickupQr({ ...pass, code: '42' }), /invalid_pickup_pass/);
});

test('QR payloads contain identifiers only', () => {
  assert.equal(encodePickupQr(pass), `buakip:pickup:v1:${pass.restaurantId}:${pass.orderId}:0042`);
});

test('the QR generator produces a symbol an independent decoder can read', () => {
  const value = encodePickupQr(pass);
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const scale = 5;
  const quiet = 4;
  const width = (modules.size + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < modules.size; y++) for (let x = 0; x < modules.size; x++) {
    if (!modules.get(y, x)) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const offset = (((y + quiet) * scale + dy) * width + (x + quiet) * scale + dx) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
    }
  }
  const scanned = jsQR(pixels, width, width);
  assert.equal(scanned?.data, value);
  assert.deepEqual(decodePickupQr(scanned!.data), pass);
});

test('restaurant workspace requires membership, including when signed out', () => {
  assert.equal(canAccessRestaurant(null), false);
  assert.equal(canAccessRestaurant({ restaurantId: null }), false);
  assert.equal(canAccessRestaurant({ restaurantId: '' }), false);
  assert.equal(canAccessRestaurant({ restaurantId: pass.restaurantId }), true);
});

test('staff sign-in returns to the dedicated portal and cannot redirect to arbitrary URLs', () => {
  assert.equal(signInDestination('restaurant'), '/restaurant');
  for (const value of [undefined, 'eater', ['restaurant'], 'https://example.com', '/(partner)']) {
    assert.equal(signInDestination(value), '/');
  }
});
