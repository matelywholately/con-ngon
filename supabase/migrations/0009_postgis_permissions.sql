-- PostGIS owns this reference table. Preserve SELECT for coordinate lookups,
-- but client roles must not rewrite or truncate its coordinate-system data.
do $$ begin
  if to_regclass('public.spatial_ref_sys') is not null then
    revoke insert, update, delete, truncate, references, trigger
      on public.spatial_ref_sys from public, anon, authenticated;
  end if;
end $$;
