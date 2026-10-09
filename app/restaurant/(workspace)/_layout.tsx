import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useT } from '@/i18n';
import { font, useTheme } from '@/theme';
import { useSession } from '@/features/session';
import { canAccessRestaurant } from '@/lib/access';
import { PageHeader } from '@/components/PageHeader';

export default function PartnerLayout() {
  const { colors } = useTheme();
  const { t } = useT();
  const { loading, user } = useSession();
  if (loading) return <ActivityIndicator color={colors.brand} />;
  if (!canAccessRestaurant(user)) return <Redirect href="/restaurant" />;

  return (
    <View style={{ flex: 1 }}>
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.ground }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <PageHeader title={t.restaurantPortal.workspace} />
      </View>
    </SafeAreaView>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t.partner.tabs.today,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="storefront-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: t.partner.tabs.new,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="plus-box-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t.partner.tabs.orders,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-clock-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="verify"
        options={{
          title: t.partner.tabs.verify,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="check-decagram-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen name="account" options={{ title: t.profile.title,
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" color={color} size={size} /> }} />
    </Tabs>
    </View>
  );
}
