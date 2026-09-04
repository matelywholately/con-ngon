import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useRouter } from 'expo-router';
import { EmptyState, Screen } from '@/components/Screen';
import { useLocation } from '@/features/useLocation';
import { useT } from '@/i18n';
import { formatVnd } from '@/lib/format';
import { fetchNearbyListings } from '@/lib/queries';
import type { NearbyListing } from '@/lib/types';
import { useTheme } from '@/theme';

/**
 * expo-maps renders Google Maps on Android and Apple Maps on iOS, each with
 * its own namespace and prop shape. Android is the platform that matters most
 * for this audience, but both are wired up.
 */
export default function MapScreen() {
  const { colors, dark } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const location = useLocation();
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

  if (Platform.OS === 'web') {
    return (
      <Screen>
        <EmptyState title={t.discover.mapTab} body={t.discover.emptyBody} />
      </Screen>
    );
  }

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
