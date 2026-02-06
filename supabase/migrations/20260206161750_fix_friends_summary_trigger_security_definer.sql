/*
  # Fix friends summary trigger to use SECURITY DEFINER

  1. Problem
    - `trg_friends_upsert_summary` runs as SECURITY INVOKER
    - `profile_summary` table RLS denies all INSERT/UPDATE for regular users
    - Adding a friend triggers a write to `profile_summary` which gets blocked by RLS

  2. Fix
    - Recreate `trg_friends_upsert_summary` as SECURITY DEFINER so it bypasses RLS
    - Add search_path restriction for safety
*/

CREATE OR REPLACE FUNCTION public.trg_friends_upsert_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.upsert_profile_summary(NEW.user_id);
    PERFORM public.upsert_profile_summary(NEW.friend_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM public.upsert_profile_summary(NEW.user_id);
    PERFORM public.upsert_profile_summary(NEW.friend_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.upsert_profile_summary(OLD.user_id);
    PERFORM public.upsert_profile_summary(OLD.friend_id);
  END IF;
  RETURN NEW;
END;
$$;
