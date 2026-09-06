import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import type { Cluster } from '@/lib/cluster';
import type { Camera } from '@/lib/cluster';
import type { Coords } from '@/lib/geo';
import { pinLabel } from './StorePin';
import { useTheme } from '@/theme';

/**
 * The basemap, and nothing else.
 *
 * Everything a person actually reads — the carousel, the sort chips, the
 * "search this area" button — is plain React Native drawn on top by the map
 * screen. This component's only job is to render a map with pins on it and
 * report what was tapped, which is what lets one screen file serve both a
 * real Google/Apple map on a phone and the schematic in `MapCanvas.web.tsx`.
 *
 * `expo-maps` is native-only: `expo-module.config.json` declares
 * `["apple", "android"]` and there is no web implementation, so importing it
 * in a browser throws at module scope before any runtime check can catch it.
 * That is why the split is a `.web.tsx` sibling rather than a `Platform.OS`
 * branch — Metro resolves the platform file and this import never reaches the
 * browser at all.
 *
 * It also means this file needs a **development build**. It does not run in
 * Expo Go.
 */

export type MapCanvasHandle = {
  /** Move the camera, animating where the platform supports it. */
  moveTo: (camera: Camera) => void;
  /** Focus a pin by cluster id, without necessarily moving the camera. */
  select: (id: string | undefined, options?: { zoom?: number }) => void;
};

export type MapCanvasProps = {
  /** Where the camera starts. Later moves go through the ref, not this prop. */
  camera: Camera;
  clusters: readonly Cluster[];
  selectedId: string | null;
  onSelect: (cluster: Cluster) => void;
  onCameraMove?: (camera: Camera & { latitudeDelta: number; longitudeDelta: number }) => void;
  /** The user's own position, when they have granted it. */
  userLocation?: Coords | null;
  /**
   * Space at the bottom covered by the carousel, so the platform's own
   * furniture — the Google logo, the legal notice — is not hidden under it.
   */
  bottomInset?: number;
  /**
   * Ignored on native — the platform maps have no controls of ours to hide —
   * but present so the web and native contracts stay identical.
   */
  interactive?: boolean;
};

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  { camera, clusters, selectedId, onSelect, onCameraMove, userLocation, bottomInset = 0 },
  ref,
) {
  const { colors, dark } = useTheme();
  const googleRef = useRef<GoogleMaps.MapView>(null);
  const appleRef = useRef<AppleMaps.MapView>(null);

  useImperativeHandle(ref, () => ({
    moveTo(next) {
      const position = {
        coordinates: { latitude: next.centre.lat, longitude: next.centre.lng },
        zoom: next.zoom,
      };
      googleRef.current?.setCameraPosition({ ...position, duration: 350 });
      appleRef.current?.setCameraPosition(position);
    },
    select(id, options) {
      void googleRef.current?.selectMarker(id, options);
      appleRef.current?.selectAnnotation(id, options);
    },
  }));

  const cameraPosition = {
    coordinates: { latitude: camera.centre.lat, longitude: camera.centre.lng },
    zoom: camera.zoom,
  };

  const byId = new Map(clusters.map((c) => [c.id, c]));
  const handleSelect = (id: string | undefined) => {
    const cluster = id ? byId.get(id) : undefined;
    if (cluster) onSelect(cluster);
  };

  const emitCamera = (event: {
    coordinates: { latitude?: number; longitude?: number };
    zoom: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => {
    const { latitude, longitude } = event.coordinates;
    if (latitude === undefined || longitude === undefined) return;
    onCameraMove?.({
      centre: { lat: latitude, lng: longitude },
      zoom: event.zoom,
      latitudeDelta: event.latitudeDelta,
      longitudeDelta: event.longitudeDelta,
    });
  };

  if (Platform.OS === 'ios') {
    /**
     * Apple's plain `Marker` takes no colour, but an `Annotation` takes a
     * background, a text colour and a label — which is the only way to get
     * Too Good To Go's green-available / grey-sold-out pin on iOS.
     */
    const annotations = clusters.map((cluster) => ({
      id: cluster.id,
      coordinates: { latitude: cluster.coords.lat, longitude: cluster.coords.lng },
      title: titleFor(cluster),
      text: pinLabel(cluster),
      backgroundColor: cluster.available ? colors.brand : colors.inkFaint,
      textColor: colors.onBrand,
    }));

    return (
      <AppleMaps.View
        ref={appleRef}
        style={StyleSheet.absoluteFill}
        cameraPosition={cameraPosition}
        annotations={annotations}
        colorScheme={dark ? AppleMaps.MapColorScheme.DARK : AppleMaps.MapColorScheme.LIGHT}
        properties={{
          isMyLocationEnabled: Boolean(userLocation),
          selectionEnabled: false,
        }}
        uiSettings={{ myLocationButtonEnabled: false, compassEnabled: false }}
        onAnnotationClick={(annotation) => handleSelect(annotation.id)}
        onCameraMove={emitCamera}
      />
    );
  }

  if (Platform.OS === 'android') {
    const markers = clusters.map((cluster) => ({
      id: cluster.id,
      coordinates: { latitude: cluster.coords.lat, longitude: cluster.coords.lng },
      title: titleFor(cluster),
      snippet: pinLabel(cluster),
      showCallout: false,
      // Selected pins draw over their neighbours rather than under them.
      zIndex: cluster.id === selectedId ? 2 : 1,
    }));

    return (
      <GoogleMaps.View
        ref={googleRef}
        style={StyleSheet.absoluteFill}
        cameraPosition={cameraPosition}
        markers={markers}
        colorScheme={dark ? GoogleMaps.MapColorScheme.DARK : GoogleMaps.MapColorScheme.LIGHT}
        properties={{ isMyLocationEnabled: Boolean(userLocation), selectionEnabled: false }}
        uiSettings={{
          // The screen supplies its own recentre control, positioned where it
          // will not sit under the carousel.
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          mapToolbarEnabled: false,
          compassEnabled: false,
        }}
        contentPadding={{ bottom: bottomInset }}
        onMarkerClick={(marker) => handleSelect(marker.id)}
        onCameraMove={emitCamera}
      />
    );
  }

  // Neither platform: nothing to draw, but never a crash.
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceAlt }]} />;
});

function titleFor(cluster: Cluster): string {
  return cluster.isCluster
    ? cluster.stores.map((s) => s.name).join(', ')
    : cluster.stores[0]!.name;
}
