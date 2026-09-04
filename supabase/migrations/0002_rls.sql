-- Row Level Security.
--
-- The app talks to Postgres directly with the anon key, so RLS is the entire
-- authorisation layer. Every table gets it, with no exceptions — a table with
-- RLS off is readable in full by anyone who opens the app bundle and copies
-- the key out of it.

alter table profiles         enable row level security;
alter table restaurants      enable row level security;
alter table restaurant_staff enable row level security;
alter table listings         enable row level security;
alter table orders           enable row level security;
alter table credit_ledger    enable row level security;
alter table reports          enable row level security;

-- Helper: is the caller staff at this restaurant?
create or replace function is_staff_of(in_restaurant_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from restaurant_staff
    where restaurant_id = in_restaurant_id
      and profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------- profiles
create policy "read own profile" on profiles
  for select using (id = auth.uid());

create policy "update own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "insert own profile" on profiles
  for insert with check (id = auth.uid());

-- ------------------------------------------------------------- restaurants
-- Approved restaurants are public to signed-in users: that is the storefront.
create policy "read approved restaurants" on restaurants
  for select using (status = 'approved' or is_staff_of(id));

create policy "staff update own restaurant" on restaurants
  for update using (is_staff_of(id)) with check (is_staff_of(id));

create policy "read own staff rows" on restaurant_staff
  for select using (profile_id = auth.uid() or is_staff_of(restaurant_id));

-- ---------------------------------------------------------------- listings
-- Eaters see live listings from approved restaurants. Drafts, withdrawn and
-- expired rows stay invisible to everyone but the restaurant that owns them.
create policy "read live listings" on listings
  for select using (
    (status = 'live' and exists (
      select 1 from restaurants r
      where r.id = listings.restaurant_id and r.status = 'approved'
    ))
    or is_staff_of(restaurant_id)
  );

create policy "staff insert listings" on listings
  for insert with check (is_staff_of(restaurant_id));

create policy "staff update own listings" on listings
  for update using (is_staff_of(restaurant_id)) with check (is_staff_of(restaurant_id));

create policy "staff delete own drafts" on listings
  for delete using (is_staff_of(restaurant_id) and status = 'draft');

-- ------------------------------------------------------------------ orders
-- An eater sees their own orders. Restaurant staff see orders against their
-- own listings and nothing else — not the eater's other orders, not their
-- phone number beyond what the handover needs.
create policy "read own orders" on orders
  for select using (
    eater_id = auth.uid()
    or exists (
      select 1 from listings l
      where l.id = orders.listing_id and is_staff_of(l.restaurant_id)
    )
  );

-- Reservations go exclusively through reserve_listing(), which holds a row
-- lock while it decrements stock. Direct inserts would let two phones buy the
-- same last portion, so there is deliberately no INSERT policy here.

create policy "eater cancels own reservation" on orders
  for update using (eater_id = auth.uid() and status = 'reserved')
  with check (eater_id = auth.uid() and status in ('reserved', 'cancelled'));

-- ----------------------------------------------------------- credit ledger
create policy "read own credit ledger" on credit_ledger
  for select using (profile_id = auth.uid());

-- Credits are issued by NGO staff through an edge function running with the
-- service role. Nothing client-side may write to this table.

-- ----------------------------------------------------------------- reports
create policy "read own reports" on reports
  for select using (reporter_id = auth.uid());

create policy "file own report" on reports
  for insert with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from orders o
      where o.id = reports.order_id and o.eater_id = auth.uid()
    )
  );
