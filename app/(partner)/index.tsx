import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Chip';
import { Countdown } from '@/components/Countdown';
import { DishImage } from '@/components/DishImage';
import { EmptyState, Screen, ScreenTitle } from '@/components/Screen';
import { useTabBarClearance } from '@/components/TabBar';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { formatVnd } from '@/lib/format';
import { fetchPartnerListings, fetchPartnerOrders } from '@/lib/queries';
import type { NearbyListing, PartnerOrder } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

export default function PartnerToday() {
  const { colors } = useTheme();
  const { t, f, p } = useT();
  const router = useRouter();
  const clearance = useTabBarClearance();
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
      <ScreenTitle
        title={t.partner.todayTitle}
        trailing={
          <Button
            label={t.profile.switchToEater}
            variant="ghost"
            size="md"
            onPress={() => {
              setActiveRole('eater');
              router.replace('/(eater)');
            }}
          />
        }
      />

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Money recovered is the number that keeps a manager listing
                tomorrow, so it leads — and it is the only figure on the
                screen set in the brand colour. */}
            <Card style={[styles.stat, styles.statPrimary, { backgroundColor: colors.brand }]}>
              <Text style={[type.label, { color: colors.brandSoft }]}>
                {t.partner.revenueToday.toUpperCase()}
              </Text>
              <Text style={[type.numericLg, styles.figure, { color: colors.onBrand }]}>
                {formatVnd(recovered)}
              </Text>
            </Card>
            <Card style={styles.stat}>
              <Text style={[type.label, { color: colors.inkFaint }]}>
                {t.partner.liveListings.toUpperCase()}
              </Text>
              <Text style={[type.numeric, styles.figure, { color: colors.ink }]}>
                {p(t.offer.portions, portionsLive)}
              </Text>
            </Card>

            <View style={styles.newListing}>
              <Button
                label={t.partner.newListing}
                icon="plus-circle-outline"
                onPress={() => router.push('/(partner)/new')}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="storefront-outline"
            title={t.partner.todayTitle}
            body={t.partner.noListings}
          />
        }
        renderItem={({ item }) => {
          const deadline = new Date(
            Math.min(
              new Date(item.pickup_until).getTime(),
              new Date(item.safety_deadline).getTime(),
            ),
          );
          const sold = item.portions_total - item.portions_left;
          return (
            <Card padded={false} style={styles.row}>
              <DishImage
                photoUrl={item.photo_url}
                seed={item.id}
                handling={item.handling_class}
                vegetarian={item.is_vegetarian}
                round="md"
                style={styles.thumb}
              />
              <View style={styles.rowBody}>
                <Text style={[type.heading, { color: colors.ink }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Countdown deadline={deadline} size="sm" />
                {/* How much of the batch has actually moved, at a glance. */}
                <View style={[styles.track, { backgroundColor: colors.surfaceSunken }]}>
                  <View
                    style={[
                      styles.trackFill,
                      {
                        backgroundColor: colors.brand,
                        width: `${
                          item.portions_total > 0
                            ? Math.round((sold / item.portions_total) * 100)
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={[type.small, { color: colors.inkMuted }]}>
                    {f(t.discover.portionsLeft, { n: item.portions_left })} /{' '}
                    {p(t.offer.portions, item.portions_total)}
                  </Text>
                  <Tag label={formatVnd(item.price_vnd)} />
                </View>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { gap: space.md, paddingBottom: space.md },
  stat: { gap: space.xs },
  statPrimary: { gap: space.sm },
  figure: { fontVariant: ['tabular-nums'] },
  newListing: { paddingTop: space.xs },
  list: { gap: space.md, flexGrow: 1 },
  row: { flexDirection: 'row', gap: space.md, padding: space.md },
  thumb: { width: 84, height: 84 },
  rowBody: { flex: 1, gap: space.xs + 2 },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: radius.pill },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
});
