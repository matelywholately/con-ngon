-- Let eaters see the listing that has sold out.
--
-- 0006 built the map around a deliberate choice: a restaurant whose portions
-- have all gone still comes back from `nearby_stores`, with portions_left = 0,
-- and the map draws it grey -- because "this street takes part and you were
-- late" is useful, where an empty map reads as "nobody near you does this",
-- which is a more discouraging claim and usually a false one.
--
-- That never worked for anyone but staff. The SELECT policy in 0002 exposes
-- only `status = 'live'`, so a `sold_out` listing is invisible to an eater;
-- `nearby_stores` joins through those rows, so a restaurant whose only listing
-- has gone drops out of the aggregate altogether rather than coming back grey.
-- `store_listings` loses the same rows, so a store page cannot show that a
-- thing existed today and has gone either.
--
-- Caught the first time these functions were run against a real database as
-- the `anon` role: the seed's sold-out venue, Xôi Cô Tuyết, was returned to a
-- superuser and missing for everyone else. Every read path the app actually
-- uses had agreed with itself and been wrong together -- src/lib/queries.ts
-- asks for ['live','sold_out'], both RPCs select both, and the fixtures return
-- both, so nothing short of Postgres enforcing the policy could show it.
--
-- Widening this leaks nothing. A sold-out listing carries the same storefront
-- fields as a live one -- title, photo, price, pickup window -- and differs
-- only in having no portions left. The feed is unaffected: `nearby_listings`
-- filters on `status = 'live' and portions_left > 0` itself, so sold-out rows
-- do not reappear as things to buy. Drafts, withdrawn and expired listings
-- stay invisible to everyone but the restaurant that owns them, as before.

drop policy "read live listings" on listings;

create policy "read listings on offer" on listings
  for select using (
    (status in ('live', 'sold_out') and exists (
      select 1 from restaurants r
      where r.id = listings.restaurant_id and r.status = 'approved'
    ))
    or is_staff_of(restaurant_id)
  );
