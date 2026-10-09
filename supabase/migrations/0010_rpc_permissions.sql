-- Supabase's default grants include anon explicitly, independently of PUBLIC.
revoke all on function
  reserve_listing(uuid, integer, payment_method, uuid), cancel_order(uuid),
  collect_order(uuid, text), collect_qr_order(uuid, uuid, text),
  issue_credit(uuid, integer, text), listing_details(uuid), my_orders()
  from public, anon;

-- Trigger functions run through their triggers, never through the client API.
revoke all on function create_user_profile(), protect_reserved_window()
  from public, anon, authenticated;
