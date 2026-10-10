-- QR passes identify the exact order. Manual four-digit pickup stays compatible.
create function collect_qr_order(in_restaurant_id uuid, in_order_id uuid, in_code text)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_listing listings;
begin
  if not is_staff_of(in_restaurant_id) then raise exception 'not_staff'; end if;
  if in_order_id is null or in_code is null or in_code !~ '^[0-9]{4}$' then
    raise exception 'code_not_found';
  end if;
  perform 1 from restaurants where id = in_restaurant_id and status = 'approved' for update;
  if not found then raise exception 'restaurant_unavailable'; end if;
  select o.* into v_order from orders o join listings l on l.id = o.listing_id
    where o.id = in_order_id and l.restaurant_id = in_restaurant_id
      and o.pickup_code = in_code and o.status = 'reserved';
  if not found then raise exception 'code_not_found'; end if;
  select * into v_listing from listings where id = v_order.listing_id for update;
  select * into v_order from orders where id = in_order_id for update;
  if v_order.status <> 'reserved' or v_order.pickup_code <> in_code then
    raise exception 'code_not_found';
  end if;
  if clock_timestamp() < v_listing.pickup_from then raise exception 'pickup_not_started'; end if;
  if clock_timestamp() >= least(v_listing.pickup_until, v_listing.safety_deadline) then
    raise exception 'past_pickup_window';
  end if;
  update orders set status = 'collected', collected_at = clock_timestamp()
    where id = v_order.id returning * into v_order;
  return v_order;
end;
$$;
revoke all on function collect_qr_order(uuid, uuid, text) from public;
grant execute on function collect_qr_order(uuid, uuid, text) to authenticated;

-- Include restaurant identity in the owner-only read model for QR payloads.
create or replace function my_orders() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(o) || jsonb_build_object('listing',
    jsonb_build_object('title', l.title, 'photo_url', l.photo_url,
      'pickup_from', l.pickup_from, 'pickup_until', l.pickup_until,
      'safety_deadline', l.safety_deadline, 'prepared_at', l.prepared_at,
      'handling_class', l.handling_class, 'restaurant',
      jsonb_build_object('id', r.id, 'name', r.name, 'address', r.address,
        'lat', st_y(r.location::geometry), 'lng', st_x(r.location::geometry),
        'pickup_instructions', r.pickup_instructions)))
    order by o.reserved_at desc), '[]'::jsonb)
  from orders o join listings l on l.id = o.listing_id
  join restaurants r on r.id = l.restaurant_id where o.eater_id = auth.uid();
$$;
