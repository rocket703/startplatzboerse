-- Neuregistrierung: PostgREST-Upsert auf profiles braucht Tabellen-Rechte;
-- Zeilen-Zugriff bleibt über RLS (nur auth.uid() = id). Anon hat weiter keinen Zugriff.

grant select, insert, update on table public.profiles to authenticated;

-- Policies idempotent sicherstellen (falls Migration teilweise lief)
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read own profile"
    on public.profiles
    for select
    to authenticated
    using (auth.uid() = id);

create policy "Users can insert own profile"
    on public.profiles
    for insert
    to authenticated
    with check (auth.uid() = id);

create policy "Users can update own profile"
    on public.profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);
