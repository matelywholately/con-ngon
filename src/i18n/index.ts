import { useSyncExternalStore } from 'react';
import { getLocales } from 'expo-localization';
import { en } from './en';
import { interpolate, plural } from './strings';
import { vi, type Dictionary } from './vi';

export type Locale = 'vi' | 'en';

const DICTIONARIES: Record<Locale, Dictionary> = { vi, en };

/**
 * Vietnamese-first: anything that is not explicitly English falls back to
 * Vietnamese, not the other way round.
 */
function detectLocale(): Locale {
  const first = getLocales()[0];
  return first?.languageCode === 'en' ? 'en' : 'vi';
}

let current: Locale = detectLocale();
const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLocale(next: Locale): void {
  if (next === current) return;
  current = next;
  for (const fn of listeners) fn();
}

export function getLocale(): Locale {
  return current;
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

/**
 * Returns the active dictionary plus the two formatters. Components read
 * `t.discover.title` directly, reach for `f()` when a string has
 * placeholders, and for `p()` when a count decides the wording.
 */
export function useT(): {
  t: Dictionary;
  f: typeof interpolate;
  p: typeof plural;
  locale: Locale;
} {
  const locale = useLocale();
  return { t: DICTIONARIES[locale], f: interpolate, p: plural, locale };
}

export { vi, en, interpolate, plural };
export { pluralForm } from './strings';
export type { Countable, PluralForms } from './strings';
export type { Dictionary };
