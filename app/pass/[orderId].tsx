import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown';
import { EmptyState, Screen } from '@/components/Screen';
import { PageHeader } from '@/components/PageHeader';
import { PickupQrCard } from '@/components/PickupQrCard';
import { PickupSteps } from '@/components/PickupSteps';
import { useT } from '@/i18n';
import { formatTime, formatVnd } from '@/lib/format';
import { cancelOrder, fetchMyOrders } from '@/lib/queries';
import { displayedOrderStatus, pickupDeadline } from '@/lib/reservations';
import { useSession } from '@/features/session';
import type { OrderWithListing } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

/**
 * The pickup pass. Everything a person needs while standing outside the
 * restaurant, in one screen, at a size readable at arm's length in daylight.
 */
export default function PickupPass() {
  const { colors } = useTheme();
  const { t, f } = useT();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { refreshProfile } = useSession();

  const [order, setOrder] = useState<OrderWithListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(() => {
    setLoading(true);
    fetchMyOrders()
      .then((orders) => setOrder(orders.find((o) => o.id === orderId) ?? null))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <Screen>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }
  if (!order) {
    return (
      <Screen>
        <EmptyState title={t.common.errorTitle} body={t.common.errorBody} />
      </Screen>
    );
  }

  const deadline = pickupDeadline(order.listing);
  const status = displayedOrderStatus(order, now);
  const active = status === 'reserved';
  const statusLabel = status === 'collected' ? t.pass.collected
    : status === 'cancelled' ? t.pass.cancelled
    : status === 'incident' ? t.orders.statusIncident : t.pass.expired;
  const cancel = async () => {
    if (busy || !active) return;
    setBusy(true);
    setError(null);
    try {
      const result = await cancelOrder(order.id);
      if (!result.ok) {
        setError(result.reason === 'unknown' ? t.pass.cancelFailed : t.pass.cancelTooLate);
        return;
      }
      setOrder({ ...order, status: 'cancelled' });
      await refreshProfile();
    } catch { setError(t.pass.cancelFailed); }
    finally { setBusy(false); }
  };

  const openDirections = () => {
    const { lat, lng } = order.listing.restaurant;
    const label = encodeURIComponent(order.listing.restaurant.name);
    const url = Platform.select({
      ios: `maps://?daddr=${lat},${lng}&q=${label}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    void Linking.openURL(url);
  };

  return (
    <Screen padded={false}>
      <PageHeader title={t.pass.title} backHref="/(eater)/orders" orders />
      <ScrollView contentContainerStyle={styles.content}>
      {active ? <PickupSteps current={2} /> : null}
      <View style={styles.top}>
        {!active ? <Text style={[type.label, { color: colors.inkFaint }]}>
          {statusLabel.toUpperCase()}
        </Text> : null}

        {active ? <View style={styles.qr}><PickupQrCard key={order.id} order={order} /></View> : null}

        <View style={[styles.block, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[type.label, { color: colors.inkFaint }]}>{t.pass.summary.toUpperCase()}</Text>
          <Text style={[type.heading, { color: colors.ink }]}>{order.listing.title}</Text>
          <Text style={[type.bodyStrong, { color: colors.ink }]}>
            {order.portions === 1 ? t.offer.onePortion : f(t.offer.portions, { n: order.portions })} · {order.price_paid_vnd === 0 ? t.common.free : formatVnd(order.price_paid_vnd)}
          </Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>
            {order.listing.restaurant.name}
          </Text>
          <Text style={[type.small, { color: colors.inkFaint }]}>
            {order.listing.restaurant.address}
          </Text>
          <Text style={[type.body, { color: colors.brandInk }]}>
            {f(t.pass.pickupTime, { from: formatTime(new Date(order.listing.pickup_from)), until: formatTime(deadline) })}
          </Text>
          {active ? <Countdown deadline={deadline} size="lg" /> : null}
          {order.listing.restaurant.pickup_instructions ? (
            <Text style={[type.small, styles.instructions, { color: colors.inkMuted }]}>
              {order.listing.restaurant.pickup_instructions}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.footer}>
        {error ? <Text style={[type.small, { color: colors.danger }]}>{error}</Text> : null}
        <Button label={t.pass.directions} onPress={openDirections} />
        <Button
          label={t.common.done}
          variant="secondary"
          onPress={() => router.replace('/(eater)/orders')}
        />
        {active ? <>
          <Button label={t.pass.refresh} variant="ghost" onPress={load} disabled={busy} />
          <Text style={[type.small, { color: colors.inkMuted }]}>{t.pass.cancelCreditHint}</Text>
          <Button label={t.pass.cancelOrder} variant="secondary" onPress={() => void cancel()} loading={busy} />
        </> : null}
      </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  top: { gap: space.md, alignItems: 'center', paddingTop: space.md },
  qr: { width: '100%' },
  block: {
    width: '100%',
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  instructions: { marginTop: space.xs },
  footer: { gap: space.sm, paddingVertical: space.lg },
});
