# Bữa Kịp — Zalo Mini App

Production target branch: `codex/zalo-mini-app`. The native Google Play app
has its own `codex/google-play` branch. See [PLATFORMS.md](../PLATFORMS.md)
for the split and [DESIGN.md](DESIGN.md) for the original Bistro-inspired UI.

A small React/Vite client sharing the marketplace's safety rules,
reservation logic and pickup QR format. Account → For restaurants opens the
staff workspace for posting meals, viewing orders and QR/manual-code
handover. This build does not include Expo, maps, custom fonts or online
payment providers. Camera scanning uses the existing Zalo SDK.

## Run and build

From this folder, with Node 22.12+:

```sh
npm ci
npm run dev          # explicitly labelled fixtures; http://127.0.0.1:3000
npm run build:demo   # preview ZIP; cannot pass release checks
npm run check       # production build, package and tests
```

Copy `.env.example` to `.env` and provide the public project URL and public
anon/publishable key. The current connected project is
`https://euvndmdcfijjpfofpvjz.supabase.co`. Local public configuration can also
go in `.env.local`. Keep `APP_ID` in `.env` so Zalo CLI can read it. This is the
**Mini App ID**, not the parent developer App ID. Never put service-role keys,
Zalo secrets, or developer login tokens in a `VITE_` variable or tracked file.

The connected, active parent Zalo App is **Còn Ngon**, ID
`3804142829431229505`. Its verified Mini App is **Bữa Kịp**, ID
`4024811304212206084`; use that Mini App ID as `APP_ID`.

```sh
npm run build
node scripts/release-check.mjs
```

`release/bua-kip-production.zip` contains the built client. The corresponding
size JSON measures every uncompressed file and records SHA-256 hashes. The
build fails above 10,000,000 bytes total or 3,000,000 bytes for any file. The
generated `dist/app-config.json` lists the real CSS and `.module.js` bootstrap
files. Relative asset paths and disabled module preloading support Zalo's
generated HTML and older WebViews.

Release checks reject demos, missing backend configuration, missing Mini App
IDs and altered build files. They verify the local package, not live login or
Zalo approval. The production build removes the demo fixtures. Photos load
over HTTPS; fonts and camera libraries are not embedded in the package.
Labelled original meal illustrations are included only in the demo build and
removed entirely from production.

## Backend and identity

Apply `supabase/migrations/0005_reservation_lifecycle.sql` through
`0010_rpc_permissions.sql`, after the original 0001–0004 schema. Inspect
the live database first: this project's September migrations have different
names after 0004. Do not reapply the seed or overwrite its additional tables.
The lifecycle upgrade preserves an existing `free_track_priority_until`
function and its priority rule when present. It also preserves existing
profile roles and balances. The PostGIS permission migration targets writes
to the extension reference table while preserving coordinate lookups; the
connected project's managed-owner limitation remains in [SUBMISSION.md](SUBMISSION.md).

Deploy `supabase/functions/zalo-auth/index.ts` with `verify_jwt=false` from
`supabase/config.toml`. The function itself verifies a Zalo access token with
Zalo Graph and a server-generated HMAC proof before issuing a Supabase session.
Without that verification it issues no session. Set these **server-side
Supabase Edge Function secrets** in the dashboard:

| Secret | Value |
| --- | --- |
| `ZALO_APP_ID` | Parent Zalo Developer App ID |
| `ZALO_APP_SECRET` | Parent app secret; never share in chat or client files |
| `ZALO_AUTH_EXTRA_ORIGINS` | Optional, explicit test origin; omit in production |
| `ZALO_GRAPH_RELAY_URL` | Optional owner-controlled HTTPS verification endpoint |
| `ZALO_GRAPH_RELAY_KEY` | Required with relay URL; server-only shared credential |

Supabase supplies its normal URL, anon key and service-role environment values
to Edge Functions. The bridge uses a stable app-scoped account identifier;
new Zalo accounts receive the standard zero-credit profile. It never merges
phone accounts or grants credits based on client input. Existing phone-user
account linking requires a separate verified process.

Real phone login currently returns Zalo `-501` with an IP restriction on the
Supabase verification route. The parent credentials were privately compared
and match; basic profile permission is approved. An optional relay is
prepared in [ops/zalo-relay](../ops/zalo-relay/README.md), but no suitable host
or relay settings exist yet. Login remains blocked until the server route
is accepted by Zalo and verified on a phone. Do not disable token verification.

Tokens stay in memory. The SDK's Native Storage saves only the owner-scoped
pending reservation or listing arguments and request ID, before sending the request.
Uncertain responses keep that same ID and choices. Opening again can recover
the pending request after Zalo login. On a device where Native Storage is
unavailable, sending a new reservation fails rather than losing retry safety.
Restaurant posting uses the same owner/venue-scoped retry protection and
retains the original request if the response is uncertain. Restaurant
membership is checked through existing RLS; opening the workspace never
grants a role. An administrator must assign the verified account to its
actual restaurant in `restaurant_staff`. The access screen shows the account
reference to support that assignment; no seed restaurant is assigned automatically.

Pickup areas come from approved restaurant records, with an all-areas option.
There is no fixed three-district list or fabricated distance ranking. At the
2026-10-10 inspection, all six approved restaurants were in Cầu Giấy, there
were no active meals and no staff memberships. More areas appear as approved
partners are added; the client does not invent service coverage.

Browser preview uses memory for both fixtures and pending requests and resets
on reload. It cannot test genuine Zalo login or device storage.

## Publish

Testing **version 3** was uploaded and verified in the Mini App console on
2026-10-10. It contains dynamic pickup areas and the restaurant workspace.
This is not a public release. The lifecycle, pickup and login-budget upgrade
is applied, and the parent credentials are stored in encrypted Supabase
Edge Function secrets. Owner/category verification and public review remain
the owner's responsibility. No agreement or public submission was completed
by this repair. See [SUBMISSION.md](SUBMISSION.md) for the current blockers.

1. Sign in to [Zalo Developers](https://developers.zalo.me/) using your own Zalo
   account, create the parent developer app, and create a Mini App under it.
   Account agreements and owner verification must be completed by the owner.
2. Enter the Mini App ID as `APP_ID` in local `.env`, and configure the parent
   app credentials in Supabase Edge Function secrets. Set the app name to
   **Bữa Kịp**. Prepare the actual owner/contact information, logo, cover,
   category and privacy/support information; do not submit invented details.
3. Run the root `npm run check` and this folder's `npm run check`. Log in to
   the official CLI using `npx zmp login` and scan its QR with your Zalo account.
   Do not commit the resulting `ZMP_TOKEN` or `.env` file.
4. Run `npm run deploy:testing`. The wrapper passes the verified Mini App ID
   and built asset list to `zmp deploy --existing --testing --outputDir dist`,
   then restores the source config. Its Node preload keeps TLS certificate
   verification enabled despite the official CLI's default. This uploads a **Testing** version; it
   does not publish to ordinary users.
5. Test on physical Android and iOS phones in Zalo, including a non-admin
   account. Verify login, Native Storage permission/support, browse, cash
   reservation, credit debit, retry after a connection loss, reopen, QR staff
   handover, cancellation/refund, safety expiry and Vietnamese/English.
   A browser simulator cannot supply real Zalo credentials.
6. Complete Mini App verification and submit the Testing version for Zalo
   review. Publish only the approved version in the Mini App console.

The Mini App uses manual Hanoi pickup areas and requests neither GPS nor
phone/contact access. It uses the standard Zalo identity flow. No role switch
or developer controls appear in a production build. Cash settles at pickup;
credits are support grants, not a wallet or cash-out product.

## References checked 2026-10-06

- [Technical limits, HTTPS, CORS and device testing](https://docs.zaloplatforms.com/docs/MA/intro/getting-started/frequently-solved-issues)
- [React/Vite conversion, root element and asset configuration](https://docs.zaloplatforms.com/docs/MA/intro/getting-started/convert-web-app-to-mini-app)
- [Zalo identity and server proof](https://docs.zaloplatforms.com/docs/MA/intro/best-practices/authen-user)
- [Developer and Mini App accounts](https://docs.zaloplatforms.com/docs/MA/intro/intro/mini-app-account)
- [Verification, review and publishing](https://docs.zaloplatforms.com/docs/MA/intro/public-mini-program)

The official Zalo CLI is a development-only dependency. Its legacy dependency
tree has npm audit findings; it is not included in the deployed client. The
production dependency audit was clean when this package was built.
