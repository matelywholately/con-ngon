# Feature assessment and next steps

Assessment of the scaffold at `e1e58fe`, followed by the reservation-lifecycle
implementation in this branch.

| Area | Status after this change | Remaining work |
|---|---|---|
| Reservations | Atomic stock check and decrement; retry request ID prevents duplicate orders | Persist pending request IDs across app restarts; exercise true concurrent clients against hosted Postgres |
| Pickup | Customer QR passes; exact-order staff scanning; manual code fallback; opening and expiry checks; terminal orders hide their passes | Operational resolution for duplicate legacy codes; native camera verification |
| Navigation | Customer header shortcut to pickup passes; active orders separated from history; dedicated `/restaurant` entry and staff workspace | Broader information architecture review as new channels are added |
| Cancellation | Owner-only RPC; portions and charged credits restored exactly once before pickup closes | Restaurant-initiated cancellation and refund policy |
| Support credits | Balance protected from client edits; atomic debit/refund; audit ledger; authorised NGO/admin issuance RPC | NGO verification and issuance console; partner subsidy settlement |
| Payments | Cash and VietQR arranged at pickup; unsupported wallets removed from checkout | Generate VietQR payment requests, reconciliation, MoMo/ZaloPay integrations |
| Listing trust | Dish, handling class and preparation time; computed deadline | Photo capture/upload, allergen input, printed-expiry support, certification workflow |
| Restaurant analytics | Existing summary scaffold | Accurate daily collected revenue, surplus trends and reporting |
| Other planned channels | Native app plus web demo | Zalo Mini App, incident reporting UI and NGO console |

## Reservation and credit behavior

- The amount saved on an order is the restaurant's full listing total. Using
  credit does not change what the restaurant sees at pickup.
- A credit reservation deducts its total and records a negative ledger entry.
  Cancelling before the pickup deadline refunds only credit actually charged.
- Repeating cancellation has no additional effect. Collected orders cannot
  be cancelled. No-shows currently retain the charge; this policy needs to be
  reviewed alongside partner settlement before a pilot.
- An unconfirmed reservation response keeps its request ID and locks its
  portions/payment choices until retried. Retrying can recover an existing
  order even after pickup closes. This protection lasts while checkout is mounted.
- Credit eligibility comes from balances issued by an authorised NGO/admin
  account. Users cannot change their own role or balance.
- An expired order cannot be collected even when the scheduled sweep has
  not run. The server checks wall-clock time after acquiring row locks.
- Existing credit orders have `credit_used_vnd = 0` on upgrade, because the
  scaffold never deducted credits. Cancellation cannot manufacture a refund.
- The demo starts with 100.000₫ of support credit and shares one store across
  customer and restaurant workspaces. Reservations, cancellations and collection
  update both views. Reloading the app resets the demo.

## Applying the backend changes

For an existing database, apply `0005_reservation_lifecycle.sql`,
`0006_backfill_profiles.sql`, and `0007_pickup_qr.sql` in that order.
Deploy the database changes before this client.
Do not rerun old migrations. `0005` keeps the old three-argument reservation
call compatible through a default request-ID argument, but old clients cannot
use unsupported wallets after the migration.

For a fresh database, apply the numbered migrations in order; `0004` is
development seed data only. The bootstrap schema now computes deadlines with
UTC timestamp arithmetic. The original `timestamptz + interval` generated
expression was rejected by Postgres as non-immutable; this correction changes
neither the handling allowances nor stored deadline values.

Configure `expire_listings()` on the existing service-role scheduler. It is
no longer callable by ordinary app users. Grant NGO/admin roles only from a
trusted administrative session. Those accounts can call
`issue_credit(profile_id, amount_vnd, reason)`; no issuance UI is included.

These migrations narrow client write permissions. Roll forward for repairs;
do not restore broad profile/order grants or the old cancellation policy.
Dropping the new credit/request columns after use would destroy audit and
retry information, so there is no destructive down migration.

## Validation scope

`npm run check` typechecks the app and runs the existing safety/format tests,
demo lifecycle tests, and SQL integration tests using PGlite (Postgres/WASM).
The SQL tests execute the real schema, RLS and lifecycle migrations; they
substitute a point column for PostGIS geography and coordinate expressions,
and omit the unchanged nearby-search function. They cover balance protection,
issuance, ledger debits/refunds, idempotency, stock restoration, ownership,
expiry, opening time, code collisions and terminal-state behavior. The 58 tests
also cover QR encoding/decoding, staff access, and exact-order collection when
a four-digit code has been reused. An independent decoder reads the generated
QR matrix in the automated suite.

PGlite has one connection: these tests do not establish behavior under real
multi-connection races. Hosted Supabase/PostGIS, phone OTP and native camera/
maps still need staging/device verification. No production database changes
are applied by this branch.

The web and Android/Hermes exports succeed. Browser checks at a 393×852 viewport verified a
50.000₫ reservation and cancellation restored the 100.000₫ credit balance
and six portions. A subsequent 25.000₫ reservation reduced credit to
75.000₫, appeared in the restaurant view, was collected with its code, and
could not be collected twice. Customer history and the pass then showed
collected status. Web/native map modules are split so the web demo can load
without importing the native ExpoMaps module.

The pickup pass was checked at phone size, and its captured QR image was read
with an independent decoder. The header shortcut reaches active pickup passes;
account settings contain no role switch. `/restaurant/today` remains in the
staff workspace after a browser refresh, with short tab labels that fit the
phone layout. Manual pickup still succeeds from the dedicated staff page.

## Pickup QR and restaurant access

After reservation, the pass shows a local QR image and a four-digit fallback.
The QR contains a version, restaurant ID, order ID, and pickup code; it contains
no customer name, phone number, balance, or payment method. Treat the pass like
the manual pickup code: show it only at the counter. Staff scanning rejects
unrelated QR content and passes for other restaurants. The backend verifies the
exact order/code pair and staff membership before recording collection.

Customers always enter the meal marketplace. Restaurant staff use the
`/restaurant` portal, also linked from the welcome page, and sign in with an
account assigned to their restaurant. The `/restaurant/...` workspace routes
check restaurant membership; there is no client role toggle.
