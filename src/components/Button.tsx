import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, type, useTheme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';
type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * Pill-shaped, and taller than the old 48pt minimum at the `lg` size used for
 * every screen's primary action. This app is used one-handed, standing up,
 * often in the rain — the main button should be hard to miss.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  disabled = false,
  loading = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: Glyph;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}) {
  const { colors, shadow } = useTheme();
  const inert = disabled || loading;

  const background =
    variant === 'primary'
      ? colors.brand
      : variant === 'secondary'
        ? colors.surface
        : 'transparent';
  const foreground =
    variant === 'primary'
      ? colors.onBrand
      : variant === 'secondary'
        ? colors.ink
        : colors.brandInk;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        // A disabled button that still casts a shadow reads as tappable.
        variant !== 'ghost' && !inert ? shadow[variant === 'primary' ? 'e2' : 'e1'] : null,
        { backgroundColor: background, opacity: inert ? 0.4 : pressed ? 0.88 : 1 },
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator size="small" color={foreground} />
        ) : icon ? (
          <MaterialCommunityIcons name={icon} size={19} color={foreground} />
        ) : null}
        <Text
          style={[size === 'lg' ? type.heading : type.bodyStrong, { color: foreground }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  md: { minHeight: 48 },
  lg: { minHeight: 56 },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
