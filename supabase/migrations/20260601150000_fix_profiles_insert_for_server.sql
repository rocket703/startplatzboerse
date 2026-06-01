-- Fix: Registrierung war nach harden_profiles_listings_rls.sql broken.
  -- App nutzt eigenes OTP/JWT-System mit pg direkt (kein Supabase Auth),
  -- daher kann auth.uid() nie erfüllt werden. Server braucht freien INSERT.

GRANT INSERT (id, registered_email, nickname, has_completed_onboarding)
    ON TABLE public.profiles TO anon;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Server can insert profile"
    ON public.profiles
    FOR INSERT
    TO anon
    WITH CHECK (true);
