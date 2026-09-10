-- What kind of place this is.
--
-- The riskiest assumption in the product is that the surplus exists in the
-- form the app expects. Much Vietnamese eating out is cooked to order, and a
-- kitchen that cooks to order has very little left at closing — it has a
-- half-used mise en place, which is not sellable. The batch surplus that this
-- model actually needs sits somewhere else: cơm bình dân trays, bakeries,
-- buffet service, staff canteens and convenience-store hot counters.
--
-- Those are different businesses with different closing rituals, and possibly
-- a different sales conversation. This column exists so that stops being a
-- guess: with it, "which kinds of venue list, and which of those listings get
-- collected" is a query. Without it, the pilot can only report a single blended
-- number that hides whichever segment is actually working.
--
-- It is deliberately not a free-text field. A fixed list is comparable across
-- venues; "Quán ăn gia đình" typed by one owner and "quán cơm" by another are
-- not.

create type venue_type as enum (
  -- Rice-and-dish counters serving from trays. The clearest batch surplus in
  -- the country, and the closest thing this product has to a core customer.
  'com_binh_dan',
  'bakery',
  -- Buffets and canteens both cook to a forecast rather than to an order,
  -- which is exactly what produces a predictable end-of-service surplus.
  'buffet',
  'canteen',
  -- Hot counters and chilled shelves, where the surplus carries a printed
  -- date and needs no judgement call about handling.
  'convenience',
  -- Cooked to order. Included because it is the assumption under test, not
  -- because it is expected to work.
  'restaurant',
  'cafe',
  'street_stall'
);

-- Nullable rather than defaulted: an unclassified venue should look like a
-- gap in the data, because that is what it is. A default of 'restaurant'
-- would quietly manufacture evidence for the very assumption being tested.
alter table restaurants add column venue_type venue_type;

create index restaurants_venue_type_idx on restaurants (venue_type);

comment on column restaurants.venue_type is
  'What kind of venue this is. Drives segment analysis of which venue types '
  'actually produce collectable surplus — the core product hypothesis.';

-- The development seed, classified. The mix is deliberate: four of the six
-- are the forecast-cooking venues the model depends on, and two cook to
-- order and are there as the control.
update restaurants set venue_type = 'street_stall'
  where id = 'a1000000-0000-4000-8000-000000000001';  -- Bún chả, cooked to order
update restaurants set venue_type = 'com_binh_dan'
  where id = 'a1000000-0000-4000-8000-000000000002';  -- Trays, the core case
update restaurants set venue_type = 'bakery'
  where id = 'a1000000-0000-4000-8000-000000000003';  -- Bánh mì cart
update restaurants set venue_type = 'canteen'
  where id = 'a1000000-0000-4000-8000-000000000004';  -- Vegetarian canteen
update restaurants set venue_type = 'convenience'
  where id = 'a1000000-0000-4000-8000-000000000005';  -- Chilled shelf
update restaurants set venue_type = 'com_binh_dan'
  where id = 'a1000000-0000-4000-8000-000000000006';  -- Xôi, sells out by nature
