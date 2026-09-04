import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '@/features/session';
import { useTheme } from '@/theme';

/** Routing gate: decides which of the three worlds the user lands in. */
export default function Index() {
  const { loading, user, activeRole } = useSession();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.ground,
        }}
      >
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
