import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useT } from '@/i18n';
import { font, useTheme } from '@/theme';
import { useSession } from '@/features/session';

export default function EaterLayout() {
  const { colors } = useTheme();
  const { t } = useT();
  const { user, loading } = useSession();
  if (loading) return <ActivityIndicator color={colors.brand} />;
  if (!user) return <Redirect href="/(auth)/welcome" />;

  return (
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
        name="index"
        options={{
          title: t.discover.title,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bowl-mix-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t.discover.mapTab,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="map-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t.orders.title,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="ticket-confirmation-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile.title,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
