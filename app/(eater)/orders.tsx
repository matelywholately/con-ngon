import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SectionList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Countdown } from '@/components/Countdown';
import { EmptyState, Screen } from '@/components/Screen';
import { PageHeader } from '@/components/PageHeader';
import { useT } from '@/i18n';
import { formatVnd } from '@/lib/format';
import { fetchMyOrders } from '@/lib/queries';
import { displayedOrderStatus } from '@/lib/reservations';
import type { OrderWithListing } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

export default function Orders() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(useCallback(() => {
    fetchMyOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []));
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const statusLabel = (status: OrderWithListing['status']) =>
    status === 'collected'
      ? t.orders.statusCollected
      : status === 'no_show'
        ? t.orders.statusNoShow
        : status === 'cancelled'
          ? t.orders.statusCancelled
          : status === 'incident' ? t.orders.statusIncident : t.orders.statusReserved;

  if (loading) {
    return (
      <Screen>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  const sections = [
    { title: t.orders.active, data: orders.filter(order => displayedOrderStatus(order, now) === 'reserved') },
    { title: t.orders.past, data: orders.filter(order => displayedOrderStatus(order, now) !== 'reserved') },
  ].filter(section => section.data.length > 0);

  return (
    <Screen padded={false} edges={['top']}>
      <PageHeader title={t.orders.title} />
      <Text style={[type.body, styles.subtitle, { color: colors.inkMuted }]}>{t.orders.subtitle}</Text>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={[type.heading, styles.sectionTitle, { color: colors.ink }]}>{section.title}</Text>}
        ListEmptyComponent={<EmptyState title={t.orders.title} body={t.orders.empty} />}
        renderItem={({ item }) => {
          const status = displayedOrderStatus(item, now);
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
                {status === 'reserved' ? (
                  <Countdown deadline={deadline} />
                ) : (
                  <Text style={[type.small, { color: colors.inkFaint }]}>
                    {statusLabel(status)}
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
              {status === 'reserved' ? <View style={[styles.qrLink, { borderTopColor: colors.line }]}>
                <MaterialCommunityIcons name="qrcode" size={22} color={colors.brand} />
                <Text style={[type.bodyStrong, { color: colors.brandInk }]}>{t.orders.showQr}</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.brand} />
              </View> : null}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { paddingVertical: space.md, paddingHorizontal: space.lg },
  sectionTitle: { paddingTop: space.md, paddingBottom: space.sm },
  qrLink: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: 1, paddingTop: space.md, marginTop: space.sm },
  list: { gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.xxl, flexGrow: 1 },
  row: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { fontVariant: ['tabular-nums'] },
});
