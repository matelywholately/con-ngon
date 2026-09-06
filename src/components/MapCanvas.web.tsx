import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import type { Cluster, Camera } from '@/lib/cluster';
import type { Coords } from '@/lib/geo';
import { fromScreen, toScreen } from '@/lib/geo';
import {
  CAU_GIAY_PARK,
  NGHIA_TAN_WATER,
  ROAD_WIDTH,
  ROADS,
  TO_LICH,
} from '@/lib/hanoiSchematic';
import { useT } from '@/i18n';
import { PIN_HEIGHT, StorePin } from './StorePin';
import { radius, space, type, useTheme } from '@/theme';

/**
 * The web build's basemap.
 *
 * `expo-maps` is native-only — it declares `["apple", "android"]` and throws
 * when a browser evaluates its import — so this file is what Metro resolves
 * for web, and the native import never reaches the browser. Same props, same
 * ref, so `app/(eater)/map.tsx` is one file for all three platforms.
 *
 * What it draws is a **schematic**, not a map: the arteries of Cầu Giấy from
 * `hanoiSchematic.ts`, projected through the same Web Mercator maths the
 * phone uses, so a pin lands correctly relative to the streets around it.
 * It exists because this repo's rule is that every screen stays reachable for
 * design review without a backend — and because a browser here has no tiles
 * to fetch. On a phone this whole file is replaced by a real Google or Apple
 * map, and the notice in the corner says so rather than letting anyone think
 * this is the shipped experience.
 */

export type MapCanvasHandle = {
  moveTo: (camera: Camera) => void;
  select: (id: string | undefined, options?: { zoom?: number }) => void;
};

export type MapCanvasProps = {
  camera: Camera;
  clusters: readonly Cluster[];
  selectedId: string | null;
  onSelect: (cluster: Cluster) => void;
  onCameraMove?: (camera: Camera & { latitudeDelta: number; longitudeDelta: number }) => void;
  userLocation?: Coords | null;
  bottomInset?: number;
  /**
   * False for the small preview on the store page, which is a picture of
   * where the place is rather than something to navigate around.
   */
  interactive?: boolean;
};

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  { camera, clusters, selectedId, onSelect, onCameraMove, userLocation, interactive = true },
  ref,
) {
  const { colors, dark, shadow } = useTheme();
  const { t } = useT();
  const [view, setView] = useState({ width: 0, height: 0 });
  const [live, setLive] = useState<Camera>(camera);

  // The pan handler reads the camera through a ref: it is created once, and a
  // stale closure would make the map snap back to where it started on the
  // second drag.
  const liveRef = useRef(live);
  liveRef.current = live;
  const viewRef = useRef(view);
  viewRef.current = view;

  const emit = (next: Camera) => {
    const { width, height } = viewRef.current;
    if (width === 0 || height === 0) return;
    const nw = fromScreen({ x: 0, y: 0 }, next, { width, height });
    const se = fromScreen({ x: width, y: height }, next, { width, height });
    onCameraMove?.({
      ...next,
      latitudeDelta: Math.abs(nw.lat - se.lat),
      longitudeDelta: Math.abs(se.lng - nw.lng),
    });
  };

  useImperativeHandle(ref, () => ({
    moveTo(next) {
      setLive(next);
      liveRef.current = next;
      emit(next);
    },
    select() {
      // Selection is drawn from the `selectedId` prop; there is no native
      // callout to open, so there is nothing imperative to do here.
    },
  }));

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
        onPanResponderMove: (_event, gesture) => {
          const { width, height } = viewRef.current;
          if (width === 0) return;
          const current = liveRef.current;
          // Dragging moves the ground under a fixed camera, so the centre
          // travels the opposite way to the finger.
          const centre = fromScreen(
            { x: width / 2 - gesture.dx, y: height / 2 - gesture.dy },
            current,
            { width, height },
          );
          const next = { centre, zoom: current.zoom };
          liveRef.current = next;
          setLive(next);
        },
        onPanResponderRelease: () => emit(liveRef.current),
      }),
    [],
  );

  const zoomBy = (delta: number) => {
    const next = {
      centre: liveRef.current.centre,
      zoom: Math.max(11, Math.min(18, liveRef.current.zoom + delta)),
    };
    liveRef.current = next;
    setLive(next);
    emit(next);
  };

  const project = (coords: Coords) => toScreen(coords, live, view);
  const pathFor = (points: readonly Coords[]) =>
    points
      .map((p, i) => {
        const { x, y } = project(p);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  const polygonFor = (points: readonly Coords[]) =>
    points
      .map((p) => {
        const { x, y } = project(p);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  /**
   * Road widths are authored at zoom 15. Scaling them linearly with the
   * camera is what a naive projection does and it looks wrong: four zoom
   * levels out, a seven-pixel artery becomes four tenths of a pixel and the
   * whole plan vanishes, which is exactly what happened here. Real maps
   * generalise instead — roads thin far more slowly than the ground shrinks —
   * so the exponent is damped and the result is floored at something still
   * visible.
   */
  const roadScale = Math.max(
    0.5,
    Math.min(2.4, 2 ** ((live.zoom - 15) * 0.55)),
  );
  // Deliberately not from `colors`: a basemap is its own palette, and the
  // theme's surface tokens are tuned for cards sitting on a ground rather
  // than for roads that have to stay legible against one. In dark mode the
  // roads need far more separation from the ground than a surface token
  // gives — at the theme's own contrast they disappear entirely.
  const water = dark ? '#1B3D45' : '#CFE3E6';
  const green = dark ? '#22402F' : '#D8E8D5';
  const block = dark ? '#1B1917' : '#EFE7E2';
  const road = dark ? '#463F3A' : '#FFFFFF';
  const roadEdge = dark ? '#2B2724' : '#E7DCD5';

  return (
    <View
      style={[styles.root, { backgroundColor: block }]}
      onLayout={(event) => setView(event.nativeEvent.layout)}
      {...(interactive ? pan.panHandlers : {})}
    >
      {view.width > 0 ? (
        <Svg width={view.width} height={view.height}>
          <Polygon points={polygonFor(CAU_GIAY_PARK)} fill={green} />
          <Polygon points={polygonFor(NGHIA_TAN_WATER)} fill={water} />
          <Path
            d={pathFor(TO_LICH)}
            stroke={water}
            strokeWidth={13 * roadScale}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Casings first, then the road fill on top: the standard two-pass
              trick that makes junctions read as junctions. */}
          {ROADS.map((r) => (
            <Path
              key={`casing-${r.name}`}
              d={pathFor(r.path)}
              stroke={roadEdge}
              strokeWidth={(ROAD_WIDTH[r.cls] + 2) * roadScale}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {ROADS.map((r) => (
            <Path
              key={r.name}
              d={pathFor(r.path)}
              stroke={road}
              strokeWidth={ROAD_WIDTH[r.cls] * roadScale}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {userLocation ? (
            <>
              <Circle
                cx={project(userLocation).x}
                cy={project(userLocation).y}
                r={18}
                fill={colors.brand}
                opacity={0.16}
              />
              <Circle
                cx={project(userLocation).x}
                cy={project(userLocation).y}
                r={6}
                fill={colors.brand}
                stroke={colors.surface}
                strokeWidth={2.5}
              />
            </>
          ) : null}
        </Svg>
      ) : null}

      {view.width > 0
        ? clusters.map((cluster) => {
            const { x, y } = project(cluster.coords);
            if (x < -60 || y < -60 || x > view.width + 60 || y > view.height + 60) {
              return null;
            }
            return (
              <Pressable
                key={cluster.id}
                onPress={() => onSelect(cluster)}
                accessibilityRole="button"
                accessibilityLabel={cluster.stores.map((s) => s.name).join(', ')}
                accessibilityState={{ selected: cluster.id === selectedId }}
                style={[
                  styles.pin,
                  {
                    left: x - 24,
                    top: y - PIN_HEIGHT,
                    zIndex: cluster.id === selectedId ? 3 : cluster.available ? 2 : 1,
                  },
                ]}
              >
                <StorePin cluster={cluster} selected={cluster.id === selectedId} />
              </Pressable>
            );
          })
        : null}

      {interactive ? (
        <View style={styles.zoomStack}>
          <ZoomButton label="+" onPress={() => zoomBy(1)} />
          <ZoomButton label="−" onPress={() => zoomBy(-1)} />
        </View>
      ) : null}

      {/* Nobody should mistake this for the shipped map. */}
      <View style={[styles.notice, shadow.e1, { backgroundColor: colors.surface }]}>
        <Text style={[type.tiny, { color: colors.inkFaint }]} numberOfLines={2}>
          {t.map.schematicNotice}
        </Text>
      </View>
    </View>
  );
});

function ZoomButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, shadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.zoomButton,
        shadow.e1,
        { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[type.title, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  pin: { position: 'absolute', width: 48, alignItems: 'center' },
  zoomStack: { position: 'absolute', right: space.lg, top: 116, gap: space.sm },
  zoomButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    position: 'absolute',
    left: space.lg,
    bottom: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    maxWidth: 260,
  },
});
