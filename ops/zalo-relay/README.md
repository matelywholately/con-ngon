# Zalo Graph relay

The phone login attempt on 2026-10-10 returned Zalo error `-501` with an IP
restriction. The parent app credentials match, and basic profile access is
approved. This relay is prepared but **not hosted or configured**. The owner
has no Vietnam server yet. A Vietnam host is a proposed route to test, not a
guarantee that Zalo will accept its IP. Confirm the restriction with Zalo if
the chosen server is also rejected.

The relay runs on an owner-controlled host with an IP Zalo accepts. Supabase
computes the app-secret proof, sends it with the short-lived token to the
relay, and creates a session only after a valid Graph identity response. The
relay contacts only Zalo's fixed HTTPS identity endpoint. It needs neither
the Zalo app secret nor a Supabase service-role key. Treat the relay as an
authentication service: it can observe tokens and is trusted to return the
verified identity. Never use a public proxy or third-party relay endpoint.

## Server setup

1. Provision the owner-controlled host and a domain with valid HTTPS. Use
   Node **22.18+**; no npm dependencies are needed. Copy `handler.ts` and
   `server.mjs` into the same server directory.
2. Generate a random 32-byte key on that host:
   `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Save it privately as `ZALO_GRAPH_RELAY_KEY` in the service environment.
   Do not send it in chat, commit it, or place it in Mini App configuration.
3. Run `node server.mjs` under the host's process manager as a dedicated
   unprivileged user. The service binds only `127.0.0.1:8787`. Restrict access
   to its environment file and disable request header/body logging.
4. Configure the host's HTTPS reverse proxy to forward only `/verify` to
   `http://127.0.0.1:8787/verify`. Set a small request-body limit (for example
   8 KB), preserve the Authorization header, disable request/body logging
   and caching, and keep port 8787 inaccessible from the Internet. An
   unauthenticated POST to the public `/verify` must return HTTP 401.
5. In the existing Supabase project's **Edge Function secrets**, set
   `ZALO_GRAPH_RELAY_URL=https://YOUR-DOMAIN/verify` and the same
   `ZALO_GRAPH_RELAY_KEY`. Keep `ZALO_APP_ID` and `ZALO_APP_SECRET` unchanged.
   Both relay settings are required; partial settings fail closed.
6. Test login inside Zalo on a phone. Inspect only the safe
   `zalo_verification_failed` diagnostics (HTTP status, numeric provider code,
   IP-restriction boolean); do not collect tokens, headers or raw Graph
   messages. Verify an invalid token receives no session and a real account
   receives its own profile. Then check a non-admin Zalo account.

Remove both relay settings to restore direct Graph verification. That route
currently fails for the observed real phone attempt, so removal is rollback,
not a login fix. Relay credential/availability failures return HTTP 503 and
never create accounts or sessions. Rotate the shared key on both services
together if it is exposed.

Tests run from the repository root: `npm run check`. They use fake upstream
responses; actual server egress, TLS, Zalo approval and phone login require
the deployed host. The Mini App ZIP contains none of the relay server files.
