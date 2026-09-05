import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useT } from '@/i18n';
import { radius, space, type, useTheme } from '@/theme';

/**
 * Search over the loaded feed, not the server.
 *
 * The list is a walking radius' worth of listings — small enough to filter on
 * the device, which means results appear as you type even on a bad 3G cell in
 * a stairwell. `foldVi` does the actual matching, so a query typed without
 * tone marks still finds "Bún chả".
 */
export function SearchBar({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (next: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useT();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceSunken }]}>
      <MaterialCommunityIcons name="magnify" size={20} color={colors.inkFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t.discover.searchPlaceholder}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={t.common.search}
        returnKeyType="search"
        autoCorrect={false}
        style={[type.body, styles.input, { color: colors.ink }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel={t.common.clearFilters}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="close-circle" size={19} color={colors.inkFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 50,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
  },
  // Kills the browser's focus ring on the web target, which matches nothing
  // else in the app. `outlineWidth` is a real cross-platform style in RN 0.86
  // and is simply inert on iOS and Android.
  input: { flex: 1, paddingVertical: 0, outlineWidth: 0 },
});
