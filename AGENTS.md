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

## Commands

```
npm start        # Expo dev server
npm run check    # typecheck + tests — run before committing
npm test         # node --test on the pure modules
npm run typecheck
```

The app runs on fixtures when `EXPO_PUBLIC_SUPABASE_URL` is unset, so every
screen is reachable for design review without a backend.
