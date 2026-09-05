import { EmptyState, Screen } from '@/components/Screen';
import { useT } from '@/i18n';

/**
 * The web build of the map tab.
 *
 * `expo-maps` ships native views only — importing it at module scope throws
 * before any render, which took the whole web bundle down rather than
 * degrading to a message. Metro resolves this `.web` file ahead of
 * `map.tsx`, so the native import never reaches the browser at all. Expo
 * Router strips the platform extension, so both files are still one route.
 */
export default function MapWeb() {
  const { t } = useT();
  return (
    <Screen>
      <EmptyState
        icon="map-search-outline"
        title={t.discover.mapUnavailable}
        body={t.discover.mapUnavailableBody}
      />
    </Screen>
  );
}
