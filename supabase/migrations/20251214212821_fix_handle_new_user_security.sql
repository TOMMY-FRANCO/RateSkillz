/*
  # Fix handle_new_user Function Security

  ## Overview
  Fixes the security warning by setting an immutable search_path on the function.

  ## Changes Made
  - Recreates the handle_new_user function with proper search_path
  - Ensures the function runs securely with SECURITY DEFINER
  - Sets search_path to prevent injection attacks

  ## Security Notes
  - Function now has immutable search_path set to public
  - Prevents potential security vulnerabilities
*/

-- Recreate function with proper security settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, full_name, created_at, updated_at, last_active)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;