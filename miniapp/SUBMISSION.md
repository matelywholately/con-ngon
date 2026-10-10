# Bữa Kịp — submission preparation

This is an implementation package, not a published Mini App. Package size is
measured from the built files, including current local asset changes.
Use the generated `release/bua-kip-production-size.json` for the final size.

## App listing draft

- Name: **Bữa Kịp**
- Short description: **Tìm suất ăn còn ngon gần bạn, đặt giữ và lấy bằng mã QR.**
- Longer description: **Bữa Kịp kết nối bạn với những suất ăn đã nấu, chưa dọn
  ra cho khách tại nhà hàng ở Hà Nội. Xem rõ món, giá và khung giờ lấy, đặt
  giữ trong Zalo, rồi đưa mã QR cho nhân viên tại quầy. Thanh toán tiền mặt
  khi nhận hoặc dùng điểm từ chương trình hỗ trợ.**
- Intended category: food/restaurant service; select the matching category
  actually offered by the Mini App console.
- Operating area: selected districts in Hanoi; start with the verified
  restaurant partners actually serving the pilot.

The parent account and Mini App ID are verified. The owner must complete owner
verification and provide actual support contact and approved brand logo/cover. Complete any privacy,
terms or business-document fields required in the console using real business
details. Review the draft privacy/help text before ordinary customers use it.

## Implementation and verification

Customer features: meal list, pickup areas, ingredients/allergens, preparation
and safety deadline, cash/credit reservation, idempotent retries, active/past
orders, header pickup shortcut, QR/manual-code pass, cancellation/refund,
credit balance, Vietnamese/English and privacy/safety pages.

Restaurant features: account entry, approved own-venue selection, meal
publishing with safe retry recovery, today’s listings, reserved orders, Zalo
SDK QR scanning and manual-code handover. Existing RLS/RPCs enforce staff
membership, stock, credit and pickup deadlines; a client cannot assign itself
to a restaurant. An administrator must assign actual verified staff accounts.

Outside this package: map/GPS, native app downloads and online wallet/payment
integrations. No developer role controls
ship in this client. Images are remote HTTPS resources; fonts are system fonts.

Local verification covers database/RLS and pure logic tests, auth verification
and CORS, package size/bootstrap references, owner-scoped pending requests, and
browser posting → credit reservation → handover, QR/cancellation and a
390-pixel mobile viewport. The final root check passes 77 tests; Mini App
check passes 13 tests and its production size checks. Physical-device
Native Storage, scanning and non-admin access remain to be checked. Real
Zalo login is blocked as described below. See [README](README.md).

## Live setup — 2026-10-10

The separate Mini App webhook receiver is
`https://euvndmdcfijjpfofpvjz.supabase.co/functions/v1/zalo-webhook`.
Its service-only inbox migration is applied, and its signature, tamper,
fail-closed and RLS tests pass. It requires `ZALO_MINIAPP_API_KEY` from the
parent app's **Open APIS** page; the console currently reveals that key only
after the setup fields are completed. The key is not configured yet, so POST
events remain disabled. No Zalo settings were saved by this setup. The
receiver durably queues verified consent requests for owner review, without
automatic account deletion. Establish that review process before release.
See [webhook setup](../supabase/functions/zalo-webhook/README.md).

The connected Supabase project is `euvndmdcfijjpfofpvjz` (`con-ngon`, Singapore).
Its September migration history differs from this checkout after 0004. Keep
its free-meal priority function, favourites, nearby-stores API, venue type and
push-token table. The prepared migration uses the existing priority helper
when present, and does not delete these features or reseed the database.

After the owner's instruction to finish setup, the tested lifecycle, profile,
pickup and login-budget changes were applied together as migration
`20261009171753_bua_kip_reservations_pickup_zalo_upgrade`. Existing migration
history was preserved. Live checks confirmed the new columns/RPCs, the auth
profile trigger, service-only login budget, and restricted client writes to
orders and credit balances. The database had no profiles or orders.
The follow-up `bua_kip_rpc_permissions` migration was also applied and its
effective grants verified: customer RPCs require the authenticated role,
trigger helpers reject both client roles, and only the service role can run
the Zalo login budget. Root tests pass with Supabase-style explicit
default function grants enabled in the database fixture.

| Source | Effect |
| --- | --- |
| `0005_reservation_lifecycle.sql` | Retry IDs, atomic credit debit/refund, safe pickup, server-owned account/restaurant fields, owner-only order read model |
| `0006_backfill_profiles.sql` | Add missing profiles without changing existing roles or balances |
| `0007_pickup_qr.sql` | Exact restaurant/order/code handover and restaurant ID on owner pickup passes |
| `0008_zalo_auth.sql` | Service-only per-token login budget, no raw tokens stored |
| `0009_postgis_permissions.sql` | Attempts to restrict PostGIS reference writes; see managed-owner limitation below |
| `0010_rpc_permissions.sql` | Remove explicit anonymous RPC grants and client access to trigger helpers |

The parent Zalo App is **Còn Ngon**, ID `3804142829431229505`, ACTIVE, with
app-secret proof enabled and basic profile permission approved. Its ID and
secret match the encrypted Supabase settings (compared privately by digest).
The verified **Bữa Kịp** Mini App ID is `4024811304212206084`; local `APP_ID`
uses this deployment target. No Zalo secret is in source or the client.

Real phone login attempts returned Zalo code `-501`. The safe function log
at `2026-10-10T05:10:56.526Z` recorded HTTP 200, code -501 and
`ipRestricted=true`. It records no raw provider message, identity or token.
The current Supabase egress route is rejected by Zalo; no session was issued.
The client now reports a server problem instead of incorrectly asking the
user to open Zalo. A prepared optional authenticated HTTPS relay can move
Graph verification to an owner-controlled IP Zalo accepts, while keeping
proof generation and session issuance on Supabase. It is **not hosted or
configured**, and the owner has no Vietnam server yet. A Vietnam host still
requires an actual egress test; do not treat its location as guaranteed access.
See [relay setup](../ops/zalo-relay/README.md). Login is not fixed yet.

Testing **v3** was uploaded securely and verified in the console on
2026-10-10 at 12:12:41. The console reports 0.132 MB compressed; local package
limits use uncompressed assets instead. v3 includes the pickup-area and
restaurant changes. The local ZIP includes current local brand assets.
No public review submission, agreement acceptance or publication was made
by this repair. Verification/category documents must still use the actual
owner's details.

All six approved restaurants currently have district Cầu Giấy; there are no
active meals or staff memberships. The area selector is dynamic and includes
all approved districts when partners are added. Browser restaurant-flow
checks used labelled fixtures, not invented live meals or staff access.

PostGIS limitation: `public.spatial_ref_sys` belongs to `supabase_admin`.
The connected `postgres` role cannot change that owner's grants, so the
attempted revoke in 0009 did not remove the existing anonymous/authenticated
write permissions. The live security advisor still flags this table and the
extension's public schema. Resolve it with Supabase support or a supported
extension-owner operation before release; do not relocate/drop PostGIS and
break existing geography fields. The no-policy notice on
`zalo_login_attempts` is intentional: only the service role may use it.

References:
- [Zalo ownership and F&B verification](https://miniapp.zaloplatforms.com/documents/zalo-mini-app-developer-program-agreement/mini-app-verification/)
- [Supabase exposed-table RLS advisory](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)
