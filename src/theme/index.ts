import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from './tokens';

export * from './tokens';

export type Theme = {
  colors: ThemeColors;
  dark: boolean;
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return { colors: dark ? darkColors : lightColors, dark };
}

/** Colour for a listing's urgency state. Used by the countdown and by tags. */
export function urgencyColor(
  colors: ThemeColors,
  urgency: 'fresh' | 'soon' | 'urgent' | 'expired',
): { fg: string; bg: string } {
  switch (urgency) {
    case 'fresh':
      return { fg: colors.brandInk, bg: colors.brandSoft };
    case 'soon':
      return { fg: colors.brandInk, bg: colors.brandSoft };
    case 'urgent':
      return { fg: colors.urgent, bg: colors.urgentSoft };
    case 'expired':
      return { fg: colors.danger, bg: colors.dangerSoft };
  }
}
