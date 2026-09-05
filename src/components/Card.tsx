import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radius, space, useTheme, type ElevationLevel } from '@/theme';

export type CardTone = 'surface' | 'brand' | 'sunken' | 'plain';

/**
 * The one surface primitive.
 *
 * Cards used to be outlined with a 1px border on a grey ground. They are now
 * white on a warm ground and lifted with a shadow instead — the border is
 * gone everywhere except `plain`, which exists for the rare block that needs
 * to read as an outline rather than an object.
 */
export function Card({
  children,
  onPress,
  tone = 'surface',
  level = 'e1',
  padded = true,
  round = 'lg',
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  tone?: CardTone;
  level?: ElevationLevel | 'none';
  padded?: boolean;
  round?: keyof typeof radius;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors, shadow } = useTheme();

  const background =
    tone === 'brand'
      ? colors.brandSoft
      : tone === 'sunken'
        ? colors.surfaceSunken
        : tone === 'plain'
          ? 'transparent'
          : colors.surface;

  const base: StyleProp<ViewStyle> = [
    { backgroundColor: background, borderRadius: radius[round] },
    padded && styles.padded,
    // A tinted or transparent block is not an object sitting above the page,
    // so it gets no lift — only true surfaces do.
    tone === 'surface' && level !== 'none' ? shadow[level] : null,
    tone === 'plain' && { borderWidth: 1, borderColor: colors.line },
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  padded: { padding: space.lg },
  // A scale would reflow the whole list; opacity is cheap and reads as a tap.
  pressed: { opacity: 0.88 },
});
