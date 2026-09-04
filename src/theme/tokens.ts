/**
 * Design tokens.
 *
 * Two rules this palette exists to enforce:
 *
 * 1. Amber is spent on exactly one thing — the countdown. Scarcity is the
 *    emotional core of the product, so nothing else competes for that colour.
 * 2. There is no "charity" styling. A subsidised eater and a paying eater see
 *    identical screens; the credit is applied at checkout and is invisible at
 *    the counter. Anything that visually marks the free track marks the
 *    person using it.
 */

export const palette = {
  pandan: '#1E5C44',
  pandanLight: '#68C79B',
  countdown: '#B85D0C',
  countdownLight: '#EDA458',
  expired: '#9F2B21',
  expiredLight: '#E4776A',
  riceWater: '#F1F3EE',
  ink: '#131A15',
} as const;

export type ThemeColors = {
  ground: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  line: string;
  lineSoft: string;
  brand: string;
  brandSoft: string;
  brandInk: string;
  onBrand: string;
  urgent: string;
  urgentSoft: string;
  danger: string;
  dangerSoft: string;
};

export const lightColors: ThemeColors = {
  ground: '#F1F3EE',
  surface: '#FBFCFA',
  surfaceAlt: '#E7EBE3',
  ink: '#131A15',
  inkMuted: '#4A554D',
  inkFaint: '#6E7A72',
  line: '#D4DACE',
  lineSoft: '#E3E8DF',
  brand: '#1E5C44',
  brandSoft: '#DEEAE2',
  brandInk: '#134232',
  onBrand: '#FBFCFA',
  urgent: '#B85D0C',
  urgentSoft: '#FAE9D6',
  danger: '#9F2B21',
  dangerSoft: '#F7DEDB',
};

export const darkColors: ThemeColors = {
  ground: '#0D1210',
  surface: '#151C18',
  surfaceAlt: '#1E2721',
  ink: '#E9EFE9',
  inkMuted: '#A2AFA6',
  inkFaint: '#7C8A82',
  line: '#2A362E',
  lineSoft: '#212B24',
  brand: '#68C79B',
  brandSoft: '#16301F',
  brandInk: '#8FD9B4',
  onBrand: '#0D1210',
  urgent: '#EDA458',
  urgentSoft: '#33230F',
  danger: '#E4776A',
  dangerSoft: '#341A17',
};

/** 4pt grid. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/**
 * Be Vietnam Pro throughout. Vietnamese stacks diacritics above and below the
 * same glyph and most Latin UI faces collide or clip at small sizes; this one
 * was drawn with adaptive diacritic forms for exactly that.
 */
export const font = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  extrabold: 'BeVietnamPro_800ExtraBold',
} as const;

export const type = {
  display: { fontFamily: font.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  title: { fontFamily: font.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  heading: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
  /** Prices and timers, so digits do not jitter as they tick. */
  numeric: { fontFamily: font.extrabold, fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
} as const;

/** Minimum tap target. This app gets used one-handed, standing on a pavement. */
export const HIT_SIZE = 48;
