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

## 9. A prepared-time bucket is read at its worst case

Staff never know that the tray came off the heat at 18:47; they know "about
an hour ago". So the question is asked as a range, and `preparedAtFromBucket`
takes the **top** of that range. "1 – 2 giờ" counts as 120 minutes elapsed,
not 60.

Reading it the other way handed out up to an extra hour of safe life on food
that has three hours in total. The person eating carries that error and has
no way to check it, while the partner giving the estimate has every incentive
to understate it. Taking the pessimistic end costs the partner some sellable
stock and costs the eater nothing.

The consequence is intended: the oldest bucket leaves `hot` food no window at
all, so three-hour-old rice cannot be listed. `validateListing` rejects it and
the form says why before the rest of it is filled in.

This does not close the underlying hole. `prepared_at` is still self-reported
by the party with the incentive to understate it, and the app still cannot
tell truth from a consistent story — it verifies consistency, not truth. What
changed is that an honest partner's uncertainty now resolves in the eater's
favour instead of against them.

## 10. Free to both sides first, fees later

There is no fee, commission or payout anywhere in the schema, and that is a
decision rather than an omission. Neither side of a marketplace joins for a
product with no liquidity, and charging before there is any guarantees there
never is.

The thing to know before revisiting it: **cash-first means the money never
touches the platform's rails.** Adding a percentage later is not a schema
change, it is a collection problem — either payments move on-platform, or a
fee becomes a monthly invoice that a street vendor can simply not pay. That
is a product conversation, not a migration, and the longer the cash habit
sets the harder it gets. Worth deciding before the pilot ends, not after.

## 11. Venue type is recorded, and not defaulted

`restaurants.venue_type` exists to test the product's riskiest assumption:
that the surplus exists in the form this app expects. Much Vietnamese eating
out is cooked to order, and a kitchen that cooks to order has very little at
closing but a half-used mise en place. The batch surplus this model needs
lives in cơm bình dân trays, bakeries, buffets, canteens and convenience
hot counters — different businesses, possibly a different sales conversation.

The column is nullable with no default. A default of `'restaurant'` would
manufacture evidence for the assumption under test; an unclassified venue
should read as a gap, because that is what it is.

This does not answer the question. It makes it answerable: "which venue types
list, and which of those listings get collected" becomes a query rather than
an impression. If the answer is that only trays and bakeries work, that is
worth knowing before more code, and it changes who the app is sold to.

## 12. Following is the liquidity mechanism, not a convenience

Surplus cannot be warehoused. A listing lives one to three hours, is only
useful inside a walking radius, and needs both sides present at the same
moment. A marketplace discoverable only by someone who happens to open the
app in that window will miss most of its own inventory.

`favourites` inverts it: the eater says once which kitchens are on their way
home, and the app comes to them. That is the cheapest supply-side win
available — it makes existing listings findable without needing more of them.

Following and being interrupted are stored as separate consents (`notify`),
because a shortlist and a phone that buzzes every evening are different
things, and treating the second as implied by the first is how an app gets
muted.

The judgement of *what* is worth sending lives in `src/lib/alerts.ts` and is
pure and tested — quiet hours, never twice for one listing, nothing that
cannot be walked to in the time it has left, and a cap so a canteen listing
eight trays does not send eight buzzes. Only the sending needs credentials,
behind `AlertSender`. That split is deliberate: the judgement is the part
that fails in ways nobody notices, so it is the part with tests.

## 13. The nominal-sale structure is an open legal question

Transfers are structured as sales at a nominal price rather than donations,
because Vietnam has no Good Samaritan statute shielding food donors, and a
donation with no consideration sits in a less certain place than a sale.

That reasoning may be backwards. A seller generally carries *more* implied
duty as to merchantability and fitness than a donor does, so structuring the
transfer as a sale to avoid donor liability may import a heavier duty than it
avoids. The free track — `price_vnd = 0` — makes it sharper still: a sale at
zero is arguably not a sale at all, which would leave those transfers in the
donation regime the structure was designed to avoid, without the protections
a deliberate donation programme would have been built around.

**This is not resolvable in code, and nothing here should be read as legal
advice.** It needs a Vietnamese lawyer, and the question to put to them is
"does structuring these as nominal sales help or hurt our exposure compared
with structuring them as donations, and does the zero-price case change the
answer?" — not "please review our terms". The structure is currently assumed
throughout `reserve_listing` and the payment enum, so changing it later is a
schema and copy change, not a switch. Worth asking before the pilot.
