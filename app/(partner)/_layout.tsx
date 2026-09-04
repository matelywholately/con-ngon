import { Tabs } from 'expo-router';
import { useT } from '@/i18n';
import { font, useTheme } from '@/theme';

export default function PartnerLayout() {
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
      <Tabs.Screen name="index" options={{ title: t.partner.todayTitle }} />
      <Tabs.Screen name="new" options={{ title: t.partner.newListing }} />
      <Tabs.Screen name="orders" options={{ title: t.partner.ordersTitle }} />
      <Tabs.Screen name="verify" options={{ title: t.partner.verifyTitle }} />
    </Tabs>
  );
}
