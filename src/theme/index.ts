import { useColorScheme } from 'react-native';
import {
  darkColors,
  elevation,
  lightColors,
  type ElevationLevel,
  type ThemeColors,
} from './tokens';

export * from './tokens';

/**
 * Deliberately `{ boxShadow: string }` rather than `ViewStyle`: a shadow is
 * also applied to `Text` (the pill options in `Choice`), and `ViewStyle` is
 * not assignable to `TextStyle`. The narrow shape satisfies both.
 */
export type ShadowSet = Readonly<Record<ElevationLevel, { boxShadow: string }>>;

export type Theme = {
  colors: ThemeColors;
  dark: boolean;
  /** Spread into a style: `[styles.card, shadow.e2]`. */
  shadow: ShadowSet;
};

/**
 * Built once per scheme rather than per call, so a card's style array is
 * referentially stable across renders and `FlatList` rows do not re-diff.
 */
const SHADOWS: Record<'light' | 'dark', ShadowSet> = {
  light: {
    e1: { boxShadow: elevation.light.e1 },
    e2: { boxShadow: elevation.light.e2 },
    e3: { boxShadow: elevation.light.e3 },
  },
  dark: {
    e1: { boxShadow: elevation.dark.e1 },
    e2: { boxShadow: elevation.dark.e2 },
    e3: { boxShadow: elevation.dark.e3 },
  },
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return {
    colors: dark ? darkColors : lightColors,
    dark,
    shadow: dark ? SHADOWS.dark : SHADOWS.light,
  };
}

export type UrgencyTone = {
  /** Text and dot. */
  fg: string;
  /** Pill fill. */
  bg: string;
};

/**
 * Colour for a listing's urgency state.
 *
 * Two surfaces need different answers. On a card body a tinted pill is
 * enough. On top of a photograph a tint disappears, so the chip goes solid:
 * white while there is time, then amber, then red — an escalation you can
 * read from across a pavement without reading the number.
 */
export function urgencyColor(
  colors: ThemeColors,
  urgency: 'fresh' | 'soon' | 'urgent' | 'expired',
  onImage = false,
): UrgencyTone {
  if (onImage) {
    switch (urgency) {
      case 'fresh':
      case 'soon':
        return { fg: colors.ink, bg: colors.surface };
      case 'urgent':
        return { fg: colors.onImage, bg: colors.urgent };
      case 'expired':
        return { fg: colors.onImage, bg: colors.danger };
    }
  }
  switch (urgency) {
    case 'fresh':
    case 'soon':
      return { fg: colors.brandInk, bg: colors.brandSoft };
    case 'urgent':
      return { fg: colors.urgent, bg: colors.urgentSoft };
    case 'expired':
      return { fg: colors.danger, bg: colors.dangerSoft };
  }
}

/**
 * Warm gradient pairs for listings with no photograph.
 *
 * Every fixture currently has `photo_url: null`, and in the field a rushed
 * kitchen will skip the camera too. A grey box would make those listings look
 * broken next to ones that have a picture, so the fallback is a deliberate
 * tile — warm, food-coloured, and stable per listing so the feed does not
 * reshuffle its colours on every refresh.
 */
const DISH_TINTS: readonly (readonly [string, string])[] = [
  ['#F5CE9B', '#DE9A55'],
  ['#EFB893', '#CE7C4F'],
  ['#E7D3A4', '#C9A85F'],
  ['#D7DEA9', '#A3B168'],
  ['#F2C3B0', '#D08A70'],
  ['#CFDCC8', '#8FA98A'],
];

/** Stable index from an id, so a dish keeps its colour between sessions. */
export function dishTint(seed: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return DISH_TINTS[hash % DISH_TINTS.length]!;
}
