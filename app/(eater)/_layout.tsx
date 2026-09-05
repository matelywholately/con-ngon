import { Tabs } from 'expo-router';
import { TabIcon, useTabBarScreenOptions } from '@/components/TabBar';
import { useT } from '@/i18n';

export default function EaterLayout() {
  const { t } = useT();
  const tabBar = useTabBarScreenOptions();

  return (
    <Tabs screenOptions={{ headerShown: false, ...tabBar }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.discover,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon="bowl-mix-outline"
              iconActive="bowl-mix"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t.tabs.map,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="map-outline" iconActive="map" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t.tabs.orders,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon="ticket-confirmation-outline"
              iconActive="ticket-confirmation"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.account,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon="account-outline"
              iconActive="account"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
