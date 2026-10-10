# Bữa Kịp Mini App webhook

Webhook URL for the connected Zalo Mini App:

`https://euvndmdcfijjpfofpvjz.supabase.co/functions/v1/zalo-webhook`

Set this in **Còn Ngon → Open APIS → Webhook URL** in the
[Mini App console](https://miniapp.zaloplatforms.com/developers/3804142829431229505/apis).
The receiver is independent of the outbound Graph login route; it does not
require a Vietnam relay server. It does not fix the existing login IP restriction.

## Signing key

In Supabase **Edge Functions → Secrets**, save the **Open API key from that
Zalo Open APIS page** as `ZALO_MINIAPP_API_KEY`. This is a different credential
from the parent developer app secret and from Supabase API keys. Never put it
in the Mini App, a tracked file or chat. The Zalo console currently says the
key appears after the setup fields have been completed. The owner must finish
those fields and save the resulting key in Supabase; no key was generated or
copied by this setup. Do not reset an existing key merely to configure the webhook.

The connected Mini App ID defaults to `4024811304212206084`; set server-side
`ZALO_MINIAPP_ID` only when deploying this receiver for a different Mini App.
`ZALO_APP_ID=3804142829431229505` remains the parent ID used for login.

GET returns `{ "ok": true, "configured": false }` while the Open API key is
missing. POST requires Zalo's `X-ZEvent-Signature`; unsigned requests return
401, and signed-looking requests return 503 until the key is configured.
The Supabase JWT gateway is disabled **only for this signed provider webhook**;
the handler verifies Zalo's signature before writing anything.

## Events and review

The receiver supports the documented independent Mini App event
`user.revoke.consent`. It verifies sorted-field SHA-256 signatures using the
Open API key, checks the exact Mini App ID, validates the user ID/timestamp,
bounds request size and stores only the fields needed for review. Unknown
event types return 422; OA events and payment callbacks use different contracts.

Verified requests go into `public.zalo_webhook_events`, an RLS-protected inbox
accessible only to the service role/administrators. Duplicate deliveries do
not add rows or reset `processed_at`. HTTP 200 means **durably received**, not
that deletion has completed; storage failures return 503 so deliveries can retry.
The receiver logs no bodies, identifiers, signatures or credentials.

Before public release, establish an owner review process for inbox rows with
`processed_at is null`. Verify the Mini App user identity against the actual
account mapping, process the consent/data request, then set `processed_at`.
Mini App user IDs must not be assumed to equal parent Graph user IDs. This
receiver deliberately does not delete accounts, orders or credit history.

Apply `0011_zalo_webhook.sql` once after inspecting the live migration history.
Deploy `index.ts` with `verify_jwt=false`. Run root `npm run check` for signature,
tamper, app-boundary, fail-closed, retry and database-permission coverage.
No client rebuild or ZIP upload is needed for this server-only change.

References:

- [Zalo webhook setup](https://docs.zaloplatforms.com/docs/MA/openApis/open/webhook/intergration-webhook)
- [Consent-withdrawal payload](https://docs.zaloplatforms.com/docs/MA/openApis/open/webhook/eventRevokeAndRemoveUserData)
- [Signature algorithm](https://docs.zaloplatforms.com/docs/MA/openApis/open/webhook/verifysignature)
- [Supabase signed webhook authentication](https://supabase.com/docs/guides/functions/auth#external-webhooks)
