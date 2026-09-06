import { Tabs } from 'expo-router';
import { TabIcon, useTabBarScreenOptions } from '@/components/TabBar';
import { useT } from '@/i18n';

export default function PartnerLayout() {
  const { t } = useT();
  const tabBar = useTabBarScreenOptions();

  return (
    <Tabs screenOptions={{ headerShown: false, ...tabBar }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.partnerToday,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon="storefront-outline"
              iconActive="storefront"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: t.tabs.partnerNew,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon="plus-box-outline"
              iconActive="plus-box"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t.tabs.partnerOrders,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon="account-clock-outline"
              iconActive="account-clock"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="verify"
        options={{
          title: t.tabs.partnerVerify,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon="check-decagram-outline"
              iconActive="check-decagram"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
