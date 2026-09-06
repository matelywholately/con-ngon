import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, type, useTheme } from '@/theme';

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * A filter chip in the discover header. Selected chips fill with the brand;
 * unselected ones are plain white so the row reads as a set of switches
 * rather than a row of buttons competing with the cards below.
 */
export function FilterChip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: Glyph;
}) {
  const { colors, shadow } = useTheme();
  const fg = selected ? colors.onBrand : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected ? null : shadow.e1,
        {
          backgroundColor: selected ? colors.brand : colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={15} color={fg} /> : null}
      <Text style={[type.smallStrong, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export type TagTone = 'brand' | 'neutral' | 'solid' | 'onImage';

/**
 * A static pill. Used for the vegetarian mark, the discount badge and the
 * portions-left count.
 *
 * The discount badge is deliberately brand teal and never amber: amber is
 * the countdown's alone, and "70% off" must not rhyme with "18 minutes left".
 */
export function Tag({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: TagTone;
  icon?: Glyph;
}) {
  const { colors, shadow } = useTheme();

  const { fg, bg } =
    tone === 'brand'
      ? { fg: colors.brandInk, bg: colors.brandSoft }
      : tone === 'solid'
        ? { fg: colors.onBrand, bg: colors.brand }
        : tone === 'onImage'
          ? { fg: colors.ink, bg: colors.surface }
          : { fg: colors.inkMuted, bg: colors.surfaceSunken };

  return (
    <View
      style={[styles.tag, tone === 'onImage' && shadow.e1, { backgroundColor: bg }]}
      accessibilityRole="text"
    >
      {icon ? <MaterialCommunityIcons name={icon} size={13} color={fg} /> : null}
      <Text style={[type.tiny, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Circular icon button: the back control over a hero image, and the like. */
export function RoundButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = 'surface',
}: {
  icon: Glyph;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'surface' | 'scrim';
}) {
  const { colors, shadow } = useTheme();
  const onScrim = tone === 'scrim';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.round,
        onScrim ? null : shadow.e2,
        {
          backgroundColor: onScrim ? colors.onImageScrim : colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={onScrim ? colors.onImage : colors.ink}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs + 1,
    borderRadius: radius.pill,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
