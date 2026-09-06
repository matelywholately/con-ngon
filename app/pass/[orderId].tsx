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
import QRCode from 'react-native-qrcode-svg';
import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown';
import { EmptyState, Screen, StickyFooter } from '@/components/Screen';
import { useT } from '@/i18n';
import { directionsUrl } from '@/lib/directions';
import { formatPickupCode, pickupPassPayload } from '@/lib/format';
import { fetchMyOrders } from '@/lib/queries';
import type { OrderWithListing } from '@/lib/types';
import { font, overlay, radius, space, type, useTheme } from '@/theme';

/** Big enough to scan from across a counter without dominating the digits. */
const QR_SIZE = 132;

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
 *
 * The QR is the shortcut, not the primary path. Reading four digits aloud
 * across a counter beats getting a camera to focus on someone else's phone,
 * and it still works on a cracked screen in bad light — so the digits stay
 * the loudest thing here and the code sits above them.
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
    const { lat, lng, name } = order.listing.restaurant;
    const platform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    void Linking.openURL(directionsUrl({ lat, lng, label: name }, platform));
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.ticket, shadow.e3, { backgroundColor: colors.surface }]}>
          <View style={[styles.stub, { backgroundColor: colors.brand }]}>
            <Text style={[type.label, { color: colors.brandSoft }]}>
              {t.pass.showThis.toUpperCase()}
            </Text>

            {/* The panel is always white and the modules always dark, in both
                themes: the scanner on the other side does not have one. */}
            <View style={[styles.qrPanel, { backgroundColor: overlay.qrGround }]}>
              <QRCode
                value={pickupPassPayload(order.pickup_code)}
                size={QR_SIZE}
                color={overlay.qrModule}
                backgroundColor={overlay.qrGround}
                quietZone={0}
                // Medium recovery: enough to survive a fingerprint or a glare
                // spot without making the modules too fine to read at arm's
                // length on a cheap screen.
                ecl="M"
              />
            </View>

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
  qrPanel: {
    padding: space.md,
    borderRadius: radius.md,
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
