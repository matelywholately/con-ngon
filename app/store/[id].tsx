import { useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Tag } from '@/components/Chip';
import { MapCanvas } from '@/components/MapCanvas';
import { OfferCard } from '@/components/OfferCard';
import { EmptyState, Screen, SectionLabel } from '@/components/Screen';
import { useFavourites } from '@/features/useFavourites';
import { useLocation } from '@/features/useLocation';
import { useT } from '@/i18n';
import type { Cluster } from '@/lib/cluster';
import { defaultTravelMode, directionsUrl, TRAVEL_MODES } from '@/lib/directions';
import type { TravelMode } from '@/lib/directions';
import { formatDistance, formatTime, walkMinutes } from '@/lib/format';
import { fetchStore } from '@/lib/queries';
import { storePickupWindow } from '@/lib/stores';
import type { StoreMarker } from '@/lib/stores';
import type { NearbyListing } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

/**
 * One restaurant, and everything it still has today.
 *
 * A map pin now opens this rather than jumping straight into a single meal.
 * That is the whole point of pinning stores: you decide to walk to a *place*,
 * and only then choose between the two trays it has left. It is also where
 * the address and the directions button belong — the map can show you a dot,
 * but getting there is a job for the map app you already trust offline.
 */
export default function StoreScreen() {
  const { colors, shadow } = useTheme();
  const { t, f, p } = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const location = useLocation();
  const { isFollowing, toggle } = useFavourites();

  const [store, setStore] = useState<StoreMarker | null>(null);
  const [listings, setListings] = useState<NearbyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<TravelMode | null>(null);

  useEffect(() => {
    if (location.loading || !id) return;
    let cancelled = false;
    fetchStore(id, location.coords)
      .then((result) => {
        if (cancelled) return;
        setStore(result?.store ?? null);
        setListings(result?.listings ?? []);
      })
      .catch(() => {
        if (!cancelled) setStore(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, location.loading, location.coords]);

  const window = useMemo(
    () => (store ? storePickupWindow(listings, store.id) : null),
    [listings, store],
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  if (!store) {
    return (
      <Screen>
        <EmptyState
          icon="storefront-outline"
          title={t.store.notFoundTitle}
          body={t.store.notFoundBody}
        />
      </Screen>
    );
  }

  // Under a few hundred metres the bike is slower than walking, once you
  // count getting it out and parking it again.
  const travelMode = mode ?? defaultTravelMode(store.distance_m);

  const openDirections = () => {
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    void Linking.openURL(
      directionsUrl(
        { lat: store.lat, lng: store.lng, label: store.name, mode: travelMode },
        platform,
      ),
    );
  };

  /** A one-pin cluster, so the preview reuses the map's own rendering. */
  const previewCluster: Cluster = {
    id: `store:${store.id}`,
    coords: { lat: store.lat, lng: store.lng },
    stores: [store],
    isCluster: false,
    available: store.available,
  };

  const collectable = listings.filter((l) => l.portions_left > 0);

  return (
    <Screen edges={['top']} padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t.common.back}
            style={({ pressed }) => [
              styles.backButton,
              shadow.e1,
              { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.block}>
          <View style={styles.titleRow}>
            <Text style={[type.display, styles.flex, { color: colors.ink }]}>{store.name}</Text>
            {!store.available ? <Tag label={t.map.soldOut} tone="neutral" /> : null}
            {/* Following is how a listing gets found at all: it lives an hour
                or two, so waiting to be discovered wastes most of it. */}
            <Pressable
              onPress={() => void toggle(store.id)}
              accessibilityRole="switch"
              accessibilityState={{ checked: isFollowing(store.id) }}
              accessibilityLabel={
                isFollowing(store.id) ? t.store.unfollow : t.store.follow
              }
              hitSlop={10}
              style={({ pressed }) => [styles.heart, { opacity: pressed ? 0.6 : 1 }]}
            >
              <MaterialCommunityIcons
                name={isFollowing(store.id) ? 'heart' : 'heart-outline'}
                size={26}
                color={isFollowing(store.id) ? colors.brand : colors.inkFaint}
              />
            </Pressable>
          </View>
          {isFollowing(store.id) ? (
            <Text style={[type.small, { color: colors.brandInk }]}>
              {t.store.followingNote}
            </Text>
          ) : null}
          <Text style={[type.body, { color: colors.inkMuted }]}>
            {f(t.store.away, {
              distance: formatDistance(store.distance_m),
              n: walkMinutes(store.distance_m),
            })}
          </Text>
        </View>

        {/* ------------------------------------------------- where it is */}
        <View style={[styles.mapCard, shadow.e2, { backgroundColor: colors.surface }]}>
          <View style={styles.mapWindow}>
            <MapCanvas
              camera={{ centre: { lat: store.lat, lng: store.lng }, zoom: 16 }}
              clusters={[previewCluster]}
              selectedId={previewCluster.id}
              onSelect={() => {}}
              userLocation={location.granted ? location.coords : null}
              interactive={false}
            />
          </View>

          <View style={styles.mapBody}>
            <SectionLabel label={t.store.address} />
            <Text style={[type.body, { color: colors.ink }]}>{store.address}</Text>

            {window ? (
              <>
                <View style={styles.spacer} />
                <SectionLabel label={t.store.pickupWindow} />
                <Text style={[type.body, { color: colors.ink }]}>
                  {f(t.store.pickupWindowValue, {
                    from: formatTime(window.from),
                    until: formatTime(window.until),
                  })}
                </Text>
              </>
            ) : null}

            <View style={styles.modeRow}>
              {TRAVEL_MODES.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setMode(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: option === travelMode }}
                  style={[
                    styles.modeChip,
                    {
                      backgroundColor:
                        option === travelMode ? colors.brandSoft : colors.surfaceSunken,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={MODE_ICONS[option]}
                    size={15}
                    color={option === travelMode ? colors.brandInk : colors.inkFaint}
                  />
                  <Text
                    style={[
                      type.tiny,
                      { color: option === travelMode ? colors.brandInk : colors.inkMuted },
                    ]}
                  >
                    {modeLabel(option, t)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button
              label={t.store.directions}
              icon="directions"
              onPress={openDirections}
              accessibilityHint={store.address}
            />
          </View>
        </View>

        {/* --------------------------------------------- what is still here */}
        <View style={styles.block}>
          <Text style={[type.title, { color: colors.ink }]}>
            {t.store.offersTitle} · {p(t.map.offersHere, collectable.length)}
          </Text>
        </View>

        {collectable.length === 0 ? (
          <View style={styles.block}>
            <EmptyState
              icon="basket-off-outline"
              title={t.store.allGone}
              body={t.store.allGoneBody}
            />
          </View>
        ) : (
          <View style={styles.offers}>
            {collectable.map((listing) => (
              <OfferCard
                key={listing.id}
                listing={listing}
                onPress={() =>
                  router.push({ pathname: '/offer/[id]', params: { id: listing.id } })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const MODE_ICONS = {
  two_wheeler: 'motorbike',
  walking: 'walk',
  driving: 'car-outline',
  transit: 'bus',
} as const;

function modeLabel(mode: TravelMode, t: ReturnType<typeof useT>['t']): string {
  switch (mode) {
    case 'walking':
      return t.store.modeWalking;
    case 'two_wheeler':
      return t.store.modeTwoWheeler;
    case 'driving':
    case 'transit':
      return t.store.modeDriving;
  }
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.xxl, gap: space.lg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { paddingHorizontal: space.lg, paddingTop: space.sm },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { paddingHorizontal: space.lg, gap: space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heart: { padding: space.xs },
  flex: { flex: 1 },
  mapCard: {
    marginHorizontal: space.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  mapWindow: { height: 168 },
  mapBody: { padding: space.lg, gap: space.xs },
  spacer: { height: space.sm },
  modeRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  offers: { paddingHorizontal: space.lg, gap: space.md },
});
