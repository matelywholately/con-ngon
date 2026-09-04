import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Countdown } from './Countdown';
import { useT } from '@/i18n';
import {
  discountPercent,
  formatDistance,
  formatTime,
  formatVnd,
  walkMinutes,
} from '@/lib/format';
import type { NearbyListing } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

/**
 * The discover card.
 *
 * It deliberately shows the dish name, not a category, and the portion count,
 * not a "bag". Someone deciding whether to spend their last 30.000₫ should
 * not have to gamble on what is inside.
 */
export function OfferCard({
  listing,
  onPress,
}: {
  listing: NearbyListing;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { t, f } = useT();

  const deadline = new Date(
    Math.min(
      new Date(listing.pickup_until).getTime(),
      new Date(listing.safety_deadline).getTime(),
    ),
  );
  const isFree = listing.price_vnd === 0;
  // A free meal already says everything; "Free −100%" is just noise.
  const off =
    listing.original_price_vnd && !isFree
      ? discountPercent(listing.price_vnd, listing.original_price_vnd)
      : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${
        isFree ? t.common.free : formatVnd(listing.price_vnd)
      }, ${listing.restaurant_name}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]}>
        {listing.photo_url ? (
          <Image
            source={{ uri: listing.photo_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Text style={[type.label, { color: colors.inkFaint }]}>ẢNH MÓN</Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Countdown deadline={deadline} />
          {listing.is_vegetarian ? (
            <View style={[styles.tag, { backgroundColor: colors.brandSoft }]}>
              <Text style={[type.label, { color: colors.brandInk }]}>
                {t.offer.vegetarian.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[type.heading, { color: colors.ink }]} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={[type.small, { color: colors.inkMuted }]} numberOfLines={1}>
          {listing.restaurant_name}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[type.small, { color: colors.inkFaint }]} numberOfLines={1}>
            {formatDistance(listing.distance_m)} ·{' '}
            {f(t.discover.walkAway, { n: walkMinutes(listing.distance_m) })} ·{' '}
            {f(t.discover.portionsLeft, { n: listing.portions_left })}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text
            style={[
              type.numeric,
              styles.price,
              { color: isFree ? colors.brand : colors.ink },
            ]}
          >
            {isFree ? t.common.free : formatVnd(listing.price_vnd)}
          </Text>
          {listing.original_price_vnd && !isFree ? (
            <Text
              style={[type.small, styles.struck, { color: colors.inkFaint }]}
            >
              {formatVnd(listing.original_price_vnd)}
            </Text>
          ) : null}
          {off !== null ? (
            <Text style={[type.small, { color: colors.brandInk }]}>−{off}%</Text>
          ) : null}
          <View style={styles.spacer} />
          <Text style={[type.small, { color: colors.inkFaint }]}>
            {formatTime(new Date(listing.prepared_at))}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  thumb: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3, justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 2 },
  tag: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.sm },
  metaRow: { marginTop: 1 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    marginTop: space.xs,
  },
  price: { fontVariant: ['tabular-nums'] },
  struck: { textDecorationLine: 'line-through' },
  spacer: { flex: 1 },
});
