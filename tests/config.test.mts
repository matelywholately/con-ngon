import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The Google Maps key, asserted on the *resolved* config rather than on the
 * file that declares it.
 *
 * This is the whole point: the key used to sit in `app.json` as the literal
 * string `"$GOOGLE_MAPS_ANDROID_KEY"`, which reads exactly like environment
 * interpolation and is nothing of the kind — a static `app.json` performs no
 * substitution, so those 24 characters went into `AndroidManifest.xml` as the
 * API key and Google Maps quietly refused to draw. Reading the file would have
 * found "a key is configured" and been satisfied. Only resolving the config
 * the way the build does catches it.
 */

const require = createRequire(import.meta.url);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

type ResolvedConfig = { android?: { config?: { googleMaps?: { apiKey?: unknown } } } };

/**
 * Resolve the config under a given environment. `@expo/config` caches nothing
 * across calls, but it does read `process.env` at call time, so the variable is
 * set and restored around each one.
 */
function resolveWith(key: string | undefined): ResolvedConfig {
  const previous = process.env.GOOGLE_MAPS_ANDROID_KEY;
  if (key === undefined) delete process.env.GOOGLE_MAPS_ANDROID_KEY;
  else process.env.GOOGLE_MAPS_ANDROID_KEY = key;
  try {
    const { getConfig } = require('@expo/config') as {
      getConfig: (root: string, options: object) => { exp: ResolvedConfig };
    };
    return getConfig(projectRoot, { skipSDKVersionRequirement: true }).exp;
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_MAPS_ANDROID_KEY;
    else process.env.GOOGLE_MAPS_ANDROID_KEY = previous;
  }
}

const mapsKeyOf = (config: ResolvedConfig) => config.android?.config?.googleMaps?.apiKey;

test('the Android Maps key comes from the environment', () => {
  assert.equal(mapsKeyOf(resolveWith('AIzaSyTESTKEYNOTREAL0123456789')), 'AIzaSyTESTKEYNOTREAL0123456789');
});

test('an unset Maps key resolves to undefined, never a literal placeholder', () => {
  const key = mapsKeyOf(resolveWith(undefined));
  assert.equal(key, undefined);
  // The specific regression: a `$VAR` string reaching the manifest ships an
  // APK whose map is a blank grey grid, and nothing on the way there fails.
  assert.notEqual(key, '$GOOGLE_MAPS_ANDROID_KEY');
});

test('no config file hardcodes a shell-style placeholder as a value', () => {
  const appJson = require(join(projectRoot, 'app.json')) as Record<string, unknown>;
  const serialised = JSON.stringify(appJson);
  assert.ok(
    !/\$[A-Z_]{4,}/.test(serialised),
    'app.json performs no environment substitution — dynamic values belong in app.config.ts',
  );
});

test('the app still identifies as Còn Ngon after the dynamic override', () => {
  // `app.config.ts` spreads `config`, and a spread that dropped `name`/`slug`
  // would rename the app rather than fail, so it is worth one assertion.
  const config = resolveWith('AIzaSyTESTKEYNOTREAL0123456789') as ResolvedConfig & {
    name?: string;
    slug?: string;
    scheme?: string;
  };
  assert.equal(config.name, 'Còn Ngon');
  assert.equal(config.slug, 'con-ngon');
  assert.equal(config.scheme, 'conngon');
});

/**
 * Store-metadata locale files, which Expo copies into *both* platforms.
 *
 * A key at the top level of one of these goes to iOS *and* Android. That is
 * how `CFBundleDisplayName` — a Core Foundation key, meaningless on Android —
 * ended up in `values-b+vi/strings.xml`, where a string with no default-locale
 * counterpart is a fatal `ExtraTranslation` lint error. It failed the release
 * build after forty-four minutes of native compilation, which is an expensive
 * way to find out. Platform-specific values belong under an `ios` or `android`
 * key, and this pins that.
 */
test('locale metadata scopes every value to a platform', () => {
  const config = resolveWith(undefined) as ResolvedConfig & {
    locales?: Record<string, string>;
  };
  const locales = config.locales ?? {};
  assert.ok(Object.keys(locales).length > 0, 'expected localised store metadata');

  for (const [lang, path] of Object.entries(locales)) {
    const contents = require(join(projectRoot, path)) as Record<string, unknown>;
    const stray = Object.keys(contents).filter((k) => k !== 'ios' && k !== 'android');
    assert.deepEqual(
      stray,
      [],
      `${lang} (${path}) puts ${stray.join(', ')} at the top level, so Expo writes it into both platforms`,
    );
  }
});
