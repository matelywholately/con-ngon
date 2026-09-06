import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Countdown } from './Countdown';
import { DishImage } from './DishImage';
import { Tag } from './Chip';
import { useT } from '@/i18n';
import {
  discountPercent,
  formatDistance,
  formatVnd,
  walkMinutes,
} from '@/lib/format';
import { freeTrackWindow } from '@/lib/priority';
import type { NearbyListing } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

/**
 * The discover card.
 *
 * It deliberately shows the dish name, not a category, and the portion count,
 * not a "bag". Someone deciding whether to spend their last 30.000₫ should
 * not have to gamble on what is inside.
 *
 * The layout is now image-led rather than a thumbnail beside a paragraph: the
 * picture is the reason anyone stops scrolling, and at 92px it was too small
 * to be that reason. The countdown moves on top of it, where it is the first
 * thing read, and the price sits alone below a rule so it is the last.
 */
export function OfferCard({
  listing,
  onPress,
}: {
  listing: NearbyListing;
  onPress: () => void;
}) {
  const { colors, shadow } = useTheme();
  const { t, f } = useT();

  const deadline = new Date(
    Math.min(
      new Date(listing.pickup_until).getTime(),
      new Date(listing.safety_deadline).getTime(),
    ),
  );
  const isFree = listing.price_vnd === 0;
  // Marks the listing, not the viewer: everyone sees the same chip, whether or
  // not they hold credit. Nothing here reveals who is on the subsidised track.
  const priority = freeTrackWindow({
    priceVnd: listing.price_vnd,
    listedAt: new Date(listing.created_at),
    deadline,
    now: new Date(),
  });
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
        shadow.e2,
        { backgroundColor: colors.surface, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.imageWrap}>
        <DishImage
          photoUrl={listing.photo_url}
          seed={listing.id}
          handling={listing.handling_class}
          vegetarian={listing.is_vegetarian}
          round="xs"
          scrim
          style={styles.image}
        />
        <View style={styles.imageTop}>
          <Countdown deadline={deadline} onImage />
          {priority.inPriorityWindow ? (
            <Tag label={t.offer.priorityTag} tone="onImage" icon="hand-heart-outline" />
          ) : listing.is_vegetarian ? (
            <Tag label={t.offer.vegetarian} tone="onImage" icon="leaf" />
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={[type.title, { color: colors.ink }]} numberOfLines={1}>
          {listing.title}
        </Text>

        <View style={styles.placeRow}>
          <View style={[styles.placeMark, { backgroundColor: colors.brandSoft }]}>
            <MaterialCommunityIcons
              name="storefront-outline"
              size={13}
              color={colors.brandInk}
            />
          </View>
          <Text
            style={[type.small, styles.placeName, { color: colors.inkMuted }]}
            numberOfLines={1}
          >
            {listing.restaurant_name}
          </Text>
        </View>

        <Text style={[type.small, { color: colors.inkFaint }]} numberOfLines={1}>
          {formatDistance(listing.distance_m)} ·{' '}
          {f(t.discover.walkAway, { n: walkMinutes(listing.distance_m) })} ·{' '}
          {f(t.discover.portionsLeft, { n: listing.portions_left })}
        </Text>

        <View style={[styles.rule, { backgroundColor: colors.lineSoft }]} />

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
            <Text style={[type.small, styles.struck, { color: colors.inkFaint }]}>
              {formatVnd(listing.original_price_vnd)}
            </Text>
          ) : null}
          <View style={styles.spacer} />
          {/* Teal, not amber: amber belongs to the countdown alone. */}
          {off !== null ? <Tag label={`−${off}%`} tone="solid" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  imageWrap: { position: 'relative' },
  image: { height: 164, borderRadius: 0 },
  imageTop: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  body: { padding: space.lg, gap: space.xs + 1 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  placeMark: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeName: { flexShrink: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginTop: space.md - 1 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md - 3,
  },
  price: { fontVariant: ['tabular-nums'] },
  struck: { textDecorationLine: 'line-through' },
  spacer: { flex: 1 },
});
