import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SIZE, radius, space, type, useTheme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const inert = disabled || loading;

  const background =
    variant === 'primary'
      ? colors.brand
      : variant === 'secondary'
        ? colors.surface
        : 'transparent';
  const foreground = variant === 'primary' ? colors.onBrand : colors.brandInk;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderColor: variant === 'secondary' ? colors.line : 'transparent',
          opacity: inert ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.inner}>
        {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
        <Text style={[type.bodyStrong, { color: foreground }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: HIT_SIZE,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
