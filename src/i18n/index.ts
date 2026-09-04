import { useSyncExternalStore } from 'react';
import { getLocales } from 'expo-localization';
import { en } from './en';
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

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

/**
 * Returns the active dictionary plus a formatter for strings with
 * placeholders. Components read `t.discover.title` directly and reach for
 * `f()` only when they need substitution.
 */
export function useT(): { t: Dictionary; f: typeof interpolate; locale: Locale } {
  const locale = useLocale();
  return { t: DICTIONARIES[locale], f: interpolate, locale };
}

export { vi, en };
export type { Dictionary };
