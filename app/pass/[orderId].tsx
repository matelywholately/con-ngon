import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown';
import { EmptyState, Screen, StickyFooter } from '@/components/Screen';
import { useT } from '@/i18n';
import { formatPickupCode } from '@/lib/format';
import { fetchMyOrders } from '@/lib/queries';
import type { OrderWithListing } from '@/lib/types';
import { font, radius, space, type, useTheme } from '@/theme';

/** Dots rather than a dashed border: Android drops `borderStyle: 'dashed'`. */
const TEAR_DOTS = Array.from({ length: 22 }, (_, i) => i);

/**
 * The pickup pass. Everything a person needs while standing outside the
 * restaurant, in one screen, at a size readable at arm's length in daylight.
 *
 * It is now shaped like a ticket, notch and tear line included. That is not
 * decoration: the shape tells someone who has never used the app what the
 * screen is for before they read a word of it, and the counter staff on the
 * other side recognise it just as fast.
 */
export default function PickupPass() {
  const { colors, shadow } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [order, setOrder] = useState<OrderWithListing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyOrders()
      .then((orders) => setOrder(orders.find((o) => o.id === orderId) ?? orders[0] ?? null))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId]);

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
        <EmptyState
          icon="alert-circle-outline"
          title={t.common.errorTitle}
          body={t.common.errorBody}
        />
      </Screen>
    );
  }

  const deadline = new Date(
    Math.min(
      new Date(order.listing.pickup_until).getTime(),
      new Date(order.listing.safety_deadline).getTime(),
    ),
  );

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
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.ticket, shadow.e3, { backgroundColor: colors.surface }]}>
          <View style={[styles.stub, { backgroundColor: colors.brand }]}>
            <Text style={[type.label, { color: colors.brandSoft }]}>
              {t.pass.showThis.toUpperCase()}
            </Text>
            <Text
              style={[styles.code, { color: colors.onBrand }]}
              accessibilityRole="text"
              accessibilityLabel={order.pickup_code.split('').join(' ')}
            >
              {formatPickupCode(order.pickup_code)}
            </Text>
            <Text style={[type.small, { color: colors.brandSoft }]}>
              {t.pass.codeCaption}
            </Text>
          </View>

          {/* The notch circles are drawn half outside the ticket and clipped
              by its `overflow: hidden`, which is what turns them into bites
              rather than dots. */}
          <View style={styles.tear}>
            <View
              style={[styles.notch, styles.notchLeft, { backgroundColor: colors.ground }]}
            />
            <View style={styles.dots}>
              {TEAR_DOTS.map((i) => (
                <View key={i} style={[styles.dot, { backgroundColor: colors.line }]} />
              ))}
            </View>
            <View
              style={[styles.notch, styles.notchRight, { backgroundColor: colors.ground }]}
            />
          </View>

          <View style={styles.details}>
            <Countdown deadline={deadline} size="lg" />

            <Text style={[type.titleLg, { color: colors.ink }]}>
              {order.listing.title}
            </Text>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="storefront-outline"
                size={17}
                color={colors.inkFaint}
              />
              <Text style={[type.body, styles.detailText, { color: colors.ink }]}>
                {order.listing.restaurant.name}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={17}
                color={colors.inkFaint}
              />
              <Text style={[type.small, styles.detailText, { color: colors.inkMuted }]}>
                {order.listing.restaurant.address}
              </Text>
            </View>

            {order.listing.restaurant.pickup_instructions ? (
              <View style={[styles.instructions, { backgroundColor: colors.surfaceSunken }]}>
                <Text style={[type.small, { color: colors.inkMuted }]}>
                  {order.listing.restaurant.pickup_instructions}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <StickyFooter>
        <Button
          label={t.pass.directions}
          icon="navigation-variant"
          onPress={openDirections}
        />
        <Button
          label={t.common.done}
          variant="ghost"
          onPress={() => router.replace('/(eater)/orders')}
        />
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: space.xl },
  ticket: { borderRadius: radius.xl, overflow: 'hidden' },
  stub: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
  },
  code: {
    fontSize: 66,
    lineHeight: 76,
    fontFamily: font.extrabold,
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
  },
  tear: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notch: { width: 22, height: 22, borderRadius: radius.pill },
  notchLeft: { marginLeft: -11 },
  notchRight: { marginRight: -11 },
  dots: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
  },
  dot: { width: 5, height: 2, borderRadius: 1 },
  details: { gap: space.sm, padding: space.lg, paddingTop: space.md },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  detailText: { flex: 1 },
  instructions: {
    marginTop: space.xs,
    padding: space.md,
    borderRadius: radius.sm,
  },
});
