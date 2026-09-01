-- Verkauf über die Plattform (beim Archivieren abgefragt)
alter table public.listings
  add column if not exists sold_via_platform boolean;

comment on column public.listings.sold_via_platform is
  'true = beim Archivieren als über Startplatzbörse verkauft gemeldet; false = archiviert ohne Verkauf über die Plattform; null = noch aktiv oder Alt-Daten';

-- Startseiten-Kennzahlen: ohne Nachrichten, mit verkauften Plätzen
-- Return-Typ ändert sich gegenüber älter-Version → erst droppen
drop function if exists public.get_homepage_stats();

create or replace function public.get_homepage_stats()
returns table (
    listings_count bigint,
    users_count bigint,
    sold_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
    select
        (select count(*) from public.listings) as listings_count,
        (select count(*) from public.profiles) as users_count,
        (
            18
            + (select count(*) from public.listings where sold_via_platform is true)
        ) as sold_count;
$$;

grant execute on function public.get_homepage_stats() to anon, authenticated;

-- Spaltenrechte (column-level grants aus harden_profiles_listings_rls)
grant select (sold_via_platform) on table public.listings to anon, authenticated;
grant update (sold_via_platform) on table public.listings to authenticated;
