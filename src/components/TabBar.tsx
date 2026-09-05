import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TAB_BAR_HEIGHT,
  font,
  radius,
  space,
  useTheme,
  type ThemeColors,
} from '@/theme';

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * The tab bar floats: a rounded, elevated bar inset from all three edges with
 * the feed scrolling underneath it, rather than a full-width strip welded to
 * the bottom of the screen behind a hairline.
 *
 * Because it is absolutely positioned it no longer takes space in the layout,
 * so every scrolling screen inside a tab navigator has to reserve room for it
 * with `useTabBarClearance()`. That is the cost of the look, and it is the
 * only thing to remember about it.
 */
export function useTabBarScreenOptions(): {
  tabBarActiveTintColor: string;
  tabBarInactiveTintColor: string;
  tabBarStyle: object;
  tabBarItemStyle: object;
  tabBarLabelStyle: object;
} {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();

  return {
    tabBarActiveTintColor: colors.brandInk,
    tabBarInactiveTintColor: colors.inkFaint,
    tabBarStyle: {
      position: 'absolute',
      left: space.md,
      right: space.md,
      // Sits above the home indicator on a gesture-nav phone, and a
      // comfortable thumb's distance up from the edge on one without.
      bottom: Math.max(insets.bottom, space.md),
      height: TAB_BAR_HEIGHT,
      paddingTop: space.sm,
      paddingBottom: space.sm + 2,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderTopWidth: 0,
      // React Navigation draws its own Android shadow; ours is the token.
      elevation: 0,
      ...shadow.e3,
    },
    tabBarItemStyle: { paddingTop: 0, paddingBottom: 0 },
    tabBarLabelStyle: { fontFamily: font.medium, fontSize: 10.5, marginTop: 1 },
  };
}

/** Vertical room a scrolling child of a tab navigator must leave at the end. */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, space.md) + space.lg;
}

/**
 * Outline when resting, solid when selected, with a tinted pill behind it.
 * The weight change alone is easy to miss on a cheap LCD in daylight; the
 * pill is what actually tells you where you are.
 */
export function TabIcon({
  icon,
  iconActive,
  color,
  focused,
}: {
  icon: Glyph;
  iconActive: Glyph;
  /** React Navigation hands this through as a ColorValue, not a string. */
  color: ColorValue;
  focused: boolean;
}) {
  const { colors }: { colors: ThemeColors } = useTheme();
  return (
    <View
      style={[
        styles.icon,
        focused && { backgroundColor: colors.brandSoft },
      ]}
    >
      <MaterialCommunityIcons
        name={focused ? iconActive : icon}
        size={21}
        color={color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 48,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
