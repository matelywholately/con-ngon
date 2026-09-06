import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterChip } from '@/components/Chip';
import { MapCanvas } from '@/components/MapCanvas';
import type { MapCanvasHandle } from '@/components/MapCanvas';
import { StoreCard } from '@/components/StoreCard';
import { useTabBarClearance } from '@/components/TabBar';
import { useLocation } from '@/features/useLocation';
import { useT } from '@/i18n';
import { clusterStores, zoomToBreak } from '@/lib/cluster';
import type { Camera, Cluster } from '@/lib/cluster';
import { boundsOf, centreOf, distanceMetres, padBounds, viewportRadiusM, zoomToFit } from '@/lib/geo';
import type { Coords } from '@/lib/geo';
import { fetchNearbyStores } from '@/lib/queries';
import { rankStores, STORE_SORTS } from '@/lib/recommend';
import type { StoreSort } from '@/lib/recommend';
import type { StoreMarker } from '@/lib/stores';
import { radius, space, type, useTheme } from '@/theme';

/**
 * The map tab.
 *
 * Too Good To Go pins *stores*, not individual bags, and colours them by
 * whether anything is left. This screen does the same, and adds the two
 * things its own map is most often criticised for missing: it opens framed on
 * the results rather than at a fixed faraway zoom, and it lets you re-search
 * wherever you have dragged to instead of silently showing stale pins.
 *
 * The basemap itself lives behind `MapCanvas`, which is a real Google or
 * Apple map on a phone and a schematic in the browser. Everything below is
 * ordinary React Native drawn on top, so it is identical on all three.
 */

/** How far the camera must drift before re-searching is worth offering. */
const RESEARCH_THRESHOLD_M = 400;

/** The carousel card width, as a fraction of the screen. */
const CARD_FRACTION = 0.78;

export default function MapScreen() {
  const { colors, shadow } = useTheme();
  const { t, p } = useT();
  const router = useRouter();
  const location = useLocation();
  const clearance = useTabBarClearance();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const mapRef = useRef<MapCanvasHandle>(null);
  const listRef = useRef<FlatList<StoreMarker>>(null);

  const [stores, setStores] = useState<StoreMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<StoreSort>('relevance');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** Where the results were last loaded from. */
  const [origin, setOrigin] = useState<Coords | null>(null);
  /**
   * Where the camera was pointing when those results were last put on screen.
   *
   * Drift is measured from here rather than from `origin`, because framing
   * the camera on the results already moves it away from the person's own
   * location — and offering to re-search an area we have this second finished
   * searching is nonsense the moment the tab opens.
   */
  const [searchedAt, setSearchedAt] = useState<Coords | null>(null);
  /** Where the camera is now, which drifts away from `origin` as you drag. */
  const [camera, setCamera] = useState<Camera | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const cardWidth = Math.round(width * CARD_FRACTION);
  const cardStride = cardWidth + space.md;

  const load = useCallback(
    async (from: Coords, radiusM?: number) => {
      setLoading(true);
      try {
        setStores(await fetchNearbyStores(from, radiusM));
        setOrigin(from);
      } catch {
        setStores([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (location.loading) return;
    void load(location.coords);
  }, [location.loading, location.coords, load]);

  const ranked = useMemo(
    () => rankStores(stores, { now: new Date(), sort }),
    [stores, sort],
  );

  /**
   * Frame the camera on the results the first time they arrive.
   *
   * A fixed zoom is the single most-cited complaint about the reference app's
   * map: it opens so far out that the pins are one blob and you must pinch
   * several times before anything is tappable. Fitting the actual results
   * means the first thing on screen is already the answer.
   */
  useEffect(() => {
    if (camera !== null || ranked.length === 0 || viewport.width === 0) return;
    const bounds = boundsOf(
      ranked.map((s) => ({ lat: s.lat, lng: s.lng })).concat(origin ? [origin] : []),
    );
    if (!bounds) return;
    const padded = padBounds(bounds, 0.25);
    const centre = centreOf(padded);
    setCamera({ centre, zoom: zoomToFit(padded, viewport, { maxZoom: 16 }) });
    setSearchedAt(centre);
  }, [camera, ranked, viewport, origin]);

  const clusters = useMemo(() => {
    if (!camera || viewport.width === 0) return [];
    return clusterStores(ranked, camera, viewport);
  }, [ranked, camera, viewport]);

  /** How far the camera has drifted from the area these results describe. */
  const drift =
    camera && searchedAt ? distanceMetres(searchedAt, camera.centre) : 0;
  const canResearch = drift > RESEARCH_THRESHOLD_M && !loading;

  const openStore = (storeId: string) => {
    router.push({ pathname: '/store/[id]', params: { id: storeId } });
  };

  const selectCluster = (cluster: Cluster) => {
    if (!camera) return;

    // A bubble is a question, not an answer: break it open rather than
    // arbitrarily picking one of the places hiding inside it.
    if (cluster.isCluster) {
      const next = {
        centre: cluster.coords,
        zoom: zoomToBreak(cluster, camera, viewport),
      };
      setCamera(next);
      // Opening a bubble is navigating *inside* the results we already hold,
      // not travelling somewhere new — so it must not offer to re-search the
      // area it just moved to. Only the user's own dragging counts as drift.
      setSearchedAt(next.centre);
      mapRef.current?.moveTo(next);
      return;
    }

    const store = cluster.stores[0]!;
    setSelectedId(cluster.id);
    mapRef.current?.select(cluster.id);
    const index = ranked.findIndex((s) => s.id === store.id);
    if (index >= 0) {
      listRef.current?.scrollToOffset({ offset: index * cardStride, animated: true });
    }
  };

  /** Keep the pin selection in step with whichever card is centred. */
  const onCarouselScroll = (offsetX: number) => {
    const index = Math.round(offsetX / cardStride);
    const store = ranked[index];
    if (!store) return;
    const id = `store:${store.id}`;
    if (id !== selectedId) {
      setSelectedId(id);
      mapRef.current?.select(id, { zoom: camera?.zoom });
    }
  };

  const recentre = () => {
    const next = { centre: location.coords, zoom: camera?.zoom ?? 15 };
    setCamera(next);
    // Going back to where you are is returning to the area these results were
    // loaded for, so it clears the offer to re-search rather than raising it.
    setSearchedAt(origin ?? location.coords);
    mapRef.current?.moveTo(next);
  };

  const researchHere = () => {
    if (!camera) return;
    // The viewport's nearer edge, so the search never claims results from
    // outside what is actually on screen.
    const radiusM = Math.round(viewportRadiusM(camera, viewport));
    setSearchedAt(camera.centre);
    void load(camera.centre, Math.max(400, radiusM));
  };

  const carouselBottom = clearance + space.sm;

  return (
    <View
      style={[styles.root, { backgroundColor: colors.ground }]}
      onLayout={(event) => setViewport(event.nativeEvent.layout)}
    >
      {camera ? (
        <MapCanvas
          ref={mapRef}
          camera={camera}
          clusters={clusters}
          selectedId={selectedId}
          onSelect={selectCluster}
          onCameraMove={(next) => setCamera({ centre: next.centre, zoom: next.zoom })}
          userLocation={location.granted ? location.coords : null}
          bottomInset={carouselBottom + 150}
        />
      ) : null}

      {/* --------------------------------------------------------- sorting */}
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {STORE_SORTS.map((option) => (
            <FilterChip
              key={option}
              label={sortLabel(option, t)}
              icon={SORT_ICONS[option]}
              selected={sort === option}
              onPress={() => {
                setSort(option);
                setSelectedId(null);
                listRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
            />
          ))}
        </ScrollView>
      </View>

      {/* ------------------------------------------- search this area / here */}
      <View style={[styles.floatRow, { top: insets.top + 58 }]} pointerEvents="box-none">
        {canResearch ? (
          <Pressable
            onPress={researchHere}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.researchButton,
              shadow.e2,
              { backgroundColor: colors.brand, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="refresh" size={16} color={colors.onBrand} />
            <Text style={[type.smallStrong, { color: colors.onBrand }]}>
              {t.map.searchThisArea}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={recentre}
        accessibilityRole="button"
        accessibilityLabel={t.map.recentre}
        style={({ pressed }) => [
          styles.recentre,
          shadow.e2,
          {
            bottom: carouselBottom + 158,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={20} color={colors.brand} />
      </Pressable>

      {/* --------------------------------------------------------- carousel */}
      {loading && ranked.length === 0 ? (
        <View style={[styles.status, shadow.e2, { bottom: carouselBottom, backgroundColor: colors.surface }]}>
          <ActivityIndicator color={colors.brand} />
          <Text style={[type.small, { color: colors.inkMuted }]}>{t.map.loading}</Text>
        </View>
      ) : ranked.length === 0 ? (
        <View style={[styles.status, shadow.e2, { bottom: carouselBottom, backgroundColor: colors.surface }]}>
          <Text style={[type.heading, { color: colors.ink }]}>{t.map.emptyTitle}</Text>
          <Text style={[type.small, styles.centred, { color: colors.inkMuted }]}>
            {t.map.emptyBody}
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.count, { bottom: carouselBottom + 158 }]} pointerEvents="none">
            <View style={[styles.countPill, shadow.e1, { backgroundColor: colors.surface }]}>
              <Text style={[type.tiny, { color: colors.inkMuted }]}>
                {p(t.map.storesNearby, ranked.length)}
              </Text>
            </View>
          </View>

          <FlatList
            ref={listRef}
            data={ranked}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardStride}
            decelerationRate="fast"
            style={[styles.carousel, { bottom: carouselBottom }]}
            contentContainerStyle={styles.carouselContent}
            onMomentumScrollEnd={(event) =>
              onCarouselScroll(event.nativeEvent.contentOffset.x)
            }
            renderItem={({ item }) => (
              <StoreCard store={item} width={cardWidth} onPress={() => openStore(item.id)} />
            )}
          />
        </>
      )}
    </View>
  );
}

const SORT_ICONS = {
  relevance: 'star-outline',
  distance: 'map-marker-outline',
  price: 'tag-outline',
  urgency: 'clock-fast',
} as const;

function sortLabel(sort: StoreSort, t: ReturnType<typeof useT>['t']): string {
  switch (sort) {
    case 'relevance':
      return t.map.sortRelevance;
    case 'distance':
      return t.map.sortDistance;
    case 'price':
      return t.map.sortPrice;
    case 'urgency':
      return t.map.sortUrgency;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { position: 'absolute', left: 0, right: 0, top: 0 },
  chipRow: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  floatRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  researchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  recentre: {
    position: 'absolute',
    right: space.lg,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { position: 'absolute', left: space.lg },
  countPill: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  carousel: { position: 'absolute', left: 0, right: 0 },
  carouselContent: { gap: space.md, paddingHorizontal: space.lg },
  status: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: space.sm,
  },
  centred: { textAlign: 'center' },
});
