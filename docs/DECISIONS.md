# Decision log

Short records of choices that are expensive to reverse, and why.

## 1. Expo SDK 57, not 56

The product plan said SDK 56. `npm view expo dist-tags` at scaffold time
showed 56 at `56.0.21` and **57.0.20 as `latest`**, and `create-expo-app`
generates an `AGENTS.md` pinned to the v57 docs. For a new project intended
to scale, starting one major behind buys nothing.

## 2. Item-level listings, not surprise bags

Too Good To Go's mystery bag is its most-criticised feature and is repeatedly
tied to weak retention in published UX studies. More importantly it is
useless to the user this app is for: someone who needs to know they will get
a real dinner tonight cannot gamble. Karma's item-level model is the right
one here.

## 3. The safety window is computed, never typed

See the README. The alternative — letting staff type a pickup deadline —
would make the app exactly the "channel for liquidating leftovers" that
Vietnamese press has already warned about. Making it a derived value is what
lets us answer that criticism with a mechanism instead of a promise.

The rule is duplicated between `src/lib/safety.ts` and the SQL schema. That
duplication is deliberate: the client needs it to render countdowns offline,
and the server needs it because the client cannot be trusted. The SQL is
authoritative.

## 4. Reservations go through an RPC, not a table insert

`reserve_listing()` holds a row lock while it checks stock and decrements it.
There is deliberately **no INSERT policy on `orders`** — a direct insert
would let two phones buy the same last portion.

## 5. Cash first in the payment list

A meaningful share of the target users have no bank account. Cash at pickup
and VietQR ship first; MoMo and ZaloPay follow. Ordering the list by what
actually works for the audience rather than by what is most modern.

## 6. One app, two role groups

Eater and partner ship in one binary with role-based routing rather than two
apps. Far faster to build and demo, and splitting them later does not require
touching the backend.

## 7. The app runs without a backend

`hasSupabase` is false when the env vars are unset, and every query falls
back to fixtures. This keeps the UI reviewable before the Supabase project
exists, and keeps screen work unblocked by backend work.

## 8. Vietnamese is the source language

`src/i18n/vi.ts` is authored first and `en.ts` is typed against its shape, so
English can never silently drift. This is the opposite of the usual
English-source setup, and it is the right way round for this audience.
