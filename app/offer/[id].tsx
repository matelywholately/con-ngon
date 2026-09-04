import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown';
import { EmptyState, Screen } from '@/components/Screen';
import { useT } from '@/i18n';
import { discountPercent, formatTime, formatVnd } from '@/lib/format';
import { fetchListing } from '@/lib/queries';
import { listingWindow } from '@/lib/safety';
import type { NearbyListing } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

export default function OfferDetail() {
  const { colors } = useTheme();
  const { t, f } = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [listing, setListing] = useState<NearbyListing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchListing(id)
      .then(setListing)
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  if (!listing) {
    return (
      <Screen>
        <EmptyState title={t.common.errorTitle} body={t.common.errorBody} />
      </Screen>
    );
  }

  const window = listingWindow({
    preparedAt: new Date(listing.prepared_at),
    handling: listing.handling_class,
    pickupFrom: new Date(listing.pickup_from),
    pickupUntil: new Date(listing.pickup_until),
    now: new Date(),
  });

  const isFree = listing.price_vnd === 0;
  const soldOut = listing.portions_left <= 0;
  const off = listing.original_price_vnd
    ? discountPercent(listing.price_vnd, listing.original_price_vnd)
    : null;

  const ctaLabel = !window.isCollectable
    ? t.offer.expiredCta
    : soldOut
      ? t.offer.soldOut
      : t.offer.reserve;

  return (
    <Screen edges={['top']} padded={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.surfaceAlt }]}>
          {listing.photo_url ? (
            <Image
              source={{ uri: listing.photo_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <Text style={[type.label, { color: colors.inkFaint }]}>ẢNH MÓN ĂN</Text>
          )}
        </View>

        <View style={styles.body}>
          <Countdown deadline={window.effectiveDeadline} size="lg" />

          <Text style={[type.display, { color: colors.ink }]}>{listing.title}</Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>
            {listing.restaurant_name} · {listing.restaurant_address}
          </Text>

          <View style={styles.priceRow}>
            <Text style={[type.display, styles.price, { color: isFree ? colors.brand : colors.ink }]}>
              {isFree ? t.common.free : formatVnd(listing.price_vnd)}
            </Text>
            {listing.original_price_vnd && !isFree ? (
              <Text style={[type.body, styles.struck, { color: colors.inkFaint }]}>
                {f(t.offer.originalPrice, { price: formatVnd(listing.original_price_vnd) })}
              </Text>
            ) : null}
            {off !== null ? (
              <Text style={[type.bodyStrong, { color: colors.brandInk }]}>−{off}%</Text>
            ) : null}
          </View>

          {listing.description ? (
            <View style={[styles.block, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Text style={[type.label, { color: colors.inkFaint }]}>
                {t.offer.contents.toUpperCase()}
              </Text>
              <Text style={[type.body, { color: colors.ink }]}>{listing.description}</Text>
              <Text style={[type.small, { color: colors.inkMuted }]}>
                {f(t.offer.portions, { n: listing.portions_left })}
              </Text>
            </View>
          ) : null}

          {/* The safety block. This is the argument the whole product rests on,
              so it gets its own panel rather than a line of fine print. */}
          <View style={[styles.block, { backgroundColor: colors.brandSoft, borderColor: 'transparent' }]}>
            <Text style={[type.label, { color: colors.brandInk }]}>
              {t.safety.title.toUpperCase()}
            </Text>
            <Text style={[type.body, { color: colors.brandInk }]}>
              {f(t.offer.cookedAt, { time: formatTime(new Date(listing.prepared_at)) })}
            </Text>
            <Text style={[type.body, { color: colors.brandInk }]}>
              {f(t.offer.pickupWindow, {
                from: formatTime(new Date(listing.pickup_from)),
                until: formatTime(window.effectiveDeadline),
              })}
            </Text>
            <Text style={[type.small, { color: colors.brandInk }]}>
              {t.offer.deadlineExplained}
            </Text>
            <Pressable onPress={() => router.push('/safety')} accessibilityRole="link">
              <Text style={[type.small, styles.link, { color: colors.brandInk }]}>
                {t.offer.safetyLink}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.block, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[type.label, { color: colors.inkFaint }]}>
              {t.offer.allergens.toUpperCase()}
            </Text>
            <Text style={[type.body, { color: colors.ink }]}>
              {listing.allergens.length > 0
                ? listing.allergens.join(' · ')
                : t.offer.noAllergens}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.ground, borderTopColor: colors.line }]}>
        <Button
          label={ctaLabel}
          disabled={soldOut || !window.isCollectable}
          onPress={() =>
            router.push({ pathname: '/reserve/[id]', params: { id: listing.id } })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 220, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg, gap: space.md },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  price: { fontVariant: ['tabular-nums'] },
  struck: { textDecorationLine: 'line-through' },
  block: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  link: { textDecorationLine: 'underline' },
  footer: { padding: space.lg, borderTopWidth: 1 },
});
