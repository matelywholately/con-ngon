-- Transactional operations.
--
-- Anything that has to be atomic lives here rather than in the client, so two
-- phones racing for the last portion cannot both win.

-- --------------------------------------------------------- nearby listings
-- The hottest read path in the app. SECURITY INVOKER so the RLS policies
-- above still apply — this widens nothing, it only joins and sorts.
create or replace function nearby_listings(
  in_lat       double precision,
  in_lng       double precision,
  in_radius_m  integer default 1500,
  in_limit     integer default 50
)
returns table (
  id                  uuid,
  restaurant_id       uuid,
  title               text,
  description         text,
  photo_url           text,
  portions_total      integer,
  portions_left       integer,
  price_vnd           integer,
  original_price_vnd  integer,
  handling_class      handling_class,
  prepared_at         timestamptz,
  pickup_from         timestamptz,
  pickup_until        timestamptz,
  safety_deadline     timestamptz,
  status              listing_status,
  allergens           text[],
  is_vegetarian       boolean,
  created_at          timestamptz,
  restaurant_name     text,
  restaurant_address  text,
  restaurant_lat      double precision,
  restaurant_lng      double precision,
  distance_m          double precision
)
language sql stable security invoker set search_path = public as $$
  with origin as (
    select st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography as g
  )
  select
    l.id, l.restaurant_id, l.title, l.description, l.photo_url,
    l.portions_total, l.portions_left, l.price_vnd, l.original_price_vnd,
    l.handling_class, l.prepared_at, l.pickup_from, l.pickup_until,
    l.safety_deadline, l.status, l.allergens, l.is_vegetarian, l.created_at,
    r.name, r.address,
    st_y(r.location::geometry), st_x(r.location::geometry),
    st_distance(r.location, o.g)
  from listings l
  join restaurants r on r.id = l.restaurant_id
  cross join origin o
  where l.status = 'live'
    and l.portions_left > 0
    and r.status = 'approved'
    and now() < least(l.pickup_until, l.safety_deadline)
    and st_dwithin(r.location, o.g, in_radius_m)
  -- Soonest to expire first: the food most at risk of being binned is the
  -- food we most want someone to walk to.
  order by least(l.pickup_until, l.safety_deadline) asc
  limit greatest(1, least(in_limit, 200));
$$;

-- --------------------------------------------------------------- reserving
create or replace function reserve_listing(
  in_listing_id      uuid,
  in_portions        integer,
  in_payment_method  payment_method
)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_listing  listings;
  v_order    orders;
  v_code     text;
  v_uid      uuid := auth.uid();
  v_total    integer;
  v_attempts integer := 0;
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

-- --------------------------------------------------------------- handover
-- Called by partner staff at the counter. Takes the code the customer shows,
-- not an order id, because the code is all the staff member can see.
create or replace function collect_order(
  in_restaurant_id uuid,
  in_code          text
)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
begin
  if not is_staff_of(in_restaurant_id) then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  select o.* into v_order
    from orders o
    join listings l on l.id = o.listing_id
   where l.restaurant_id = in_restaurant_id
     and o.pickup_code = lpad(in_code, 4, '0')
     and o.status = 'reserved'
   for update of o;

  if not found then
    raise exception 'code_not_found' using errcode = 'P0002';
  end if;

  update orders
     set status = 'collected', collected_at = now()
   where id = v_order.id
   returning * into v_order;

  return v_order;
end;
$$;

revoke all on function collect_order(uuid, text) from public;
grant execute on function collect_order(uuid, text) to authenticated;

-- ---------------------------------------------------------------- sweeping
-- Run on a schedule (pg_cron, or a Supabase scheduled edge function). Nothing
-- depends on it for correctness — every read path already filters on the
-- deadline — but it keeps the partner's board honest and the tables tidy.
create or replace function expire_listings()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  update listings
     set status = 'expired'
   where status in ('live', 'sold_out')
     and now() >= least(pickup_until, safety_deadline);
  get diagnostics v_count = row_count;

  -- A reservation nobody collected before the window closed.
  update orders o
     set status = 'no_show'
    from listings l
   where l.id = o.listing_id
     and o.status = 'reserved'
     and now() >= least(l.pickup_until, l.safety_deadline);

  return v_count;
end;
$$;
