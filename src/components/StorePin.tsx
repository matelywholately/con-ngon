import { StyleSheet, Text, View } from 'react-native';
import type { Cluster } from '@/lib/cluster';
import { formatVnd } from '@/lib/format';
import { radius, space, type, useTheme } from '@/theme';

/**
 * A map pin.
 *
 * Too Good To Go colours its pins by availability — green where there are
 * bags, grey where they have gone — and merges them into a counted bubble
 * when you zoom out. Both states are here, and both say something beyond
 * "a place exists here": the price you would pay, or how many places are
 * hiding under the one you are looking at.
 *
 * A grey pin is deliberately still a pin. "This street takes part and you
 * were late" is worth knowing; an empty map reads as "nobody near you does
 * this", which is a more discouraging claim and usually a false one.
 *
 * Plain views rather than SVG, so the same component draws on the web
 * schematic and could be rasterised for a native marker icon.
 */

/** The pin's own height, used to anchor it over its coordinate. */
export const PIN_HEIGHT = 34;
export const PIN_TAIL = 5;

export function StorePin({
  cluster,
  selected,
}: {
  cluster: Cluster;
  selected: boolean;
}) {
  const { colors, shadow } = useTheme();

  const background = cluster.available ? colors.brand : colors.inkFaint;
  const foreground = colors.onBrand;

  /**
   * A sold-out pin carries no number. There is no price to advertise and
   * nothing to count, and printing a placeholder in the space where a price
   * goes only invites a second look at a place not worth walking to. It stays
   * on the map, smaller and grey, because "this street takes part and you
   * were late" is worth knowing — it just is not worth reading twice.
   */
  if (!cluster.available && !cluster.isCluster) {
    return (
      <View style={styles.root}>
        <View
          style={[
            styles.dot,
            shadow.e1,
            {
              backgroundColor: background,
              borderColor: selected ? colors.onBrand : colors.surface,
            },
          ]}
        />
        <View style={[styles.tail, { backgroundColor: background }]} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.body,
          shadow.e2,
          selected ? styles.bodySelected : null,
          {
            backgroundColor: background,
            borderColor: selected ? colors.onBrand : 'transparent',
          },
        ]}
      >
        <Text
          style={[cluster.isCluster ? type.smallStrong : type.tiny, { color: foreground }]}
          numberOfLines={1}
        >
          {pinLabel(cluster)}
        </Text>
      </View>
      {/* A rotated square makes the tail without a second asset. */}
      <View style={[styles.tail, { backgroundColor: background }]} />
    </View>
  );
}

/**
 * What the pin says.
 *
 * A cluster shows how many places it hides. A single store shows its cheapest
 * price, because that is the number that decides whether the walk is worth it
 * — and a sold-out store shows that it is sold out, which decides the same
 * thing faster.
 */
export function pinLabel(cluster: Cluster): string {
  if (cluster.isCluster) return String(cluster.stores.length);
  const store = cluster.stores[0]!;
  if (!store.available) return '';
  return store.minPriceVnd === 0 ? '0₫' : formatVnd(store.minPriceVnd);
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  body: {
    minWidth: 34,
    height: PIN_HEIGHT - PIN_TAIL,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodySelected: { transform: [{ scale: 1.12 }] },
  dot: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 2 },
  tail: {
    width: 9,
    height: 9,
    marginTop: -5,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
});
