/*
  # Add has_social_badge to profile_summary table

  ## Summary
  The profile_summary table is missing the has_social_badge column that exists on profiles.
  This migration:
  1. Adds has_social_badge column to profile_summary (boolean, default false)
  2. Backfills the column from the profiles table for all existing rows
  3. Adds a trigger to keep profile_summary.has_social_badge in sync when profiles.has_social_badge changes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_summary'
      AND column_name = 'has_social_badge'
  ) THEN
    ALTER TABLE public.profile_summary ADD COLUMN has_social_badge boolean NOT NULL DEFAULT false;
  END IF;
END $$;

UPDATE public.profile_summary ps
SET has_social_badge = p.has_social_badge
FROM public.profiles p
WHERE ps.user_id = p.id;

CREATE OR REPLACE FUNCTION public.sync_profile_summary_social_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.has_social_badge IS DISTINCT FROM OLD.has_social_badge THEN
    UPDATE public.profile_summary
    SET has_social_badge = NEW.has_social_badge
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_summary_social_badge ON public.profiles;

CREATE TRIGGER trg_sync_profile_summary_social_badge
AFTER UPDATE OF has_social_badge ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_summary_social_badge();
