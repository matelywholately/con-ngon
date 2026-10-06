# Bữa Kịp — submission preparation

This is an implementation package, not a published Mini App. On 2026-10-06 the
production client compiled at 0.378 MB (377,912 uncompressed bytes).
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

## Live backend approval

The connected Supabase project is `euvndmdcfijjpfofpvjz` (`con-ngon`, Singapore).
Its September migration history differs from this checkout after 0004. Keep
its free-meal priority function, favourites, nearby-stores API, venue type and
push-token table. The prepared migration uses the existing priority helper
when present, and does not delete these features or reseed the database.

Automatic approval review rejected the first live lifecycle migration attempt
because it changes production schema/functions/policies and required specific
authorization. No migration was applied by that rejected call. Approval for
the following tested changes was requested:

| Source | Effect |
| --- | --- |
| `0005_reservation_lifecycle.sql` | Retry IDs, atomic credit debit/refund, safe pickup, server-owned account/restaurant fields, owner-only order read model |
| `0006_backfill_profiles.sql` | Add missing profiles without changing existing roles or balances |
| `0007_pickup_qr.sql` | Exact restaurant/order/code handover and restaurant ID on owner pickup passes |
| `0008_zalo_auth.sql` | Service-only per-token login budget, no raw tokens stored |
| `0009_postgis_permissions.sql` | Restrict public writes to PostGIS reference data |

The `zalo-auth` Edge Function is deployed as version 1 and is ACTIVE. Live
checks confirmed a 204 Zalo CORS preflight, a 403 response to an untrusted
origin, and a 503 `not_configured` response without the parent Zalo app
credentials. No login session was issued. The database migrations above remain
unapplied pending approval.

After approval, deploy those migrations and verify the live schema/access
rules, then configure the parent Zalo app secrets in Supabase. The public API
key is already configured locally. Secrets must not be sent in chat or placed
in the Mini App bundle.
