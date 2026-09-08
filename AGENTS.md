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
  using it. The priority window is the one thing that is shown, and it marks
  the *listing*: everyone sees the same chip and the same explanation whether
  or not they hold credit, and a blocked user is told why rather than meeting
  a dead button. Never render anything that differs by the viewer's balance.
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
- **A count that changes the wording is a `Countable`.** Vietnamese has one
  form — "1 suất" and "6 suất" are the same word — so `vi.ts` writes a single
  string and marks the key `as Countable`; `en.ts` then answers with
  `{ one, other }`, and the component calls `p(t.offer.portions, n)` rather
  than `f()`. Only mark a key when the count really changes the words:
  "{n} min left" reads the same at 1 and at 40. `tests/i18n.test.mts` pins
  the exact set of countable keys, so a forgotten English plural fails.
- **A prepared-time bucket is read at its worst case.** Staff answer "how
  long ago" as a range, and `preparedAtFromBucket` in `safety.ts` takes the
  top of it — "1 – 2 giờ" is 120 minutes elapsed, not 60. The eater carries
  any error in that estimate and cannot check it, so uncertainty resolves in
  their favour. Never widen a bucket to make more stock listable.
- **`src/lib/alerts.ts` decides what is worth interrupting someone for**, and
  is pure and tested for that reason: quiet hours, never twice for a listing,
  nothing that cannot be walked to in the time it has left, and a cap per
  batch. Only the sending sits behind `AlertSender` and needs credentials.
  Put judgement in the pure module, never in the sender.
- **`src/lib/priority.ts` decides who eats.** A free listing is held for
  credit holders for a window, then opens to everyone so nothing is wasted.
  Like `safety.ts`, the rule is mirrored in SQL —
  `supabase/migrations/0005_free_track_priority.sql` is the authoritative
  copy, because `orders` has no INSERT policy and `reserve_listing` is the
  only way an order can exist. The client copy decides what to *show*; the
  database copy decides what to *allow*. Change one, change both, and update
  `tests/priority.test.mts`.
- **Pure logic stays out of components** so it can be tested under
  `node --test` without a React renderer. In `src/i18n` that split is
  `strings.ts` (interpolation and plural selection, testable) versus
  `index.ts` (the locale store and the hook).
- **RLS on every table, no exceptions.** The app holds the anon key, so
  Row Level Security is the whole authorisation layer.
- Money is integer đồng everywhere. Never a float.
- **Native-only modules get a `.web.tsx` sibling, never a `Platform.OS`
  branch.** A native-only import throws when the browser *evaluates* it, before
  any runtime check can run, which takes down the whole web bundle rather than
  degrading. Metro resolves the platform file first, so the native import never
  reaches the browser at all. `expo-maps` is the case in hand: it may only be
  reached through `src/components/MapCanvas.tsx`, whose `.web.tsx` sibling
  draws a schematic instead.
- **Anything that varies by environment belongs in `app.config.ts`, never in
  `app.json`.** A static `app.json` performs no substitution, so a `"$MY_VAR"`
  written there reaches the native manifest as those literal characters — which
  is how the Google Maps key silently shipped a blank grey map. `app.json` is
  the static base; `app.config.ts` overrides the dynamic keys.
  `tests/config.test.mts` pins the resolved values.
- **The web basemap is a review aid, not a map.** `src/lib/hanoiSchematic.ts`
  is a simplified street plan for design review, and it says so on screen.
  Do not grow it into something that looks authoritative, and never route by it.
- **Geographic maths lives in `src/lib/geo.ts`**, shared by the native and web
  canvases so a pin lands in the same place in a screenshot as on a phone.
- **A pure module imported by a test needs explicit `.ts` extensions on its
  own value imports.** Metro guesses extensions; the Node ESM resolver that
  runs `npm test` does not, so `src/lib/discover.ts` imports `./format.ts`.
  Type-only imports are erased before Node sees them and do not need it.
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
