/**
 * Formatting helpers. Pure — no React, no RN — so they are unit-testable.
 *
 * Prices are always whole đồng and always written out in full. Nobody in
 * Hanoi reads "25k" on a receipt, and abbreviating a price on a product
 * aimed at people counting their money is a small cruelty.
 */

/** 25000 -> "25.000₫" (Vietnamese uses "." as the thousands separator). */
export function formatVnd(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped}₫`;
}

/** Percentage saved versus the usual price, rounded down so we never overclaim. */
export function discountPercent(price: number, originalPrice: number): number | null {
  if (originalPrice <= 0 || price >= originalPrice) return null;
  return Math.floor(((originalPrice - price) / originalPrice) * 100);
}

/** 24-hour clock, which is what Vietnamese shopfronts and receipts use. */
export function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * A countdown that stays readable at a glance: minutes under an hour,
 * then hours and minutes.
 */
export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `0:${m.toString().padStart(2, '0')}`;
}

/** Distance in metres -> "450m" / "1,2km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)}m`;
  return `${(metres / 1000).toFixed(1).replace('.', ',')}km`;
}

/**
 * Rough walking time. 80 m/min is a realistic pace on Hanoi pavements,
 * which are rarely walkable in a straight line.
 */
export function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / 80));
}

/** Four-digit handover code, zero-padded, shown as "0421". */
export function formatPickupCode(code: string): string {
  return code.padStart(4, '0');
}

/** Vietnamese mobile numbers: 10 digits starting 03/05/07/08/09, or +84. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  const local = digits.startsWith('+84')
    ? `0${digits.slice(3)}`
    : digits.startsWith('84') && digits.length === 11
      ? `0${digits.slice(2)}`
      : digits;
  if (!/^0[35789]\d{8}$/.test(local)) return null;
  return `+84${local.slice(1)}`;
}

/**
 * Fold a Vietnamese string down to bare lowercase ASCII, for searching.
 *
 * Someone standing on a pavement types "bun cha", not "bún chả" — reaching
 * for tone marks on a phone keyboard is exactly the friction this app is
 * supposed to remove. NFD decomposition separates every vowel from its tone
 * and its horn, so the combining marks can be stripped in one pass. Đ/đ is
 * the one Vietnamese letter whose stroke lives inside the base glyph rather
 * than as a combining mark, so it needs its own rule.
 */
export function foldVi(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (match) => (match === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim();
}
