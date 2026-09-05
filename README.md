# Còn Ngon

> *Còn ngon* — "still good to eat."

A pickup marketplace where Hanoi restaurants sell food they cooked but didn't
sell, cheap or free, before it goes in the bin.

Vietnam wastes over 8 million tonnes of food a year — roughly US$3.9bn, close
to 2% of GDP. Hanoi already has excellent food rescue organisations, but they
are all **supply-push**: volunteers collect on a schedule and hand food to a
charity. A restaurant with eight unsold bowls of bún at 21:00 has nobody to
call, and a factory worker who needs dinner at 20:30 has no way to ask. This
app is the missing demand-pull channel between them.

## What makes it different

| | Còn Ngon | Too Good To Go | Karma | Hanoi Food Rescue |
|---|---|---|---|---|
| See the exact dish | ✅ | ❌ mystery bag | ✅ | n/a |
| Free / subsidised tier | ✅ | ❌ | ❌ | ✅ |
| Time-safety enforced in software | ✅ | partial | ❌ | manual |
| Available daily, on demand | ✅ | ✅ | ✅ | ❌ scheduled |
| Operates in Vietnam | ✅ | ❌ | ❌ | ✅ |

Six decisions carry the product:

1. **No mystery bags.** Every listing names the dish, the portions and the
   allergens. Someone spending their last 30.000₫ shouldn't have to gamble.
2. **Two tracks, one storefront.** Paying users buy at 50–70% off; NGO-verified
   users spend credits and pay nothing. The restaurant is paid the same either
   way, and at the counter the two customers look identical.
3. **Time-safety is a database field.** See below — this is the core.
4. **The data goes back to the kitchen.** Restaurants eventually see which
   dishes and weekdays generate their surplus, which turns this from waste
   *redistribution* into waste *reduction*.
5. **Zalo reaches the users.** 98% of Vietnamese mobile users are on Zalo; a
   Mini App (<10MB, no install) is the planned demand-side channel.
6. **Pickup only.** No delivery fleet is exactly why a 15.000₫ meal is
   possible here and impossible on GrabFood.

## The safety model

Vietnamese press has already warned that cheap-food apps could become a
channel for dumping leftovers. That criticism is answered in the schema, not
in a policy page.

A restaurant never types a pickup deadline. It records **when the food was
cooked** and **how it is being held**, and the deadline follows:

| Handling | Danger-zone allowance | Consumer buffer | Usable window |
|---|---|---|---|
| Hot / just cooked | 4h | 1h | **3h** |
| Chilled (≤5°C) | 24h | 2h | **22h** |
| Room temperature | 12h | 1h | **11h** |
| Sealed packaging | 72h | — | **72h** |

Based on the 2-hour/4-hour rule for potentially hazardous food held between
5°C and 60°C. "Cumulative" is the load-bearing word: the clock covers prep,
holding, *and* the customer's journey home — so each class reserves a buffer
for the part of the journey we don't control, and the deadline shown is
always shorter than the real limit.

Staff cannot extend it. The listing stops being purchasable on its own.

This logic lives in two places that must stay in sync:
`src/lib/safety.ts` (client, with tests) and the generated
`listings.safety_deadline` column plus its clamping trigger in
`supabase/migrations/0001_schema.sql` (server, authoritative).

## Stack

- **Expo SDK 57** — React Native 0.86.3, React 19.2.3, New Architecture
- **Expo Router v6** with typed routes; route groups `(auth)`, `(eater)`, `(partner)`
- **TypeScript**, strict, with `noUncheckedIndexedAccess`
- **Supabase** — Postgres 17 + PostGIS, phone OTP auth, RLS on every table
- **expo-maps** (Google Maps on Android, Apple Maps on iOS), expo-camera for
  QR handover, expo-linear-gradient, Be Vietnam Pro for Vietnamese diacritics

## Design

The interface follows Too Good To Go's visual language: deep teal (`#00615F`)
on a warm off-white ground (`#F9F3F0`), an image-led feed, generous radii,
soft elevation in place of hairline borders, pill controls and a floating tab
bar. Everything routes through `src/theme/tokens.ts`.

Two rules constrain the palette, and they are product decisions rather than
taste:

- **Amber belongs to the countdown alone.** Scarcity is what makes the model
  work, so nothing else competes for that colour — a discount badge is teal,
  because "70% off" must not rhyme with "18 minutes left".
- **There is no charity styling.** A subsidised eater and a paying eater see
  identical screens; the credit is applied at checkout and appears on neither
  the account screen nor the pass.

Because a kitchen at closing time will skip the camera, a listing without a
photograph is a first-class case: `DishImage` falls back to a warm gradient
tile keyed to the listing id, so it reads as food rather than a broken image.

## Running it

```bash
npm install
npm start
```

**The app runs without a backend.** With `EXPO_PUBLIC_SUPABASE_URL` unset it
falls back to fixtures in `src/lib/fixtures.ts` and signs you in as a demo
account that is staff at a demo restaurant, so both sides of the marketplace
are reachable for design review.

To connect a real backend:

```bash
cp .env.example .env     # fill in your Supabase URL and anon key
```

Then apply `supabase/migrations/*.sql` in order. `0004_seed_dev.sql` is
development data only.

`expo-maps` and `expo-camera` need a development build — they do not run in
Expo Go.

```bash
npm run check    # typecheck + tests; run before committing
```

## Layout

```
app/                     Expo Router routes
  (auth)/                onboarding, phone OTP
  (eater)/               discover, map, orders, profile
                         map.web.tsx — expo-maps is native-only and throws
                         when a browser evaluates its import
  (partner)/             today, new listing, orders board, handover
  offer/ reserve/ pass/  the eater's purchase flow
  safety.tsx             the food safety guide, linked from every listing
src/
  lib/safety.ts          pickup-deadline computation  ← the core
  lib/discover.ts        feed search and filter rules, pure and tested
  lib/queries.ts         data access; same shape on Supabase or fixtures
  lib/format.ts          VND, distance, countdown, phone, Vietnamese folding
  components/            Card, Chip, Button, Field, SearchBar, Countdown,
                         DishImage, TabBar, Screen, OfferCard
  i18n/                  vi.ts is the source; en.ts is typed against it
  theme/                 design tokens, light and dark
  features/              session, location
supabase/migrations/     schema, RLS, transactional functions, dev seed
tests/                   node --test over the pure modules
```

## Status

Phase 1–2 of the plan: scaffold and core loop. A partner can list surplus in
about 30 seconds and verify a handover; an eater can discover, reserve and
collect. Not yet built: payments beyond cash/VietQR selection, the NGO
console, surplus analytics, and the Zalo Mini App.

**Before any pilot goes live**, two things need real-world work that code
cannot settle: Vietnam has no Good Samaritan food donation law, so the
transfer is structured as a nominal-price *sale* rather than a donation and
this needs a Vietnamese lawyer's review; and partner onboarding needs
food-safety certification checks with spot audits during the pilot.
