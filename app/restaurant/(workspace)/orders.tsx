import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { EmptyState, Screen, ScreenTitle } from '@/components/Screen';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { formatPickupCode, formatTime, formatVnd } from '@/lib/format';
import { fetchPartnerOrders } from '@/lib/queries';
import type { PartnerOrder } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

/** Who is on the way, and the code each of them will say at the counter. */
export default function PartnerOrders() {
  const { colors } = useTheme();
  const { t, f } = useT();
  const { user } = useSession();
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!user?.restaurantId) {
      setLoading(false);
      return;
    }
    fetchPartnerOrders(user.restaurantId)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [user?.restaurantId]));

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
      <ScreenTitle title={t.partner.ordersTitle} />
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState title={t.partner.ordersTitle} body={t.partner.noOrders} />
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={[styles.code, { backgroundColor: colors.brandSoft }]}>
              <Text style={[styles.codeText, { color: colors.brandInk }]}>
                {formatPickupCode(item.pickup_code)}
              </Text>
            </View>
            <View style={styles.detail}>
              <Text style={[type.heading, { color: colors.ink }]} numberOfLines={1}>
                {item.eater_name ?? '—'}
              </Text>
              <Text style={[type.small, { color: colors.inkMuted }]} numberOfLines={1}>
                {item.listing_title} · {f(t.offer.portions, { n: item.portions })}
              </Text>
              <Text style={[type.small, { color: colors.inkFaint }]}>
                {formatTime(new Date(item.reserved_at))} ·{' '}
                {item.price_paid_vnd === 0 ? t.common.free : formatVnd(item.price_paid_vnd)}
              </Text>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { gap: space.md, paddingBottom: space.xxl, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  code: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  codeText: {
    fontFamily: 'BeVietnamPro_800ExtraBold',
    fontSize: 22,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  detail: { flex: 1, gap: 2 },
});
