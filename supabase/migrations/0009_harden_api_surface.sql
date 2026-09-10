-- Closing the gap between what 0002-0005 intended and what PostgREST publishes.
--
-- None of this was reachable before there was a real project to point
-- Supabase's linter at. Every item here is a case where the SQL says one thing
-- and the deployed API surface does another.

-- ------------------------------------------------ the trigger's search_path
-- Every other function in this schema pins `search_path`. clamp_pickup_window
-- did not, and it runs on every insert and update to `listings` -- the write
-- path the entire safety model rests on. An unpinned function resolves its
-- unqualified names against whatever the caller has set, so a caller who puts
-- their own schema first would choose which `safety_deadline_of` runs, and the
-- deadline is exactly the value nobody may be allowed to choose.
create or replace function clamp_pickup_window() returns trigger
language plpgsql set search_path = public as $$
declare
  v_deadline timestamptz;
begin
  if new.prepared_at > now() + interval '5 minutes' then
    raise exception 'prepared_in_future';
  end if;

  v_deadline := safety_deadline_of(new.prepared_at, new.handling_class);

  if new.pickup_until > v_deadline then
    new.pickup_until := v_deadline;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------- functions that are not API
-- PostgREST publishes every function in `public` as an RPC endpoint. Two
-- separate grants decide who may call one, and each of the migrations below
-- closed exactly one of them:
--
--   * Postgres grants EXECUTE on every new function to PUBLIC.
--   * Supabase's default privileges additionally grant it to `anon` and
--     `authenticated` by name.
--
-- 0003 and 0005 revoked from PUBLIC and stopped, so `anon` kept its own grant
-- and reserve_listing stayed callable without signing in. Revoking only from
-- the named roles has the mirror-image problem: PUBLIC still carries it, and
-- both roles inherit through PUBLIC. Verified both ways against this project.
-- So every revoke below names all three.

-- SECURITY DEFINER, no authorisation check of its own, and reachable at
-- /rest/v1/rpc/expire_listings. It only touches rows already past their
-- deadline, so it cannot destroy live stock -- but it is a housekeeping job
-- for a scheduler and was never meant to be an endpoint at all.
revoke execute on function expire_listings() from public, anon, authenticated;

-- is_staff_of is the one the linter flags that must stay callable, and it is
-- worth writing down why so nobody "fixes" it later.
--
-- A policy expression is evaluated as the querying role, and it therefore needs
-- EXECUTE on every function it calls. is_staff_of is the predicate half the
-- policies in 0002 are built on, so revoking it does not harden the storefront,
-- it closes it: every read of `restaurants` and `listings` fails outright with
-- "permission denied for function is_staff_of".
--
-- This is easy to get wrong in testing, because revoking from `anon` and
-- `authenticated` alone appears to work -- the roles keep inheriting through
-- PUBLIC, so the policies go on evaluating. Only when PUBLIC is revoked too
-- does the read path break, which is exactly the combination the lint asks for.
--
-- Exposing it costs nothing: it takes a restaurant id, reads auth.uid(), and
-- answers only about its own caller. The grant is explicit here so the next
-- person to read the linter finds the reason attached to it.
grant execute on function is_staff_of(uuid) to anon, authenticated;

-- These two already refuse an anonymous caller from the inside --
-- reserve_listing raises not_authenticated on a null auth.uid(), collect_order
-- raises not_staff -- so this changes no behaviour today. It makes the grant
-- state what 0003 and 0005 already meant, instead of resting the guarantee
-- entirely on the function body.
revoke execute on function reserve_listing(uuid, integer, payment_method)
  from public, anon;
revoke execute on function collect_order(uuid, text) from public, anon;
grant execute on function reserve_listing(uuid, integer, payment_method)
  to authenticated;
grant execute on function collect_order(uuid, text) to authenticated;

-- ------------------------------------------------------ foreign key indexes
-- An unindexed foreign key makes the parent's delete and update scan the whole
-- child table. These four are small now and will not stay small: credit_ledger
-- is the audit trail for every subsidised meal, and reports grows with every
-- complaint. Cheap to add now, awkward to add under load later.
create index if not exists credit_ledger_order_idx     on credit_ledger (order_id);
create index if not exists credit_ledger_issued_by_idx on credit_ledger (issued_by);
create index if not exists reports_order_idx           on reports (order_id);
create index if not exists reports_reporter_idx        on reports (reporter_id);
