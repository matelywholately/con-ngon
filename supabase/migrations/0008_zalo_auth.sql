-- Short-lived hashed-token counters. No token, phone, name or IP is stored.
create table zalo_login_attempts (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0)
);
alter table zalo_login_attempts enable row level security;
revoke all on zalo_login_attempts from public, anon, authenticated;
grant all on zalo_login_attempts to service_role;

create function allow_zalo_login(in_token_hash text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if in_token_hash is null or in_token_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  delete from zalo_login_attempts where window_start < clock_timestamp() - interval '10 minutes';
  insert into zalo_login_attempts(token_hash, window_start, attempts)
    values (in_token_hash, clock_timestamp(), 1)
  on conflict(token_hash) do update set attempts = zalo_login_attempts.attempts + 1
    returning attempts into v_count;
  return v_count <= 20;
end;
$$;
revoke all on function allow_zalo_login(text) from public, anon, authenticated;
grant execute on function allow_zalo_login(text) to service_role;
