# Bữa Kịp release branches

| Platform | GitHub branch | Build entry |
| --- | --- | --- |
| Zalo Mini App | [`codex/zalo-mini-app`](https://github.com/matelywholately/con-ngon/tree/codex/zalo-mini-app) | `miniapp/` React/Vite package |
| Google Play / native | [`codex/google-play`](https://github.com/matelywholately/con-ngon/tree/codex/google-play) | Root Expo application |

The Google Play branch starts at the native reservation and QR pickup commit
`b8a7d46fd3dfb0eb70ae8b0ee1676aa30ee86c65`. It keeps customer and restaurant
workspaces and does not contain the Zalo client, SDK, or identity bridge.
It is a development branch, not a signed or published Android release.

The Zalo branch starts at `679e5659c264a7aae54d172c6164fa4a3c9a79d6` and
contains the independent customer Mini App. The Expo source remains available
for shared types, translations, rules, tests and restaurant operations, but
only `miniapp/dist` is packaged for Zalo. Expo and its native dependencies are
not included in the Mini App build.

`codex/reservation-lifecycle` and draft PR #2 retain the earlier integration
work. Use the platform branches for further platform releases. Do not deploy
the integration branch as a third production target.

Keep shared reservation, safety and QR contracts compatible when backporting
changes. Both clients may use the same Supabase project. Coordinate database
migrations once for that project; do not independently replay platform seeds
or replace existing migration history. The prepared live lifecycle upgrades
remain pending explicit deployment approval. Branch creation does not apply
database changes.

## Local verification

On the Zalo branch:

```sh
cd miniapp
npm ci
npm run dev          # labelled fixture preview
npm run check        # production build and package size checks
```

On the Google Play branch:

```sh
npm ci
npm run check
npm run android
```

Configure Android signing and store submission separately when preparing a
Google Play release. For Zalo account setup, open the official
[Mini App console](https://miniapp.zaloplatforms.com/developers), create/select
the parent Zalo app, then create its Mini App. The Mini App ID belongs in
`miniapp/.env` as `APP_ID`; the parent app secret belongs only in Supabase's
server-side secrets. Do not share passwords, secrets or login tokens in chat.
