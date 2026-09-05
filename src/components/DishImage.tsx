import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { HandlingClass } from '@/lib/safety';
import { dishTint, overlay, radius, useTheme } from '@/theme';

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * A guess at what the dish looks like, from the two facts we always have.
 *
 * This is only ever used when there is no photograph, so being roughly right
 * is enough — the point is that a listing without a picture still reads as
 * food rather than as a broken image.
 */
function glyphFor(handling: HandlingClass, vegetarian: boolean): Glyph {
  if (handling === 'shelf_stable') return 'package-variant-closed';
  if (handling === 'chilled') return 'ice-cream';
  if (handling === 'ambient') return 'bread-slice';
  return vegetarian ? 'sprout' : 'noodles';
}

/**
 * The photograph, or a designed stand-in for it.
 *
 * The whole feed is now image-led, which makes the no-photo case load
 * bearing rather than cosmetic: a rushed kitchen at closing time will skip
 * the camera, and every fixture in the repo has `photo_url: null`. A grey
 * box would make those listings look broken beside ones that have a picture,
 * so the fallback is a warm gradient tile keyed to the listing id — stable
 * between sessions, and food-coloured rather than UI-coloured.
 */
export function DishImage({
  photoUrl,
  seed,
  handling,
  vegetarian = false,
  round = 'lg',
  scrim = false,
  style,
}: {
  photoUrl: string | null;
  seed: string;
  handling: HandlingClass;
  vegetarian?: boolean;
  round?: keyof typeof radius;
  /** Darken the top edge so chips laid over the image stay legible. */
  scrim?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const tint = dishTint(seed);

  return (
    <View
      style={[
        styles.root,
        { borderRadius: radius[round], backgroundColor: colors.surfaceAlt },
        style,
      ]}
    >
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
        />
      ) : (
        <LinearGradient
          colors={tint}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.centre]}
        >
          <MaterialCommunityIcons
            name={glyphFor(handling, vegetarian)}
            size={52}
            color={overlay.dishGlyph}
          />
        </LinearGradient>
      )}

      {scrim ? (
        <LinearGradient
          colors={[overlay.scrimStrong, overlay.scrimClear]}
          style={styles.scrim}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  centre: { alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
});
