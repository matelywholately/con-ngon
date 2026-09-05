/**
 * Design tokens.
 *
 * The visual language is Too Good To Go's: a deep teal on a warm off-white
 * ground, food photography carrying the page, generous radii, and soft
 * elevation instead of hairline borders. Two rules constrain it, and both
 * survive the restyle:
 *
 * 1. Amber is spent on exactly one thing — the countdown. Scarcity is the
 *    emotional core of the product, so nothing else competes for that colour.
 *    In particular a discount badge is teal, never amber: "70% off" and
 *    "18 minutes left" are different kinds of urgent and must not rhyme.
 * 2. There is no "charity" styling. A subsidised eater and a paying eater see
 *    identical screens; the credit is applied at checkout and is invisible at
 *    the counter. Anything that visually marks the free track marks the
 *    person using it.
 */

export const palette = {
  /**
   * Too Good To Go's "Blue Stone". Deeper and bluer than the sage green this
   * app started with — it holds its own as a solid fill behind white text,
   * which the old mid-green could not.
   */
  teal: '#00615F',
  tealDeep: '#00443F',
  tealBright: '#00857D',
  /**
   * "Vista White". Warm, not cool. Food photographed under Hanoi street light
   * is orange; a grey-green ground fought every single image.
   */
  vistaWhite: '#F9F3F0',
  ember: '#B4530C',
  chilli: '#B3261E',
  ink: '#1A1614',
} as const;

export type ThemeColors = {
  ground: string;
  surface: string;
  /** Inert fills: image beds, disabled chips, avatar backgrounds. */
  surfaceAlt: string;
  /** Recessed fills that read as "type here": inputs, search. */
  surfaceSunken: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  line: string;
  lineSoft: string;
  brand: string;
  brandSoft: string;
  brandInk: string;
  brandBright: string;
  onBrand: string;
  urgent: string;
  urgentSoft: string;
  danger: string;
  dangerSoft: string;
  /** Foreground for chips and text sitting directly on a photograph. */
  onImage: string;
  /** Scrim laid under those chips so they survive a bright photo. */
  onImageScrim: string;
};

export const lightColors: ThemeColors = {
  ground: '#F9F3F0',
  surface: '#FFFFFF',
  surfaceAlt: '#F0E6E0',
  surfaceSunken: '#F2EAE5',
  ink: '#1A1614',
  inkMuted: '#5F5551',
  inkFaint: '#8C807A',
  line: '#E8DCD5',
  lineSoft: '#F2EAE5',
  brand: '#00615F',
  brandSoft: '#DDEBE8',
  brandInk: '#00443F',
  brandBright: '#00857D',
  onBrand: '#FFFFFF',
  urgent: '#B4530C',
  urgentSoft: '#FBE6D2',
  danger: '#B3261E',
  dangerSoft: '#FBE2DE',
  onImage: '#FFFFFF',
  onImageScrim: 'rgba(20,14,12,0.55)',
};

export const darkColors: ThemeColors = {
  ground: '#12100F',
  surface: '#1C1917',
  surfaceAlt: '#272220',
  surfaceSunken: '#232020',
  ink: '#F6F0ED',
  inkMuted: '#B2A69F',
  inkFaint: '#8B7E78',
  line: '#332C29',
  lineSoft: '#262120',
  brand: '#4FBFB2',
  brandSoft: '#0E2C29',
  brandInk: '#7FD6C9',
  brandBright: '#63D3C4',
  onBrand: '#04211F',
  urgent: '#EDA458',
  urgentSoft: '#35240F',
  danger: '#E4776A',
  dangerSoft: '#351A17',
  onImage: '#FFFFFF',
  onImageScrim: 'rgba(0,0,0,0.55)',
};

/**
 * Colours that sit on top of a photograph or a camera feed rather than on a
 * themed surface. They do not vary between light and dark, because the thing
 * underneath them is an image in both.
 */
export const overlay = {
  /** The fallback glyph on a photo-less dish tile. */
  dishGlyph: 'rgba(255,255,255,0.62)',
  /** Scrim under chips laid over an image, top edge to transparent. */
  scrimStrong: 'rgba(0,0,0,0.30)',
  scrimClear: 'rgba(0,0,0,0)',
  /** The illustration glyph on an onboarding slide. */
  slideGlyph: 'rgba(255,255,255,0.85)',
  /** Behind a live camera preview, so the corners are not a bright flash. */
  camera: '#000000',
} as const;

/**
 * Illustration gradients for the three onboarding slides, in order: the
 * saving, the honesty about what is in the box, and the safety window. The
 * last one is brand teal because it is the claim the product is built on.
 */
export const onboardingTints: readonly (readonly [string, string])[] = [
  ['#F5CE9B', '#DE9A55'],
  ['#D7DEA9', '#8FA98A'],
  ['#2E8F82', '#00615F'],
];

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

/**
 * Rounder than before, and by a lot. The old 6/10/16 scale read as a utility
 * form; this one reads as a shopfront, which is what the discover feed is.
 */
export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 34,
  pill: 999,
} as const;

/**
 * Elevation replaces the 1px border that used to outline every card.
 *
 * `boxShadow` is one string across iOS, Android and web — it needs the New
 * Architecture on Android, which `app.json` enables. Dark mode gets heavier,
 * more opaque shadows because a soft shadow is invisible on a near-black
 * ground; the lift there comes mostly from the surface being lighter than
 * the ground.
 */
export const elevation = {
  light: {
    e1: '0px 1px 2px rgba(26,22,20,0.04), 0px 2px 6px rgba(26,22,20,0.05)',
    e2: '0px 2px 4px rgba(26,22,20,0.05), 0px 8px 18px rgba(26,22,20,0.07)',
    e3: '0px 4px 10px rgba(26,22,20,0.07), 0px 16px 34px rgba(26,22,20,0.10)',
  },
  dark: {
    e1: '0px 1px 2px rgba(0,0,0,0.40)',
    e2: '0px 2px 6px rgba(0,0,0,0.45), 0px 8px 18px rgba(0,0,0,0.35)',
    e3: '0px 4px 12px rgba(0,0,0,0.50), 0px 18px 36px rgba(0,0,0,0.40)',
  },
} as const;

export type ElevationLevel = keyof (typeof elevation)['light'];

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

/**
 * Larger and tighter at the top of the scale than before. A discover feed
 * that leads with photography needs headings with enough weight to hold the
 * page against them.
 */
export const type = {
  hero: { fontFamily: font.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  display: { fontFamily: font.extrabold, fontSize: 27, lineHeight: 34, letterSpacing: -0.7 },
  titleLg: { fontFamily: font.semibold, fontSize: 22, lineHeight: 29, letterSpacing: -0.4 },
  title: { fontFamily: font.semibold, fontSize: 19, lineHeight: 25, letterSpacing: -0.3 },
  heading: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: font.medium, fontSize: 11.5, lineHeight: 16 },
  label: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.7 },
  /** Prices and timers, so digits do not jitter as they tick. */
  numeric: { fontFamily: font.extrabold, fontSize: 22, lineHeight: 27, letterSpacing: -0.4 },
  numericLg: { fontFamily: font.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
} as const;

/** Minimum tap target. This app gets used one-handed, standing on a pavement. */
export const HIT_SIZE = 48;

/**
 * Height of the floating tab bar, excluding the safe-area inset below it.
 * It has to clear the 28pt icon pill plus a label line plus its own padding;
 * anything under 70 clips the labels of the longer Vietnamese tab names.
 */
export const TAB_BAR_HEIGHT = 70;
