import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Countdown } from '@/components/Countdown';
import { Tag } from '@/components/Chip';
import { useT } from '@/i18n';
import { formatDistance, formatVnd, walkMinutes } from '@/lib/format';
import type { StoreMarker } from '@/lib/stores';
import { radius, space, type, useTheme } from '@/theme';

/**
 * The card under the map when a pin is chosen.
 *
 * A pin can only ever answer "where". This answers the question that decides
 * whether anyone walks there: how far, how long is left, how much, and how
 * much is still on the shelf. It is deliberately a summary of the *store*
 * rather than one meal — tapping through to the store page is where the
 * individual dishes live.
 */
export function StoreCard({
  store,
  onPress,
  width,
}: {
  store: StoreMarker;
  onPress: () => void;
  width: number;
}) {
  const { colors, shadow } = useTheme();
  const { t, f, p } = useT();

  const isFree = store.minPriceVnd === 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={store.name}
      style={({ pressed }) => [
        styles.card,
        shadow.e3,
        { width, backgroundColor: colors.surface, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.headRow}>
        {store.available ? (
          <Countdown deadline={store.soonestDeadline} size="sm" />
        ) : (
          <Tag label={t.map.soldOut} tone="neutral" />
        )}
        {store.bestDiscountPercent !== null && store.available && !isFree ? (
          // Teal, never amber: a discount must not rhyme with a countdown.
          // Suppressed when the price is zero — "Miễn phí" and "-100%" are
          // the same fact twice, and the second one reads as a sales pitch
          // on the one listing that must not look like a special case.
          <Tag label={`-${store.bestDiscountPercent}%`} tone="brand" />
        ) : null}
      </View>

      <Text style={[type.heading, { color: colors.ink }]} numberOfLines={1}>
        {store.name}
      </Text>

      <View style={styles.metaRow}>
        <MaterialCommunityIcons name="walk" size={14} color={colors.inkFaint} />
        <Text style={[type.small, { color: colors.inkFaint }]} numberOfLines={1}>
          {formatDistance(store.distance_m)} ·{' '}
          {f(t.discover.walkAway, { n: walkMinutes(store.distance_m) })} ·{' '}
          {p(t.map.offersHere, store.offerCount)}
        </Text>
      </View>

      <View style={[styles.priceRow, { borderTopColor: colors.lineSoft }]}>
        <Text
          style={[
            type.bodyStrong,
            styles.price,
            { color: store.available ? (isFree ? colors.brand : colors.ink) : colors.inkFaint },
          ]}
        >
          {store.available
            ? isFree
              ? t.common.free
              : f(t.map.fromPrice, { price: formatVnd(store.minPriceVnd) })
            : t.map.soldOut}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.inkFaint} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, borderRadius: radius.lg, gap: 3 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: space.sm,
    paddingTop: space.sm,
  },
  price: { fontVariant: ['tabular-nums'] },
});
