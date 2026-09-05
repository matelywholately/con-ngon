# Còn Ngon

A pickup marketplace connecting Hanoi restaurants' surplus food with people
who need an affordable meal. Expo (React Native) + Supabase.

## Expo HAS CHANGED

This project is on **Expo SDK 57** (React Native 0.86.3, React 19.2.3).
Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/
before writing any code.

If that domain is unreachable, the authoritative local substitutes are:

- `node_modules/expo/bundledNativeModules.json` — the exact SDK-compatible
  version for every Expo/RN package. Use it instead of guessing, and instead
  of `npx expo install` when the Expo API is unreachable.
- The installed packages' own `.d.ts` files, which are ground truth for the
  API surface of that specific version.

## Design system

The visual language follows Too Good To Go's: deep teal (`#00615F`) on a warm
off-white ground (`#F9F3F0`), food photography carrying the page, generous
radii, soft elevation instead of hairline borders, pill controls, and a
floating tab bar.

- **`src/theme/tokens.ts` is the only source of colour, spacing, radius,
  elevation and type.** No hex codes, no magic numbers in a component.
- **Amber belongs to the countdown and nothing else.** Scarcity is the
  emotional core of the product. A discount badge is teal, because "70% off"
  must not rhyme with "18 minutes left". The only other amber is the safety
  guide's per-class figure and the partner's computed deadline, which are the
  same countdown stated as a rule.
- **No charity styling.** A subsidised eater and a paying eater see identical
  screens. The credit is applied at checkout and never appears on the account
  screen or the pass — anything that marks the free track marks the person
  using it.
- **Elevation is `boxShadow`**, one string across iOS, Android and web. It
  needs the New Architecture on Android, which `app.json` enables. Do not
  reintroduce `shadowOpacity`/`elevation` pairs.
- **Every listing must survive having no photograph.** `DishImage` falls back
  to a warm gradient tile keyed to the listing id. Every fixture has
  `photo_url: null`, so this is the path you are actually looking at.
- **The tab bar floats**, so it no longer occupies layout space. Every
  scrolling screen inside a tab navigator must end its content with
  `useTabBarClearance()` padding or the last card sits under the bar.

## Conventions

- **Vietnamese is the source language.** Strings are authored in
  `src/i18n/vi.ts`; `en.ts` is typed against it, so a missing translation is
  a build error. Never hardcode user-facing text in a component.
- **`src/lib/safety.ts` is load-bearing.** It computes pickup deadlines from
  the 2h/4h food safety rule. Its intervals are mirrored in
  `supabase/migrations/0001_schema.sql`; if you change one, change both and
  update `tests/safety.test.mts`.
- **Pure logic stays out of components** so it can be tested under
  `node --test` without a React renderer.
- **RLS on every table, no exceptions.** The app holds the anon key, so
  Row Level Security is the whole authorisation layer.
- Money is integer đồng everywhere. Never a float.
- **A pure module imported by a test needs explicit `.ts` extensions on its
  own value imports.** Metro guesses extensions; the Node ESM resolver that
  runs `npm test` does not, so `src/lib/discover.ts` imports `./format.ts`.
  Type-only imports are erased before Node sees them and do not need it.
- **Native-only modules get a `.web.tsx` sibling, never a `Platform.OS`
  branch.** `expo-maps` throws when the browser evaluates its import, which
  takes down the whole web bundle before any runtime check can run — hence
  `app/(eater)/map.tsx` and `app/(eater)/map.web.tsx`. Expo Router strips the
  platform extension, so the two files stay one route.
- Search is diacritic-insensitive via `foldVi`: someone standing on a
  pavement types "bun cha", not "bún chả".

## Commands

```
npm start        # Expo dev server
npm run check    # typecheck + tests — run before committing
npm test         # node --test on the pure modules
npm run typecheck
```

The app runs on fixtures when `EXPO_PUBLIC_SUPABASE_URL` is unset, so every
screen is reachable for design review without a backend.
