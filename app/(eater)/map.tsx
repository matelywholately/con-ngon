import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useRouter } from 'expo-router';
import { Countdown } from '@/components/Countdown';
import { DishImage } from '@/components/DishImage';
import { useTabBarClearance } from '@/components/TabBar';
import { useLocation } from '@/features/useLocation';
import { useT } from '@/i18n';
import { formatDistance, formatVnd } from '@/lib/format';
import { fetchNearbyListings } from '@/lib/queries';
import { effectiveDeadline } from '@/lib/safety';
import type { NearbyListing } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

/**
 * expo-maps renders Google Maps on Android and Apple Maps on iOS, each with
 * its own namespace and prop shape. Android is the platform that matters most
 * for this audience, but both are wired up.
 *
 * A pin on its own answers "where" and nothing else — not the price, not how
 * long is left — so the map now carries a card carousel above it. Scrolling
 * the strip is the same decision as scrolling the feed, made against a
 * picture of the walk instead of a list.
 *
 * There is no web branch here on purpose: `expo-maps` is native-only and
 * throws when the browser evaluates its import, so the web build gets its own
 * `map.web.tsx` and never loads this file.
 */
export default function MapScreen() {
  const { colors, dark, shadow } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const location = useLocation();
  const clearance = useTabBarClearance();
  const [listings, setListings] = useState<NearbyListing[]>([]);

  useEffect(() => {
    if (location.loading) return;
    fetchNearbyListings(location.coords)
      .then(setListings)
      .catch(() => setListings([]));
  }, [location.loading, location.coords]);

  const markers = listings.map((listing) => ({
    id: listing.id,
    coordinates: { latitude: listing.restaurant_lat, longitude: listing.restaurant_lng },
    title: listing.title,
    snippet:
      listing.price_vnd === 0 ? t.common.free : formatVnd(listing.price_vnd),
    showCallout: true,
  }));

  const cameraPosition = {
    coordinates: { latitude: location.coords.lat, longitude: location.coords.lng },
    zoom: 14,
  };

  const openListing = (id: string | undefined) => {
    if (id) router.push({ pathname: '/offer/[id]', params: { id } });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.ground }]}>
      {Platform.OS === 'ios' ? (
        <AppleMaps.View
          style={StyleSheet.absoluteFill}
          cameraPosition={cameraPosition}
          markers={markers}
          onMarkerClick={(marker) => openListing(marker.id)}
        />
      ) : (
        <GoogleMaps.View
          style={StyleSheet.absoluteFill}
          cameraPosition={cameraPosition}
          markers={markers}
          colorScheme={dark ? GoogleMaps.MapColorScheme.DARK : GoogleMaps.MapColorScheme.LIGHT}
          onMarkerClick={(marker) => openListing(marker.id)}
        />
      )}

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.strip, { bottom: clearance }]}
        contentContainerStyle={styles.stripContent}
        renderItem={({ item }) => {
          const deadline = effectiveDeadline(
            new Date(item.prepared_at),
            item.handling_class,
            new Date(item.pickup_until),
          );
          const isFree = item.price_vnd === 0;
          return (
            <Pressable
              onPress={() => openListing(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              style={({ pressed }) => [
                styles.card,
                shadow.e3,
                { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <DishImage
                photoUrl={item.photo_url}
                seed={item.id}
                handling={item.handling_class}
                vegetarian={item.is_vegetarian}
                round="md"
                style={styles.thumb}
              />
              <View style={styles.cardBody}>
                <Countdown deadline={deadline} size="sm" />
                <Text style={[type.heading, { color: colors.ink }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[type.small, { color: colors.inkFaint }]} numberOfLines={1}>
                  {formatDistance(item.distance_m)} · {item.restaurant_name}
                </Text>
                <Text
                  style={[
                    type.bodyStrong,
                    styles.price,
                    { color: isFree ? colors.brand : colors.ink },
                  ]}
                >
                  {isFree ? t.common.free : formatVnd(item.price_vnd)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  strip: { position: 'absolute', left: 0, right: 0 },
  stripContent: { gap: space.md, paddingHorizontal: space.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    width: 290,
    padding: space.md,
    borderRadius: radius.lg,
  },
  thumb: { width: 72, height: 72 },
  cardBody: { flex: 1, gap: 2 },
  price: { fontVariant: ['tabular-nums'] },
});
