/**
 * String substitution and plural selection.
 *
 * Pure — no React, no expo-localization — so the rules that decide what a
 * sentence reads like can be tested under `node --test`. `index.ts` adds the
 * locale store and the hook on top and re-exports everything here.
 */

/** Substitutes {named} placeholders. Missing values are left visible. */
export function interpolate(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/** The two forms English needs. Other languages may need fewer. */
export type PluralForms = { readonly one: string; readonly other: string };

/**
 * A string whose wording depends on a count.
 *
 * Vietnamese has no grammatical plural — "1 suất" and "6 suất" use the very
 * same word, and there is nothing to vary — so the Vietnamese source writes
 * one string and marks the key `Countable`. That mark is the whole point: it
 * is what lets `en.ts` answer with the two forms English needs while the
 * dictionary's shape stays the contract between the two languages.
 *
 * A key is only worth marking when the count actually changes the words.
 * "{n} min left" is the same at 1 and at 40, so it stays a plain string.
 */
export type Countable = string | PluralForms;

/**
 * Picks the form for `n`.
 *
 * English takes the singular at exactly one, in either direction; everything
 * else, zero included, takes the plural — "0 portions", not "0 portion". A
 * plain string is a language with a single form, so it is returned as-is.
 */
export function pluralForm(value: Countable, n: number): string {
  if (typeof value === 'string') return value;
  return Math.abs(n) === 1 ? value.one : value.other;
}

/**
 * Picks the form for `n` and substitutes it. The count is available to the
 * template as `{n}`; anything else the string needs can be passed alongside.
 */
export function plural(
  value: Countable,
  n: number,
  values?: Record<string, string | number>,
): string {
  return interpolate(pluralForm(value, n), { n, ...values });
}
