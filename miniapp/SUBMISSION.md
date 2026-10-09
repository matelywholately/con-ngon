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

The owner must provide the developer account, Mini App ID, owner verification,
actual support contact, and approved brand logo/cover. Complete any privacy,
terms or business-document fields required in the console using real business
details. Review the draft privacy/help text before ordinary customers use it.

## Implementation and verification

Customer features: meal list, pickup areas, ingredients/allergens, preparation
and safety deadline, cash/credit reservation, idempotent retries, active/past
orders, header pickup shortcut, QR/manual-code pass, cancellation/refund,
credit balance, Vietnamese/English and privacy/safety pages.

Outside this package: map/GPS, restaurant operations, camera scanner, native
app downloads, and online wallet/payment integrations. Staff scan the same QR
format through the existing restaurant workspace. No developer role controls
ship in this client. Images are remote HTTPS resources; fonts are system fonts.

Local verification covers database/RLS and pure logic tests, auth verification
and CORS, package size/bootstrap references, owner-scoped pending requests, and
browser reservations/QR/cancellation. Real Zalo login, Native Storage, app
permissions, staff-device scanning and non-admin access still require the
registered Mini App and physical-device checks. See [README](README.md).

## Live setup — 2026-10-10

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
the Zalo login budget. All 67 root tests passed with Supabase-style explicit
default function grants enabled in the database fixture.

| Source | Effect |
| --- | --- |
| `0005_reservation_lifecycle.sql` | Retry IDs, atomic credit debit/refund, safe pickup, server-owned account/restaurant fields, owner-only order read model |
| `0006_backfill_profiles.sql` | Add missing profiles without changing existing roles or balances |
| `0007_pickup_qr.sql` | Exact restaurant/order/code handover and restaurant ID on owner pickup passes |
| `0008_zalo_auth.sql` | Service-only per-token login budget, no raw tokens stored |
| `0009_postgis_permissions.sql` | Attempts to restrict PostGIS reference writes; see managed-owner limitation below |
| `0010_rpc_permissions.sql` | Remove explicit anonymous RPC grants and client access to trigger helpers |

The `zalo-auth` Edge Function is deployed as version 1 and is ACTIVE. The
parent Zalo App is **Còn Ngon**, ID `3804142829431229505`. Its existing ID and
secret are saved only in encrypted Supabase Edge Function secrets. The public
API key is configured locally. No Zalo secret is in source or the Mini App.
The live endpoint now rejects a fake token with HTTP 401 `invalid_token`,
instead of reporting missing configuration; it returns the expected Zalo
CORS header and issued no session. Real device login remains untested.

At initial inspection the parent app had **zero Mini Apps** and was not
activated. The supplied ID is not a Mini App ID; local `APP_ID` is blank. The Individual creation form was
prepared with Bữa Kịp's name and description, but offers only Other and Life
utilities. Zalo's F&B verification lists business registration and food-safety
documents. The owner asked to keep creation pending until that ownership path
is resolved. Ownership is immutable after creation. No programme agreement,
owner identity submission, Testing upload or publication was completed by
this setup. Later, a management URL for Mini App `4024811304212206084` appeared
in the existing tab, but browser control was detached before its name,
ownership or status could be verified. Inspect that existing instance before
creating another Mini App; do not configure an unverified deployment target.

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
