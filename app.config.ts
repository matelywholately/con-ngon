import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic app config.
 *
 * `app.json` stays the static base and this file overrides the handful of
 * values that come from the environment. Expo passes the parsed JSON in as
 * `config`, so this is a narrow patch rather than a second copy of the whole
 * thing.
 *
 * It exists because a plain `app.json` does **no** environment substitution.
 * The Maps key used to be written there as the literal string
 * `"$GOOGLE_MAPS_ANDROID_KEY"`, which looks like interpolation and is not —
 * `@expo/config` resolved it to those 24 characters verbatim, whether or not
 * the variable was set. That string would then be written into
 * `AndroidManifest.xml` as `com.google.android.geo.API_KEY`, and Google Maps
 * would refuse to draw: pins floating over a blank grey grid, with the real
 * cause only visible in logcat. It survived this long because the map had only
 * ever been run on web, where the schematic canvas needs no key at all.
 *
 * `tests/config.test.mts` pins the resolved value so it cannot come back.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  // `name` and `slug` are required by the type but always come from app.json.
  name: config.name ?? 'Còn Ngon',
  slug: config.slug ?? 'con-ngon',
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        /**
         * Android only — iOS draws Apple Maps through the same `expo-maps`
         * component and needs no key. Undefined when unset rather than an
         * empty string: an absent key makes the manifest merger complain
         * loudly at build time, which is the failure we want.
         */
        apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY,
      },
    },
  },
});
