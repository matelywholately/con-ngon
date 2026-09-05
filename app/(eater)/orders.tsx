import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Chip';
import { Countdown } from '@/components/Countdown';
import { DishImage } from '@/components/DishImage';
import { EmptyState, Screen, ScreenTitle } from '@/components/Screen';
import { useTabBarClearance } from '@/components/TabBar';
import { useT } from '@/i18n';
import { formatPickupCode, formatVnd } from '@/lib/format';
import { fetchMyOrders } from '@/lib/queries';
import type { OrderWithListing } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

export default function Orders() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const clearance = useTabBarClearance();
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
        contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState icon="ticket-outline" title={t.orders.title} body={t.orders.empty} />
        }
        renderItem={({ item }) => {
          const deadline = new Date(
            Math.min(
              new Date(item.listing.pickup_until).getTime(),
              new Date(item.listing.safety_deadline).getTime(),
            ),
          );
          const waiting = item.status === 'reserved';
          return (
            <Card
              onPress={() =>
                router.push({ pathname: '/pass/[orderId]', params: { orderId: item.id } })
              }
              accessibilityLabel={`${item.listing.title}, ${statusLabel(item.status)}`}
              padded={false}
              style={styles.row}
            >
              <DishImage
                photoUrl={item.listing.photo_url}
                seed={item.listing_id}
                handling={item.listing.handling_class}
                round="md"
                style={styles.thumb}
              />
              <View style={styles.detail}>
                <Text style={[type.heading, { color: colors.ink }]} numberOfLines={1}>
                  {item.listing.title}
                </Text>
                <Text style={[type.small, { color: colors.inkMuted }]} numberOfLines={1}>
                  {item.listing.restaurant.name}
                </Text>
                <View style={styles.metaRow}>
                  {waiting ? (
                    <Countdown deadline={deadline} size="sm" />
                  ) : (
                    <Tag label={statusLabel(item.status)} />
                  )}
                  <Text style={[type.smallStrong, styles.amount, { color: colors.ink }]}>
                    {item.price_paid_vnd === 0 ? t.common.free : formatVnd(item.price_paid_vnd)}
                  </Text>
                </View>
              </View>
              {/* The code is the whole reason to open this row, so it is
                  legible without opening it. */}
              {waiting ? (
                <View style={[styles.code, { backgroundColor: colors.brandSoft }]}>
                  <Text style={[type.smallStrong, styles.codeText, { color: colors.brandInk }]}>
                    {formatPickupCode(item.pickup_code)}
                  </Text>
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { gap: space.md, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  thumb: { width: 66, height: 66 },
  detail: { flex: 1, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  amount: { fontVariant: ['tabular-nums'] },
  code: {
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs + 2,
    borderRadius: radius.sm,
  },
  codeText: { letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
});
