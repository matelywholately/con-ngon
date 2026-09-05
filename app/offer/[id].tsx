import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { RoundButton, Tag } from '@/components/Chip';
import { Countdown } from '@/components/Countdown';
import { DishImage } from '@/components/DishImage';
import { EmptyState, Screen, SectionLabel, StickyFooter } from '@/components/Screen';
import { useT } from '@/i18n';
import { discountPercent, formatTime, formatVnd } from '@/lib/format';
import { fetchListing } from '@/lib/queries';
import { listingWindow } from '@/lib/safety';
import type { NearbyListing } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

export default function OfferDetail() {
  const { colors } = useTheme();
  const { t, f, p } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
        <EmptyState
          icon="alert-circle-outline"
          title={t.common.errorTitle}
          body={t.common.errorBody}
        />
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
  const off =
    listing.original_price_vnd && !isFree
      ? discountPercent(listing.price_vnd, listing.original_price_vnd)
      : null;

  const ctaLabel = !window.isCollectable
    ? t.offer.expiredCta
    : soldOut
      ? t.offer.soldOut
      : t.offer.reserve;

  return (
    <View style={[styles.root, { backgroundColor: colors.ground }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* The hero runs under the status bar; the back control floats on it
            rather than sitting in a header bar above it. */}
        <DishImage
          photoUrl={listing.photo_url}
          seed={listing.id}
          handling={listing.handling_class}
          vegetarian={listing.is_vegetarian}
          round="xs"
          scrim
          style={styles.hero}
        />

        <View style={[styles.heroControls, { top: insets.top + space.sm }]}>
          <RoundButton
            icon="arrow-left"
            tone="scrim"
            accessibilityLabel={t.common.back}
            onPress={() => router.back()}
          />
          {listing.is_vegetarian ? (
            <Tag label={t.offer.vegetarian} tone="onImage" icon="leaf" />
          ) : null}
        </View>

        {/* The sheet overlaps the image so the page reads as one card being
            pulled up over the photograph. */}
        <View style={[styles.sheet, { backgroundColor: colors.ground }]}>
          <Countdown deadline={window.effectiveDeadline} size="lg" />

          <Text style={[type.display, { color: colors.ink }]}>{listing.title}</Text>

          <View style={styles.priceRow}>
            <Text
              style={[
                type.numericLg,
                styles.price,
                { color: isFree ? colors.brand : colors.ink },
              ]}
            >
              {isFree ? t.common.free : formatVnd(listing.price_vnd)}
            </Text>
            {listing.original_price_vnd && !isFree ? (
              <Text style={[type.body, styles.struck, { color: colors.inkFaint }]}>
                {f(t.offer.originalPrice, {
                  price: formatVnd(listing.original_price_vnd),
                })}
              </Text>
            ) : null}
            <View style={styles.spacer} />
            {off !== null ? <Tag label={`−${off}%`} tone="solid" /> : null}
          </View>

          <Card style={styles.place}>
            <View style={[styles.placeMark, { backgroundColor: colors.brandSoft }]}>
              <MaterialCommunityIcons
                name="storefront-outline"
                size={19}
                color={colors.brandInk}
              />
            </View>
            <View style={styles.placeText}>
              <Text style={[type.heading, { color: colors.ink }]} numberOfLines={1}>
                {listing.restaurant_name}
              </Text>
              <Text style={[type.small, { color: colors.inkMuted }]} numberOfLines={2}>
                {listing.restaurant_address}
              </Text>
            </View>
          </Card>

          {listing.description ? (
            <Card style={styles.block}>
              <SectionLabel label={t.offer.aboutDish} />
              <Text style={[type.body, { color: colors.ink }]}>{listing.description}</Text>
              <Tag
                label={p(t.offer.portions, listing.portions_left)}
                tone="brand"
                icon="silverware-fork-knife"
              />
            </Card>
          ) : null}

          {/* The safety block. This is the argument the whole product rests on,
              so it gets its own panel rather than a line of fine print. */}
          <Card tone="brand" level="none" style={styles.block}>
            <View style={styles.safetyTop}>
              <MaterialCommunityIcons
                name="shield-check"
                size={19}
                color={colors.brandInk}
              />
              <Text style={[type.heading, { color: colors.brandInk }]}>
                {t.safety.title}
              </Text>
            </View>
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
              <Text style={[type.smallStrong, styles.link, { color: colors.brandInk }]}>
                {t.offer.safetyLink}
              </Text>
            </Pressable>
          </Card>

          <Card style={styles.block}>
            <SectionLabel label={t.offer.allergens} />
            <Text style={[type.body, { color: colors.ink }]}>
              {listing.allergens.length > 0
                ? listing.allergens.join(' · ')
                : t.offer.noAllergens}
            </Text>
          </Card>
        </View>
      </ScrollView>

      {/* Price stays beside the action, so nobody commits without seeing it. */}
      <StickyFooter>
        <View style={styles.cta}>
          <View style={styles.ctaPrice}>
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {t.reserve.total}
            </Text>
            <Text style={[type.numeric, styles.price, { color: colors.ink }]}>
              {isFree ? t.common.free : formatVnd(listing.price_vnd)}
            </Text>
          </View>
          <View style={styles.ctaButton}>
            <Button
              label={ctaLabel}
              disabled={soldOut || !window.isCollectable}
              onPress={() =>
                router.push({ pathname: '/reserve/[id]', params: { id: listing.id } })
              }
            />
          </View>
        </View>
      </StickyFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: space.lg },
  hero: { height: 288 },
  heroControls: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheet: {
    marginTop: -space.xl,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: space.lg,
    gap: space.md,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  price: { fontVariant: ['tabular-nums'] },
  struck: { textDecorationLine: 'line-through' },
  spacer: { flex: 1 },
  place: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  placeMark: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: { flex: 1, gap: 1 },
  block: { gap: space.sm, alignItems: 'flex-start' },
  safetyTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  link: { textDecorationLine: 'underline' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  ctaPrice: { gap: 0 },
  ctaButton: { flex: 1 },
});
