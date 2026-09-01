-- Homepage-Zähler bleiben erhalten, auch wenn Inserate gelöscht werden.
-- listings_total: +1 bei jedem neuen Inserat, nie − beim Löschen
-- sold_total: +1 bei „über Plattform verkauft“, nie − beim Löschen

create table if not exists public.site_counters (
    id int primary key default 1 check (id = 1),
    listings_total bigint not null default 0,
    sold_total bigint not null default 18
);

comment on table public.site_counters is
    'Singleton für Homepage-Kennzahlen; Werte steigen nur, sinken nie beim Löschen von Inseraten.';

alter table public.site_counters
    add column if not exists listings_total bigint not null default 0;

alter table public.site_counters
    add column if not exists sold_total bigint not null default 18;

insert into public.site_counters (id, listings_total, sold_total)
values (
    1,
    coalesce((select count(*)::bigint from public.listings), 0),
    18 + coalesce((select count(*)::bigint from public.listings where sold_via_platform is true), 0)
)
on conflict (id) do update set
    listings_total = greatest(
        site_counters.listings_total,
        excluded.listings_total
    ),
    sold_total = greatest(
        site_counters.sold_total,
        excluded.sold_total
    );

create or replace function public.trg_listings_insert_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.site_counters (id, listings_total, sold_total)
    values (1, 1, 18)
    on conflict (id) do update
        set listings_total = site_counters.listings_total + 1;
    return NEW;
end;
$$;

drop trigger if exists listings_insert_stats on public.listings;
create trigger listings_insert_stats
    after insert on public.listings
    for each row
    execute function public.trg_listings_insert_stats();

create or replace function public.trg_listings_sold_via_platform_inc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if NEW.sold_via_platform is true
       and (TG_OP = 'INSERT' or OLD.sold_via_platform is distinct from true)
    then
        insert into public.site_counters (id, listings_total, sold_total)
        values (1, 0, 19)
        on conflict (id) do update
            set sold_total = site_counters.sold_total + 1;
    end if;
    return NEW;
end;
$$;

drop trigger if exists listings_sold_via_platform_inc on public.listings;
create trigger listings_sold_via_platform_inc
    after insert or update of sold_via_platform on public.listings
    for each row
    execute function public.trg_listings_sold_via_platform_inc();

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
        coalesce((select listings_total from public.site_counters where id = 1), 0::bigint) as listings_count,
        (select count(*) from public.profiles) as users_count,
        coalesce((select sold_total from public.site_counters where id = 1), 18::bigint) as sold_count;
$$;

grant execute on function public.get_homepage_stats() to anon, authenticated;
grant select on table public.site_counters to anon, authenticated;
