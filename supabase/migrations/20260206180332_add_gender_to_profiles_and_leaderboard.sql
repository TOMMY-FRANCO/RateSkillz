/*
  # Add gender field to profiles and leaderboard

  1. Modified Tables
    - `profiles`
      - `gender` (text, nullable) - stores 'male' or 'female'
    - `leaderboard_cache`
      - `gender` (text, nullable) - cached gender for leaderboard display

  2. Modified Functions
    - `recompute_leaderboard_cache` - now includes gender column
    - `trg_profiles_leaderboard_change` - recomputes when gender changes

  3. Security
    - Gender column inherits existing RLS policies on profiles
    - Gender on leaderboard_cache inherits existing cache policies
    - No new policies needed (existing table policies cover this)

  4. Notes
    - Gender is only displayed on the leaderboard (M/F)
    - Not exposed on profile cards, public profiles, or search results
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'gender'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gender text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaderboard_cache' AND column_name = 'gender'
  ) THEN
    ALTER TABLE leaderboard_cache ADD COLUMN gender text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION recompute_leaderboard_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  CREATE TEMP TABLE tmp_leaderboard AS
  SELECT
    ROW_NUMBER() OVER (ORDER BY overall_rating DESC, created_at ASC) AS rn,
    id AS user_id,
    username,
    avatar_url,
    overall_rating,
    manager_wins,
    manager_losses,
    team,
    position,
    total_battle_earnings,
    is_verified,
    gender
  FROM public.profiles
  WHERE overall_rating IS NOT NULL
  ORDER BY overall_rating DESC, created_at ASC
  LIMIT 500;

  TRUNCATE public.leaderboard_cache;

  INSERT INTO public.leaderboard_cache (
    rank, user_id, username, avatar_url, overall_rating, manager_wins, manager_losses, team, position, total_battle_earnings, is_verified, gender, updated_at
  )
  SELECT rn, user_id, username, avatar_url, overall_rating, manager_wins, manager_losses, team, position, total_battle_earnings, is_verified, gender, now()
  FROM tmp_leaderboard;

  DROP TABLE IF EXISTS tmp_leaderboard;
END;
$$;

CREATE OR REPLACE FUNCTION trg_profiles_leaderboard_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR
     (TG_OP = 'UPDATE' AND (
        NEW.overall_rating IS DISTINCT FROM OLD.overall_rating OR
        NEW.created_at IS DISTINCT FROM OLD.created_at OR
        NEW.manager_wins IS DISTINCT FROM OLD.manager_wins OR
        NEW.manager_losses IS DISTINCT FROM OLD.manager_losses OR
        NEW.total_battle_earnings IS DISTINCT FROM OLD.total_battle_earnings OR
        NEW.is_verified IS DISTINCT FROM OLD.is_verified OR
        NEW.gender IS DISTINCT FROM OLD.gender
     )) OR
     (TG_OP = 'DELETE') THEN
    PERFORM public.recompute_leaderboard_cache();
  END IF;
  RETURN NEW;
END;
$$;

SELECT public.recompute_leaderboard_cache();
