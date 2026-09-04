import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Countdown } from '@/components/Countdown';
import { EmptyState, Screen, ScreenTitle } from '@/components/Screen';
import { useT } from '@/i18n';
import { formatVnd } from '@/lib/format';
import { fetchMyOrders } from '@/lib/queries';
import type { OrderWithListing } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

export default function Orders() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = (status: OrderWithListing['status']) =>
    status === 'collected'
      ? t.orders.statusCollected
      : status === 'no_show'
        ? t.orders.statusNoShow
        : status === 'cancelled'
          ? t.orders.statusCancelled
          : t.orders.statusReserved;

  if (loading) {
    return (
      <Screen>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t.orders.title} />
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title={t.orders.title} body={t.orders.empty} />}
        renderItem={({ item }) => {
          const deadline = new Date(
            Math.min(
              new Date(item.listing.pickup_until).getTime(),
              new Date(item.listing.safety_deadline).getTime(),
            ),
          );
          return (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/pass/[orderId]', params: { orderId: item.id } })
              }
              accessibilityRole="button"
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}
            >
              <View style={styles.rowTop}>
                {item.status === 'reserved' ? (
                  <Countdown deadline={deadline} />
                ) : (
                  <Text style={[type.small, { color: colors.inkFaint }]}>
                    {statusLabel(item.status)}
                  </Text>
                )}
                <Text style={[type.bodyStrong, styles.amount, { color: colors.ink }]}>
                  {item.price_paid_vnd === 0 ? t.common.free : formatVnd(item.price_paid_vnd)}
                </Text>
              </View>
              <Text style={[type.heading, { color: colors.ink }]} numberOfLines={1}>
                {item.listing.title}
              </Text>
              <Text style={[type.small, { color: colors.inkMuted }]} numberOfLines={1}>
                {item.listing.restaurant.name}
              </Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { gap: space.md, paddingBottom: space.xxl, flexGrow: 1 },
  row: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { fontVariant: ['tabular-nums'] },
});
