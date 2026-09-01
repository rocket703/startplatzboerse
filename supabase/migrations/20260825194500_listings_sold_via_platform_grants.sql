-- sold_via_platform existiert bereits; Spaltenrechte für Archivieren + Stats-Anzeige
grant select (sold_via_platform) on table public.listings to anon, authenticated;
grant update (sold_via_platform) on table public.listings to authenticated;
