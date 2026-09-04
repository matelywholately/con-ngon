import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown';
import { EmptyState, Screen, ScreenTitle } from '@/components/Screen';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { formatVnd } from '@/lib/format';
import { fetchPartnerListings, fetchPartnerOrders } from '@/lib/queries';
import type { NearbyListing, PartnerOrder } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

export default function PartnerToday() {
  const { colors } = useTheme();
  const { t, f } = useT();
  const router = useRouter();
  const { user, setActiveRole } = useSession();

  const [listings, setListings] = useState<NearbyListing[]>([]);
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const restaurantId = user?.restaurantId;

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    Promise.all([fetchPartnerListings(restaurantId), fetchPartnerOrders(restaurantId)])
      .then(([nextListings, nextOrders]) => {
        setListings(nextListings);
        setOrders(nextOrders);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [restaurantId]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  const recovered = orders.reduce((sum, order) => sum + order.price_paid_vnd, 0);
  const portionsLive = listings.reduce((sum, listing) => sum + listing.portions_left, 0);

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t.partner.todayTitle} />

      {/* Money recovered is the number that keeps a manager listing tomorrow,
          so it leads. */}
      <View style={styles.stats}>
        <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[type.label, { color: colors.inkFaint }]}>
            {t.partner.revenueToday.toUpperCase()}
          </Text>
          <Text style={[type.numeric, styles.figure, { color: colors.ink }]}>
            {formatVnd(recovered)}
          </Text>
        </View>
        <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[type.label, { color: colors.inkFaint }]}>
            {t.partner.liveListings.toUpperCase()}
          </Text>
          <Text style={[type.numeric, styles.figure, { color: colors.ink }]}>
            {f(t.offer.portions, { n: portionsLive })}
          </Text>
        </View>
      </View>

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState title={t.partner.todayTitle} body={t.partner.noListings} />
        }
        renderItem={({ item }) => {
          const deadline = new Date(
            Math.min(
              new Date(item.pickup_until).getTime(),
              new Date(item.safety_deadline).getTime(),
            ),
          );
          return (
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={styles.rowTop}>
                <Countdown deadline={deadline} />
                <Text style={[type.bodyStrong, styles.figure, { color: colors.ink }]}>
                  {formatVnd(item.price_vnd)}
                </Text>
              </View>
              <Text style={[type.heading, { color: colors.ink }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[type.small, { color: colors.inkMuted }]}>
                {f(t.discover.portionsLeft, { n: item.portions_left })} /{' '}
                {f(t.offer.portions, { n: item.portions_total })}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.footer}>
        <Button label={t.partner.newListing} onPress={() => router.push('/(partner)/new')} />
        <Button
          label={t.profile.switchToEater}
          variant="ghost"
          onPress={() => {
            setActiveRole('eater');
            router.replace('/(eater)');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: space.sm, paddingBottom: space.lg },
  stat: { flex: 1, gap: space.xs, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  figure: { fontVariant: ['tabular-nums'] },
  list: { gap: space.md, paddingBottom: space.lg, flexGrow: 1 },
  row: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footer: { gap: space.sm, paddingVertical: space.md },
});
