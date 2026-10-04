-- Complete the reservation lifecycle. Apply after 0001–0004.
-- Forward migration: do not roll back after credit orders are created.
-- Payment-provider integration is intentionally absent: cash/VietQR settle
-- at pickup, support credit is deducted atomically at reservation.

alter table orders add column reservation_request_id uuid;
alter table orders add column credit_used_vnd integer not null default 0
  check (credit_used_vnd >= 0 and credit_used_vnd <= price_paid_vnd);
create unique index orders_request_idx on orders (eater_id, reservation_request_id)
  where reservation_request_id is not null;

-- Users may edit their name and language, never their role or balance.
revoke insert, update, delete on profiles from anon, authenticated;
grant update (full_name, locale) on profiles to authenticated;
drop policy "insert own profile" on profiles;
-- All status changes must use RPCs so refunds and stock cannot be bypassed.
drop policy "eater cancels own reservation" on orders;
revoke insert, update, delete on orders from anon, authenticated;
revoke insert, update, delete on credit_ledger from anon, authenticated;
-- Partner staff cannot approve their own restaurant or undo a suspension.
revoke update on restaurants from anon, authenticated;
grant update (name, address, district, phone, location, pickup_instructions,
  business_licence_url, food_safety_cert_url) on restaurants to authenticated;

create or replace function create_user_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, phone) values (new.id, new.phone)
    on conflict (id) do nothing;
  return new;
end;
$$;
create trigger auth_user_profile after insert on auth.users
  for each row execute function create_user_profile();
revoke all on function create_user_profile() from public;

-- Once an order exists, staff cannot move its preparation or pickup window.
create or replace function protect_reserved_window() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.restaurant_id, new.prepared_at, new.handling_class, new.pickup_from, new.pickup_until)
       is distinct from
     (old.restaurant_id, old.prepared_at, old.handling_class, old.pickup_from, old.pickup_until)
     and exists (select 1 from orders where listing_id = old.id) then
    raise exception 'reserved_window_locked';
  end if;
  return new;
end;
$$;
create trigger listings_protect_reserved_window before update on listings
  for each row execute function protect_reserved_window();
revoke all on function protect_reserved_window() from public;

drop function reserve_listing(uuid, integer, payment_method);
create function reserve_listing(
  in_listing_id uuid, in_portions integer, in_payment_method payment_method,
  in_request_id uuid default null
) returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_listing listings;
  v_order orders;
  v_uid uuid := auth.uid();
  v_balance integer;
  v_restaurant_id uuid;
  v_restaurant_status restaurant_status;
  v_total integer;
  v_code text;
  v_attempts integer := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if in_portions is null or in_portions < 1 then raise exception 'invalid_portions'; end if;
  if in_payment_method is null or in_payment_method not in ('cash', 'vietqr', 'credit') then
    raise exception 'unsupported_payment_method';
  end if;

  -- All reservations/cancellations lock profile, restaurant, listing, order
  -- in this order. The profile lock also serialises credit spending across
  -- different restaurants and duplicate request IDs.
  select credit_balance_vnd into v_balance from profiles where id = v_uid for update;
  if not found then raise exception 'profile_not_found'; end if;
  if in_request_id is not null then
    select * into v_order from orders
      where eater_id = v_uid and reservation_request_id = in_request_id;
    if found then
      if (v_order.listing_id, v_order.portions, v_order.payment_method)
        is distinct from (in_listing_id, in_portions, in_payment_method) then
        raise exception 'request_conflict';
      end if;
      return v_order;
    end if;
  end if;

  select restaurant_id into v_restaurant_id from listings where id = in_listing_id;
  if not found then raise exception 'listing_not_found'; end if;
  select status into v_restaurant_status from restaurants
    where id = v_restaurant_id for update;
  if v_restaurant_status <> 'approved' then raise exception 'restaurant_unavailable'; end if;
  select * into v_listing from listings where id = in_listing_id for update;
  if v_listing.restaurant_id <> v_restaurant_id then raise exception 'restaurant_unavailable'; end if;
  if v_listing.status not in ('live', 'sold_out') then raise exception 'listing_not_live'; end if;
  if clock_timestamp() >= least(v_listing.pickup_until, v_listing.safety_deadline) then
    raise exception 'past_pickup_window';
  end if;
  if v_listing.portions_left < in_portions or v_listing.status = 'sold_out' then
    raise exception 'sold_out';
  end if;
  v_total := v_listing.price_vnd * in_portions;
  if in_payment_method = 'credit' and v_balance < v_total then
    raise exception 'insufficient_credit';
  end if;

  -- The restaurant row lock serialises code allocation across ALL its dishes.
  -- Existing duplicate legacy codes are rejected at handover, never guessed.
  loop
    v_attempts := v_attempts + 1;
    v_code := lpad(floor(random() * 10000)::integer::text, 4, '0');
    exit when not exists (
      select 1 from orders o join listings l on l.id = o.listing_id
      where l.restaurant_id = v_restaurant_id and o.pickup_code = v_code
        and o.status = 'reserved'
    );
    if v_attempts >= 100 then raise exception 'pickup_codes_exhausted'; end if;
  end loop;
  insert into orders (listing_id, eater_id, portions, price_paid_vnd,
    payment_method, pickup_code, reservation_request_id, credit_used_vnd)
  values (in_listing_id, v_uid, in_portions, v_total, in_payment_method,
    v_code, in_request_id, case when in_payment_method = 'credit' then v_total else 0 end)
  returning * into v_order;
  update listings set portions_left = portions_left - in_portions,
    status = case when portions_left = in_portions then 'sold_out'::listing_status else status end
    where id = in_listing_id;
  if v_order.credit_used_vnd > 0 then
    update profiles set credit_balance_vnd = credit_balance_vnd - v_total where id = v_uid;
    insert into credit_ledger (profile_id, delta_vnd, reason, order_id)
      values (v_uid, -v_total, 'reservation', v_order.id);
  end if;
  return v_order;
end;
$$;
revoke all on function reserve_listing(uuid, integer, payment_method, uuid) from public;
grant execute on function reserve_listing(uuid, integer, payment_method, uuid) to authenticated;

create function cancel_order(in_order_id uuid) returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_order orders;
  v_listing listings;
  v_restaurant_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform 1 from profiles where id = v_uid for update;
  select * into v_order from orders where id = in_order_id and eater_id = v_uid;
  if not found then raise exception 'order_not_found'; end if;
  select restaurant_id into v_restaurant_id from listings where id = v_order.listing_id;
  perform 1 from restaurants where id = v_restaurant_id for update;
  select * into v_listing from listings where id = v_order.listing_id for update;
  select * into v_order from orders where id = in_order_id for update;
  if v_order.status = 'cancelled' then return v_order; end if;
  if v_order.status <> 'reserved' then raise exception 'order_not_reserved'; end if;
  if clock_timestamp() >= least(v_listing.pickup_until, v_listing.safety_deadline) then
    raise exception 'past_pickup_window';
  end if;
  update orders set status = 'cancelled' where id = in_order_id returning * into v_order;
  update listings set portions_left = portions_left + v_order.portions,
    status = case when status = 'sold_out' then 'live'::listing_status else status end
    where id = v_listing.id;
  -- Legacy credit orders default to zero: never refund credit not charged.
  if v_order.credit_used_vnd > 0 then
    update profiles set credit_balance_vnd = credit_balance_vnd + v_order.credit_used_vnd
      where id = v_uid;
    insert into credit_ledger (profile_id, delta_vnd, reason, order_id)
      values (v_uid, v_order.credit_used_vnd, 'cancellation', in_order_id);
  end if;
  return v_order;
end;
$$;
revoke all on function cancel_order(uuid) from public;
grant execute on function cancel_order(uuid) to authenticated;

create or replace function collect_order(in_restaurant_id uuid, in_code text)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_listing listings;
  v_count integer;
begin
  if not is_staff_of(in_restaurant_id) then raise exception 'not_staff'; end if;
  if in_code is null or in_code !~ '^[0-9]{4}$' then raise exception 'code_not_found'; end if;
  perform 1 from restaurants where id = in_restaurant_id and status = 'approved' for update;
  if not found then raise exception 'restaurant_unavailable'; end if;
  select count(*) into v_count from orders o join listings l on l.id = o.listing_id
    where l.restaurant_id = in_restaurant_id and o.pickup_code = in_code and o.status = 'reserved';
  if v_count = 0 then raise exception 'code_not_found'; end if;
  if v_count > 1 then raise exception 'ambiguous_code'; end if;
  select o.* into v_order from orders o join listings l on l.id = o.listing_id
    where l.restaurant_id = in_restaurant_id and o.pickup_code = in_code and o.status = 'reserved';
  select * into v_listing from listings where id = v_order.listing_id for update;
  select * into v_order from orders where id = v_order.id for update;
  if v_order.status <> 'reserved' then raise exception 'code_not_found'; end if;
  if clock_timestamp() < v_listing.pickup_from then raise exception 'pickup_not_started'; end if;
  if clock_timestamp() >= least(v_listing.pickup_until, v_listing.safety_deadline) then
    raise exception 'past_pickup_window';
  end if;
  update orders set status = 'collected', collected_at = clock_timestamp()
    where id = v_order.id returning * into v_order;
  return v_order;
end;
$$;
-- Existing execute grants are retained by CREATE OR REPLACE.

create function issue_credit(in_profile_id uuid, in_amount_vnd integer, in_reason text)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_balance integer;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role in ('ngo', 'admin')) then
    raise exception 'not_credit_issuer';
  end if;
  if in_amount_vnd is null or in_amount_vnd <= 0 or in_reason is null or length(btrim(in_reason)) = 0 then
    raise exception 'invalid_credit';
  end if;
  update profiles set credit_balance_vnd = credit_balance_vnd + in_amount_vnd
    where id = in_profile_id returning credit_balance_vnd into v_balance;
  if not found then raise exception 'profile_not_found'; end if;
  insert into credit_ledger (profile_id, delta_vnd, reason, issued_by)
    values (in_profile_id, in_amount_vnd, btrim(in_reason), auth.uid());
  return v_balance;
end;
$$;
revoke all on function issue_credit(uuid, integer, text) from public;
grant execute on function issue_credit(uuid, integer, text) to authenticated;

-- Only the scheduler/service role may sweep orders.
revoke all on function expire_listings() from public, anon, authenticated;
grant execute on function expire_listings() to service_role;

-- Read models share the fixture shape; do not cast nested REST rows to it.
create function listing_details(in_listing_id uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select to_jsonb(l) || jsonb_build_object(
    'restaurant_name', r.name, 'restaurant_address', r.address,
    'restaurant_lat', st_y(r.location::geometry),
    'restaurant_lng', st_x(r.location::geometry), 'distance_m', 0)
  from listings l join restaurants r on r.id = l.restaurant_id where l.id = in_listing_id;
$$;
revoke all on function listing_details(uuid) from public;
grant execute on function listing_details(uuid) to authenticated;

-- Definer read restricted to the caller's own orders. A sold-out listing is
-- invisible to eaters under listing RLS, but their pickup pass must survive.
create function my_orders() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(o) || jsonb_build_object('listing',
    jsonb_build_object('title', l.title, 'photo_url', l.photo_url,
      'pickup_from', l.pickup_from, 'pickup_until', l.pickup_until,
      'safety_deadline', l.safety_deadline, 'prepared_at', l.prepared_at,
      'handling_class', l.handling_class, 'restaurant',
      jsonb_build_object('name', r.name, 'address', r.address,
        'lat', st_y(r.location::geometry), 'lng', st_x(r.location::geometry),
        'pickup_instructions', r.pickup_instructions)))
    order by o.reserved_at desc), '[]'::jsonb)
  from orders o join listings l on l.id = o.listing_id
  join restaurants r on r.id = l.restaurant_id where o.eater_id = auth.uid();
$$;
revoke all on function my_orders() from public;
grant execute on function my_orders() to authenticated;
