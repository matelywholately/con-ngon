import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '@/features/session';
import { useTheme } from '@/theme';

/** The marketplace is the default entry; staff use /restaurant separately. */
export default function Index() {
  const { loading, user } = useSession();
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
  return <Redirect href="/(eater)" />;
}
