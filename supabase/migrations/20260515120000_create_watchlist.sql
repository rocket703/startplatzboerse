-- Merkliste: gespeicherte Inserate pro Nutzer
create table if not exists public.watchlist (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    listing_id uuid not null references public.listings (id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (user_id, listing_id)
);

create index if not exists watchlist_user_id_idx on public.watchlist (user_id);
create index if not exists watchlist_listing_id_idx on public.watchlist (listing_id);

alter table public.watchlist enable row level security;

create policy "Users can view own watchlist"
    on public.watchlist
    for select
    using (auth.uid() = user_id);

create policy "Users can add to own watchlist"
    on public.watchlist
    for insert
    with check (auth.uid() = user_id);

create policy "Users can remove from own watchlist"
    on public.watchlist
    for delete
    using (auth.uid() = user_id);
