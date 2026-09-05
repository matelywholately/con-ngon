import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChip, RoundButton } from '@/components/Chip';
import { OfferCard } from '@/components/OfferCard';
import { SearchBar } from '@/components/SearchBar';
import { EmptyState, Screen } from '@/components/Screen';
import { useTabBarClearance } from '@/components/TabBar';
import { useLocation } from '@/features/useLocation';
import { useT } from '@/i18n';
import { filterListings, type DiscoverFilter } from '@/lib/discover';
import { fetchNearbyListings } from '@/lib/queries';
import type { NearbyListing } from '@/lib/types';
import { space, type, useTheme } from '@/theme';

export default function Discover() {
  const { colors } = useTheme();
  const { t, f } = useT();
  const router = useRouter();
  const location = useLocation();
  const clearance = useTabBarClearance();

  const [listings, setListings] = useState<NearbyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DiscoverFilter>('all');

  const load = useCallback(async () => {
    try {
      setError(null);
      setListings(await fetchNearbyListings(location.coords));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.common.errorBody);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [location.coords, t.common.errorBody]);

  useEffect(() => {
    if (!location.loading) void load();
  }, [location.loading, load]);

  const visible = useMemo(
    // `new Date()` on every recompute is deliberate: the "closing soon" chip
    // has to be judged against the clock at the moment it is applied, not at
    // the moment the feed happened to load.
    () => filterListings(listings, { query, filter, now: new Date() }),
    [listings, query, filter],
  );

  const chips: { id: DiscoverFilter; label: string; icon: Parameters<typeof FilterChip>[0]['icon'] }[] = [
    { id: 'all', label: t.discover.filterAll, icon: undefined },
    { id: 'closing_soon', label: t.discover.filterClosingSoon, icon: 'clock-fast' },
    { id: 'cheap', label: t.discover.filterCheap, icon: 'tag-outline' },
    { id: 'vegetarian', label: t.discover.filterVegetarian, icon: 'leaf' },
  ];

  const narrowed = query.trim().length > 0 || filter !== 'all';

  if (loading || location.loading) {
    return (
      <Screen>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <View style={styles.masthead}>
        <View style={styles.mastheadText}>
          <Text style={[type.small, { color: colors.inkFaint }]}>
            {t.discover.greeting}
          </Text>
          <View style={styles.locationRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={19}
              color={colors.brand}
            />
            <Text style={[type.titleLg, { color: colors.ink }]} numberOfLines={1}>
              {t.discover.aroundYou}
            </Text>
          </View>
        </View>
        {/* The safety rule is the product's whole argument, so it is reachable
            from the home screen rather than buried in the account tab. */}
        <RoundButton
          icon="shield-check-outline"
          accessibilityLabel={t.safety.title}
          onPress={() => router.push('/safety')}
        />
      </View>

      <SearchBar value={query} onChangeText={setQuery} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {chips.map((chip) => (
          <FilterChip
            key={chip.id}
            label={chip.label}
            icon={chip.icon}
            selected={filter === chip.id}
            onPress={() => setFilter(chip.id)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {!location.granted ? (
              <Card tone="brand" level="none" style={styles.permission}>
                <Text style={[type.bodyStrong, { color: colors.brandInk }]}>
                  {t.discover.locationNeededTitle}
                </Text>
                <Text style={[type.small, { color: colors.brandInk }]}>
                  {t.discover.locationNeededBody}
                </Text>
                <Button
                  label={t.discover.enableLocation}
                  icon="map-marker-outline"
                  size="md"
                  variant="secondary"
                  onPress={() => void location.request()}
                />
              </Card>
            ) : null}
            <Text style={[type.smallStrong, { color: colors.inkMuted }]}>
              {f(t.discover.subtitle, { count: visible.length })}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <OfferCard
            listing={item}
            onPress={() => router.push({ pathname: '/offer/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={error ? 'alert-circle-outline' : narrowed ? 'magnify' : 'food-off-outline'}
            title={
              error
                ? t.common.errorTitle
                : narrowed
                  ? t.discover.noMatchTitle
                  : t.discover.emptyTitle
            }
            body={
              error ?? (narrowed ? t.discover.noMatchBody : t.discover.emptyBody)
            }
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.brand}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  mastheadText: { flexShrink: 1, gap: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  // A horizontal ScrollView in a flex column does not derive its height from
  // its content — without an explicit one it collapses and the feed draws
  // over the chips. 56 = the 40pt chip plus room for its shadow.
  chipScroll: { flexGrow: 0, height: 56, marginHorizontal: -space.lg },
  chipRow: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  listHeader: { gap: space.md, paddingBottom: space.sm },
  permission: { gap: space.sm },
  list: { gap: space.lg, flexGrow: 1 },
});
