-- Development seed. Safe to run repeatedly; safe to skip in production.
--
-- Creates the pilot district's demo restaurants with real Cầu Giấy addresses
-- so the map and the distance sort show something plausible. It deliberately
-- does NOT create auth users — sign in through the app and then attach your
-- profile to a restaurant with the statement at the bottom.

insert into restaurants (id, name, address, district, phone, location, status, pickup_instructions)
values
  ('a1000000-0000-4000-8000-000000000001', 'Quán Bún Chả Hàng Quạt',
   '12 Trần Thái Tông, Cầu Giấy', 'Cầu Giấy', '+84241234001',
   st_setsrid(st_makepoint(105.7887, 21.0305), 4326)::geography, 'approved',
   'Vào cửa bên trái, hỏi quầy thu ngân.'),
  ('a1000000-0000-4000-8000-000000000002', 'Cơm Bình Dân Dịch Vọng',
   '87 Dịch Vọng Hậu, Cầu Giấy', 'Cầu Giấy', '+84241234002',
   st_setsrid(st_makepoint(105.7823, 21.0361), 4326)::geography, 'approved',
   'Quầy ngoài cùng bên phải.'),
  ('a1000000-0000-4000-8000-000000000003', 'Bánh Mì 25 Nguyễn Phong Sắc',
   '25 Nguyễn Phong Sắc, Cầu Giấy', 'Cầu Giấy', '+84241234003',
   st_setsrid(st_makepoint(105.7901, 21.0398), 4326)::geography, 'approved',
   'Xe bánh mì trước cửa số 25.'),
  ('a1000000-0000-4000-8000-000000000004', 'Quán Chay An Lạc',
   '4 Trần Quốc Hoàn, Cầu Giấy', 'Cầu Giấy', '+84241234004',
   st_setsrid(st_makepoint(105.7935, 21.0421), 4326)::geography, 'approved',
   'Tầng 1, hỏi bàn lễ tân.'),
  ('a1000000-0000-4000-8000-000000000005', 'Sữa Chua Cô Hoa',
   '31 Nguyễn Khánh Toàn, Cầu Giấy', 'Cầu Giấy', '+84241234005',
   st_setsrid(st_makepoint(105.8004, 21.0349), 4326)::geography, 'approved',
   'Tủ mát bên trong quán.'),
  -- Sells out early, which is the point of seeding it: the map draws a grey
  -- pin for a restaurant with nothing left, and that state needs to be
  -- reachable in development without waiting for someone to buy the last one.
  ('a1000000-0000-4000-8000-000000000006', 'Xôi Cô Tuyết',
   '58 Trần Thái Tông, Cầu Giấy', 'Cầu Giấy', '+84241234006',
   st_setsrid(st_makepoint(105.7924, 21.0288), 4326)::geography, 'approved',
   'Gánh xôi đầu ngõ, cạnh hiệu thuốc.')
on conflict (id) do nothing;

-- Listings are written relative to now() so the countdowns are live and every
-- urgency state is reachable while you look at the list.
insert into listings (
  id, restaurant_id, title, description, portions_total, portions_left,
  price_vnd, original_price_vnd, handling_class,
  prepared_at, pickup_from, pickup_until, status, allergens, is_vegetarian
) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Bún chả nướng than',
   'Chả nướng, bún, rau sống và nước chấm. Đủ cho một người ăn no.',
   8, 6, 25000, 60000, 'hot',
   now() - interval '45 minutes', now() - interval '15 minutes', now() + interval '70 minutes',
   'live', array['đậu phộng', 'nước mắm'], false),

  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'Cơm rang dưa bò',
   'Cơm rang với dưa chua và thịt bò. Còn nóng.',
   5, 2, 20000, 45000, 'hot',
   now() - interval '140 minutes', now() - interval '60 minutes', now() + interval '22 minutes',
   'live', array[]::text[], false),

  ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 'Bánh mì thập cẩm',
   'Bánh mì kẹp pate, chả, rau. Nướng lại là ngon như mới.',
   12, 9, 10000, 25000, 'ambient',
   now() - interval '200 minutes', now() - interval '120 minutes', now() + interval '240 minutes',
   'live', array['gluten', 'trứng'], false),

  -- The free track: price 0, funded from the NGO credit pool. Visually
  -- identical to every other card in the app.
  ('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004', 'Đậu phụ sốt cà chua + cơm',
   'Suất chay đầy đủ: đậu phụ sốt cà, rau luộc, cơm trắng.',
   6, 6, 0, 35000, 'hot',
   now() - interval '30 minutes', now() - interval '5 minutes', now() + interval '95 minutes',
   'live', array['đậu nành'], true),

  ('b1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000005', 'Sữa chua nếp cẩm',
   'Sữa chua tự làm với nếp cẩm. Bảo quản lạnh liên tục.',
   10, 4, 8000, 20000, 'chilled',
   now() - interval '300 minutes', now() - interval '180 minutes', now() + interval '180 minutes',
   'live', array['sữa'], true),

  -- A second tray at the demo restaurant. The map groups pins by restaurant,
  -- so without this every restaurant has exactly one listing and the grouping
  -- is never actually exercised against real rows.
  ('b1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000001', 'Nem rán cua bể',
   'Nem rán nhân cua bể, còn giòn. Ăn kèm bún chả hoặc ăn riêng.',
   6, 3, 18000, 45000, 'hot',
   now() - interval '25 minutes', now() - interval '5 minutes', now() + interval '85 minutes',
   'live', array['cua', 'trứng', 'gluten'], false),

  -- Sold out, and still on the map as a grey pin.
  ('b1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000006', 'Xôi xéo hành phi',
   'Xôi xéo với đậu xanh và hành phi. Hết sớm, mai quay lại nhé.',
   10, 0, 12000, 25000, 'hot',
   now() - interval '70 minutes', now() - interval '50 minutes', now() + interval '60 minutes',
   'sold_out', array['đậu xanh'], true)
-- Re-running refreshes the demo rather than duplicating it -- the header above
-- promises repeat-safety and only the restaurants insert delivered it. The
-- fixed ids exist for this. Refreshing the times is the point: they are written
-- relative to now(), so a seed left from yesterday shows every countdown
-- expired and none of the urgency states this data exists to cover. Portions
-- and status come back too, so a listing bought out during a demo returns to
-- stock on the next run.
on conflict (id) do update set
  portions_total = excluded.portions_total,
  portions_left  = excluded.portions_left,
  prepared_at    = excluded.prepared_at,
  pickup_from    = excluded.pickup_from,
  pickup_until   = excluded.pickup_until,
  status         = excluded.status;

-- After signing in through the app once, make yourself staff at the demo
-- restaurant so the partner side opens:
--
--   insert into restaurant_staff (restaurant_id, profile_id)
--   values ('a1000000-0000-4000-8000-000000000001', '<your auth.users id>');
--
--   update profiles set role = 'partner_staff' where id = '<your auth.users id>';
