-- Separate data migration for users created before the auth trigger existed.
-- Existing roles and credit balances are preserved.
insert into profiles (id, phone)
select id, phone from auth.users
on conflict (id) do nothing;
