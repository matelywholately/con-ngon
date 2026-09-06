-- Store-level reads for the map.
--
-- The map pins restaurants, not listings. Drawing it from `nearby_listings`
-- would mean pulling every portion in the radius just to place a pin, and
-- would stack two pins at one address whenever a kitchen has more than one
-- tray left. These two functions answer the map's actual questions instead.
--
-- Both are SECURITY INVOKER, so the RLS policies in 0002 still apply. They
-- widen nothing: `read approved restaurants` already exposes these rows, and
-- the listings policy already exposes live listings from approved restaurants.

-- ------------------------------------------------------------ nearby stores
-- One row per restaurant, with everything on offer folded into an aggregate.
--
-- Deliberately wider than `nearby_listings`: a restaurant whose portions have
-- all gone still comes back, with `portions_left = 0`. The map draws it grey.
-- "This street takes part and you were late" is useful; an empty map reads as
-- "nobody near you does this", which is a different and more discouraging
-- claim — and usually a false one.
create or replace function nearby_stores(
  in_lat       double precision,
  in_lng       double precision,
  in_radius_m  integer default 1500,
  in_limit     integer default 100
)
returns table (
  id                     uuid,
  name                   text,
  address                text,
  district               text,
  lat                    double precision,
  lng                    double precision,
  distance_m             double precision,
  offer_count            integer,
  portions_left          integer,
  min_price_vnd          integer,
  best_discount_percent  integer,
  soonest_deadline       timestamptz,
  has_free               boolean
)
language sql stable security invoker set search_path = public as $$
  with origin as (
    select st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography as g
  ),
  on_offer as (
    select
      l.restaurant_id,
      l.portions_left,
      l.price_vnd,
      l.original_price_vnd,
      least(l.pickup_until, l.safety_deadline) as deadline
    from listings l
    where l.status in ('live', 'sold_out')
      and now() < least(l.pickup_until, l.safety_deadline)
  )
  select
    r.id,
    r.name,
    r.address,
    r.district,
    -- st_y is latitude and st_x is longitude, in that order. Selecting the
    -- raw `location` instead would hand PostgREST a geography, which it
    -- serialises as a WKB hex string that no client here can read.
    st_y(r.location::geometry),
    st_x(r.location::geometry),
    st_distance(r.location, o.g),
    count(*)::integer,
    coalesce(sum(f.portions_left), 0)::integer,
    min(f.price_vnd)::integer,
    -- Floored, so a saving is never overstated. Mirrors `discountPercent`.
    max(
      case
        when f.original_price_vnd is not null and f.original_price_vnd > f.price_vnd
        then floor(((f.original_price_vnd - f.price_vnd)::numeric / f.original_price_vnd) * 100)
      end
    )::integer,
    min(f.deadline),
    bool_or(f.price_vnd = 0)
  from restaurants r
  join on_offer f on f.restaurant_id = r.id
  cross join origin o
  where r.status = 'approved'
    and st_dwithin(r.location, o.g, in_radius_m)
  group by r.id, r.name, r.address, r.district, r.location, o.g
  -- Somewhere with food first, then whatever runs out soonest. The same
  -- reasoning as `nearby_listings`: the food most at risk of being binned is
  -- the food we most want someone to walk to. The client re-sorts from here.
  order by (coalesce(sum(f.portions_left), 0) > 0) desc, min(f.deadline) asc
  limit greatest(1, least(in_limit, 500));
$$;

-- ------------------------------------------------------------ store listings
-- Everything on offer at one restaurant, in the same shape `nearby_listings`
-- returns, so the store page can render the exact same offer cards as the
-- feed. Sold-out rows are included: the store page should be able to show
-- that a thing existed today and has gone.
create or replace function store_listings(
  in_restaurant_id  uuid,
  in_lat            double precision,
  in_lng            double precision
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
  where l.restaurant_id = in_restaurant_id
    and r.status = 'approved'
    and l.status in ('live', 'sold_out')
    and now() < least(l.pickup_until, l.safety_deadline)
  order by least(l.pickup_until, l.safety_deadline) asc;
$$;
