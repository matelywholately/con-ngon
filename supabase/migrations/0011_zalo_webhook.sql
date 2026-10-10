-- Verified consent requests await owner review; they never delete marketplace records automatically.
create table public.zalo_webhook_events (
  signature text primary key check (signature ~ '^[a-f0-9]{64}$'),
  app_id text not null check (app_id ~ '^[0-9]{1,30}$'),
  event_name text not null check (event_name = 'user.revoke.consent'),
  user_id text not null check (user_id ~ '^[0-9]{1,30}$'),
  timestamp_ms bigint check (timestamp_ms is null or timestamp_ms > 0),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.zalo_webhook_events enable row level security;
revoke all on public.zalo_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on public.zalo_webhook_events to service_role;
