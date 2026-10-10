-- Còn Ngon — core schema.
--
-- Design notes that matter:
--   * `listings.safety_deadline` is GENERATED. Partner staff supply the time
--     the food was cooked and how it is held; the deadline follows from that
--     and cannot be typed, edited or extended by anyone.
--   * The interval table below mirrors HANDLING_RULES in src/lib/safety.ts
--     (maxDangerZoneMinutes - consumerBufferMinutes). The two must move
--     together; tests/safety.test.mts documents the intended values.
--   * Money is integer đồng. There are no fractional đồng in circulation and
--     floats have no business in a payment path.

create extension if not exists postgis;
create extension if not exists pgcrypto;

create type user_role as enum ('eater', 'partner_staff', 'ngo', 'admin');
create type handling_class as enum ('hot', 'chilled', 'ambient', 'shelf_stable');
create type listing_status as enum ('draft', 'live', 'sold_out', 'expired', 'withdrawn');
create type order_status as enum ('reserved', 'collected', 'no_show', 'cancelled', 'incident');
create type payment_method as enum ('cash', 'vietqr', 'momo', 'zalopay', 'credit');
create type restaurant_status as enum ('pending', 'approved', 'suspended');

-- ---------------------------------------------------------------- profiles
create table profiles (
  id                 uuid primary key references auth.users on delete cascade,
  full_name          text,
  phone              text,
  role               user_role   not null default 'eater',
  locale             text        not null default 'vi' check (locale in ('vi', 'en')),
  -- Subsidy balance. Held here for fast reads; credit_ledger is the truth.
  credit_balance_vnd integer     not null default 0 check (credit_balance_vnd >= 0),
  created_at         timestamptz not null default now()
);

-- ------------------------------------------------------------- restaurants
create table restaurants (
  id                    uuid primary key default gen_random_uuid(),
  name                  text  not null,
  address               text  not null,
  district              text  not null,
  phone                 text,
  location              geography(Point, 4326) not null,
  status                restaurant_status not null default 'pending',
  pickup_instructions   text,
  business_licence_url  text,
  food_safety_cert_url  text,
  created_at            timestamptz not null default now()
);

-- GiST index is what makes the "what is edible within 1.2km of me" query fast.
create index restaurants_location_idx on restaurants using gist (location);
create index restaurants_status_idx on restaurants (status);

create table restaurant_staff (
  restaurant_id uuid not null references restaurants on delete cascade,
  profile_id    uuid not null references profiles on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (restaurant_id, profile_id)
);

create index restaurant_staff_profile_idx on restaurant_staff (profile_id);

-- ---------------------------------------------------------------- listings
create table listings (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid not null references restaurants on delete cascade,
  title              text not null check (length(btrim(title)) > 0),
  description        text,
  -- Required in the client flow: a real, timestamped photo is the whole
  -- trust argument. Nullable here only so a draft can be saved mid-flow.
  photo_url          text,
  portions_total     integer not null check (portions_total > 0),
  portions_left      integer not null check (portions_left >= 0),
  price_vnd          integer not null check (price_vnd >= 0),
  original_price_vnd integer check (original_price_vnd is null or original_price_vnd >= price_vnd),
  handling_class     handling_class not null,
  prepared_at        timestamptz not null,
  pickup_from        timestamptz not null,
  pickup_until       timestamptz not null,
  safety_deadline    timestamptz generated always as (
    -- UTC timestamp arithmetic is immutable; timestamptz + interval is not.
    ((prepared_at at time zone 'UTC') + (case handling_class
      when 'hot'          then interval '180 minutes'
      when 'chilled'      then interval '1320 minutes'
      when 'ambient'      then interval '660 minutes'
      when 'shelf_stable' then interval '4320 minutes'
    end)) at time zone 'UTC'
  ) stored,
  status             listing_status not null default 'draft',
  allergens          text[] not null default '{}',
  is_vegetarian      boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint portions_left_within_total check (portions_left <= portions_total),
  constraint window_ordered check (pickup_until > pickup_from)
);

create index listings_restaurant_idx on listings (restaurant_id);
create index listings_live_idx on listings (status, pickup_until)
  where status = 'live';

-- A partner's phone can be wrong, or optimistic. Clamp the pickup window to
-- the computed safety deadline on the way in rather than trusting the client.
-- safety_deadline is a generated column and is not visible to a BEFORE
-- trigger, so the same expression is repeated here. It is the one piece of
-- duplication in the schema, and it is deliberate: the generated column is
-- what clients read, this is what stops a bad write landing.
create or replace function clamp_pickup_window() returns trigger
language plpgsql as $$
declare
  v_deadline timestamptz;
begin
  if new.prepared_at > now() + interval '5 minutes' then
    raise exception 'prepared_in_future';
  end if;

  v_deadline := new.prepared_at + (case new.handling_class
    when 'hot'          then interval '180 minutes'
    when 'chilled'      then interval '1320 minutes'
    when 'ambient'      then interval '660 minutes'
    when 'shelf_stable' then interval '4320 minutes'
  end);

  if new.pickup_until > v_deadline then
    new.pickup_until := v_deadline;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_clamp_window
  before insert or update on listings
  for each row execute function clamp_pickup_window();

-- ------------------------------------------------------------------ orders
create table orders (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references listings on delete restrict,
  eater_id        uuid not null references profiles on delete restrict,
  portions        integer not null check (portions > 0),
  price_paid_vnd  integer not null check (price_paid_vnd >= 0),
  payment_method  payment_method not null,
  pickup_code     text not null check (pickup_code ~ '^[0-9]{4}$'),
  status          order_status not null default 'reserved',
  reserved_at     timestamptz not null default now(),
  collected_at    timestamptz
);

create index orders_eater_idx on orders (eater_id, reserved_at desc);
create index orders_listing_idx on orders (listing_id);
-- Codes only need to be unique among the orders a restaurant is currently
-- expecting, which is what makes a 4-digit code workable at a counter.
create unique index orders_active_code_idx on orders (listing_id, pickup_code)
  where status = 'reserved';

-- ----------------------------------------------------------- credit ledger
create table credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles on delete cascade,
  delta_vnd  integer not null,
  reason     text not null,
  order_id   uuid references orders on delete set null,
  issued_by  uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);

create index credit_ledger_profile_idx on credit_ledger (profile_id, created_at desc);

-- ----------------------------------------------------------------- reports
create table reports (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders on delete cascade,
  reporter_id uuid not null references profiles on delete cascade,
  kind        text not null check (kind in ('quality', 'safety', 'no_show', 'other')),
  detail      text,
  status      text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  created_at  timestamptz not null default now()
);

create index reports_open_idx on reports (status, created_at desc) where status <> 'resolved';
