import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
      <Tabs.Screen
        name="index"
        options={{
          title: t.partner.todayTitle,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="storefront-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: t.partner.newListing,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="plus-box-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t.partner.ordersTitle,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-clock-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="verify"
        options={{
          title: t.partner.verifyTitle,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="check-decagram-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
