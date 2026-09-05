import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Chip';
import { EmptyState, Screen, ScreenTitle } from '@/components/Screen';
import { useTabBarClearance } from '@/components/TabBar';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { formatPickupCode, formatTime, formatVnd } from '@/lib/format';
import { fetchPartnerOrders } from '@/lib/queries';
import type { PartnerOrder } from '@/lib/types';
import { font, radius, space, type, useTheme } from '@/theme';

/** Who is on the way, and the code each of them will say at the counter. */
export default function PartnerOrders() {
  const { colors } = useTheme();
  const { t, f } = useT();
  const clearance = useTabBarClearance();
  const { user } = useSession();
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.restaurantId) {
      setLoading(false);
      return;
    }
    fetchPartnerOrders(user.restaurantId)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [user?.restaurantId]);

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
        contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="account-clock-outline"
            title={t.partner.ordersTitle}
            body={t.partner.noOrders}
          />
        }
        renderItem={({ item }) => (
          <Card padded={false} style={styles.row}>
            {/* The code is what the whole interaction turns on, so it is set
                at the same weight as a price and nothing sits above it. */}
            <View style={[styles.code, { backgroundColor: colors.brand }]}>
              <Text style={[styles.codeText, { color: colors.onBrand }]}>
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
              <View style={styles.metaRow}>
                <Tag label={formatTime(new Date(item.reserved_at))} icon="clock-outline" />
                <Text style={[type.smallStrong, styles.amount, { color: colors.ink }]}>
                  {item.price_paid_vnd === 0 ? t.common.free : formatVnd(item.price_paid_vnd)}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { gap: space.md, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  code: {
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.sm,
  },
  codeText: {
    fontFamily: font.extrabold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  detail: { flex: 1, gap: 2 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.xs,
  },
  amount: { fontVariant: ['tabular-nums'] },
});
