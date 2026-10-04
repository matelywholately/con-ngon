import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { OfferCard } from '@/components/OfferCard';
import { EmptyState, Screen, ScreenTitle } from '@/components/Screen';
import { useLocation } from '@/features/useLocation';
import { useT } from '@/i18n';
import { fetchNearbyListings } from '@/lib/queries';
import type { NearbyListing } from '@/lib/types';
import { space, useTheme } from '@/theme';

export default function Discover() {
  const { colors } = useTheme();
  const { t, f } = useT();
  const router = useRouter();
  const location = useLocation();

  const [listings, setListings] = useState<NearbyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useFocusEffect(useCallback(() => {
    if (!location.loading) void load();
  }, [location.loading, load]));

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
      <ScreenTitle
        title={t.discover.title}
        subtitle={f(t.discover.subtitle, { count: listings.length })}
      />

      {!location.granted ? (
        <View style={styles.permission}>
          <Button
            label={t.discover.enableLocation}
            variant="secondary"
            onPress={() => void location.request()}
            accessibilityHint={t.discover.locationNeededBody}
          />
        </View>
      ) : null}

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <OfferCard
            listing={item}
            onPress={() => router.push({ pathname: '/offer/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title={error ? t.common.errorTitle : t.discover.emptyTitle}
            body={error ?? t.discover.emptyBody}
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
  permission: { paddingBottom: space.md },
  list: { gap: space.md, paddingBottom: space.xxl, flexGrow: 1 },
});
