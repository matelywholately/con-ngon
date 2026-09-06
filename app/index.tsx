import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '@/features/session';
import { space, type, useTheme } from '@/theme';

/** Routing gate: decides which of the three worlds the user lands in. */
export default function Index() {
  const { loading, user, activeRole } = useSession();
  const { colors } = useTheme();

  if (loading) {
    // Held between the native splash and the first screen. It carries the
    // wordmark so the handover does not flash an empty coloured rectangle.
    return (
      <View style={[styles.root, { backgroundColor: colors.ground }]}>
        <Text style={[type.hero, { color: colors.ink }]}>
          Còn <Text style={{ color: colors.brand }}>Ngon</Text>
        </Text>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (activeRole === 'partner_staff' && user.restaurantId) {
    return <Redirect href="/(partner)" />;
  }
  return <Redirect href="/(eater)" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
});
