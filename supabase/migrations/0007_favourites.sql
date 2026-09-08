-- Following a restaurant, and asking to be told when it lists.
--
-- This is the answer to the liquidity problem, not a convenience feature.
-- Surplus food cannot be warehoused: a listing lives one to three hours, it
-- is only useful inside a walking radius, and both sides have to be present
-- at the same moment for anything to happen. A marketplace that can only be
-- discovered by someone who happens to open the app in that window will miss
-- most of its own inventory.
--
-- Following inverts it. The eater says once which kitchens are on their way
-- home, and the app comes to them when those kitchens have something. That is
-- how the same problem is solved elsewhere in this category, and it is the
-- cheapest supply-side win available: it makes a listing findable without
-- needing more listings.

create table favourites (
  profile_id    uuid not null references profiles    on delete cascade,
  restaurant_id uuid not null references restaurants on delete cascade,
  -- Following and being interrupted are different consents. Someone may want
  -- a shortlist without a phone that buzzes at 20:00 every evening, and
  -- taking the second as implied by the first is how an app gets muted.
  notify        boolean     not null default true,
  created_at    timestamptz not null default now(),
  primary key (profile_id, restaurant_id)
);

create index favourites_restaurant_idx on favourites (restaurant_id) where notify;

alter table favourites enable row level security;

-- A favourite is private. It says where someone eats and when they are short
-- of money, which is not the marketplace's business to publish.
create policy "read own favourites" on favourites
  for select using (profile_id = auth.uid());

create policy "insert own favourites" on favourites
  for insert with check (profile_id = auth.uid());

create policy "update own favourites" on favourites
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "delete own favourites" on favourites
  for delete using (profile_id = auth.uid());

-- ------------------------------------------------------------ push tokens
-- Deliberately separate from `profiles`: one person may carry two handsets,
-- and a token is a device fact with its own lifetime. Nothing sends from
-- these yet — see src/lib/alerts.ts for the seam that will.
create table push_tokens (
  token       text primary key,
  profile_id  uuid not null references profiles on delete cascade,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_tokens_profile_idx on push_tokens (profile_id);

alter table push_tokens enable row level security;

create policy "read own push tokens" on push_tokens
  for select using (profile_id = auth.uid());

create policy "insert own push tokens" on push_tokens
  for insert with check (profile_id = auth.uid());

create policy "delete own push tokens" on push_tokens
  for delete using (profile_id = auth.uid());
