-- Free-track allocation.
--
-- A listing at price 0 used to be reservable by whoever tapped first, so the
-- fastest phone won rather than the person the free track exists for. Nothing
-- in the schema aimed it: there is no eligibility gate in the RLS policies,
-- and `credit` was only ever a payment method on *priced* listings.
--
-- This adds a priority window. For the first stretch of its life a free
-- portion may only be reserved by someone the NGO has funded; after that it
-- opens to everyone, because letting food rot when nobody eligible is inside
-- a walking radius would defeat the whole product.
--
-- This is the authoritative copy of the rule. `src/lib/priority.ts` mirrors it
-- to decide what to *show*; this decides what to *allow*. Change one and you
-- must change the other. Enforcing it here rather than in the client is what
-- makes it real: `orders` has no INSERT policy, so this function is the only
-- way an order can come into existence.

-- How long a free portion is held for credit holders, at most.
create or replace function free_track_priority_minutes()
returns integer language sql immutable set search_path = public as $$
  select 30;
$$;

-- When the window closes for a given listing. Null when there is no window:
-- the listing is priced, or it had no life left when it was posted.
create or replace function free_track_priority_until(in_listing listings)
returns timestamptz language sql stable set search_path = public as $$
  select case
    when in_listing.price_vnd <> 0 then null
    when least(in_listing.pickup_until, in_listing.safety_deadline)
         <= in_listing.created_at then null
    else in_listing.created_at + least(
      make_interval(mins => free_track_priority_minutes()),
      -- Never hold a portion for more than half the time it has left.
      (least(in_listing.pickup_until, in_listing.safety_deadline)
         - in_listing.created_at) / 2
    )
  end;
$$;

create or replace function reserve_listing(
  in_listing_id      uuid,
  in_portions        integer,
  in_payment_method  payment_method
)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_listing        listings;
  v_order          orders;
  v_code           text;
  v_uid            uuid := auth.uid();
  v_total          integer;
  v_attempts       integer := 0;
  v_priority_until timestamptz;
  v_credit         integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if in_portions < 1 then
    raise exception 'invalid_portions' using errcode = '22023';
  end if;

  -- Row lock: everything below is serialised per listing.
  select * into v_listing from listings where id = in_listing_id for update;

  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;
  if v_listing.status <> 'live' then
    raise exception 'listing_not_live' using errcode = 'P0001';
  end if;
  if v_listing.portions_left < in_portions then
    raise exception 'sold_out' using errcode = 'P0001';
  end if;
  if now() >= least(v_listing.pickup_until, v_listing.safety_deadline) then
    raise exception 'past_pickup_window' using errcode = 'P0001';
  end if;

  -- The free track's priority window. Checked inside the same lock as the
  -- portion count, so it cannot be raced any more than the last portion can.
  v_priority_until := free_track_priority_until(v_listing);
  if v_priority_until is not null and now() < v_priority_until then
    select credit_balance_vnd into v_credit from profiles where id = v_uid;
    if coalesce(v_credit, 0) <= 0 then
      raise exception 'priority_window' using errcode = 'P0001';
    end if;
  end if;

  v_total := v_listing.price_vnd * in_portions;

  update listings
     set portions_left = portions_left - in_portions,
         status = case
                    when portions_left - in_portions = 0 then 'sold_out'::listing_status
                    else status
                  end
   where id = in_listing_id;

  -- Retry on the rare collision with another live code for this listing.
  loop
    v_attempts := v_attempts + 1;
    v_code := lpad((floor(random() * 10000))::integer::text, 4, '0');
    begin
      insert into orders (
        listing_id, eater_id, portions, price_paid_vnd, payment_method, pickup_code
      ) values (
        in_listing_id, v_uid, in_portions, v_total, in_payment_method, v_code
      ) returning * into v_order;
      exit;
    exception when unique_violation then
      if v_attempts >= 20 then raise; end if;
    end;
  end loop;

  return v_order;
end;
$$;

revoke all on function reserve_listing(uuid, integer, payment_method) from public;
grant execute on function reserve_listing(uuid, integer, payment_method) to authenticated;

-- The window is a property of the listing, so every reader can see it and
-- explain itself. It marks the listing, never the person holding the credit.
grant execute on function free_track_priority_until(listings) to authenticated;
grant execute on function free_track_priority_minutes() to authenticated;
