import { Tabs } from 'expo-router';
import { useT } from '@/i18n';
import { font, useTheme } from '@/theme';

export default function EaterLayout() {
  const { colors } = useTheme();
  const { t } = useT();

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
      <Tabs.Screen name="index" options={{ title: t.discover.title }} />
      <Tabs.Screen name="map" options={{ title: t.discover.mapTab }} />
      <Tabs.Screen name="orders" options={{ title: t.orders.title }} />
      <Tabs.Screen name="profile" options={{ title: t.profile.title }} />
    </Tabs>
  );
}
