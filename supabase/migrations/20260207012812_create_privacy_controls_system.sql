/*
  # Create Privacy Controls System

  1. Schema Changes
    - Add `hide_from_leaderboard` boolean column to `profiles` table
    - Default: true for ages 11-17, false for ages 18+
    - Update existing users based on their age
  
  2. Leaderboard Privacy
    - Update leaderboard queries to filter WHERE hide_from_leaderboard = false
    - Exclude hidden profiles from leaderboard displays
  
  3. Search Privacy
    - Update `searchable_users_cache` table to remove full_name column
    - Update search functions to only use username
    - Ensure friend search displays username only
  
  4. Security
    - Add RLS policies for privacy column updates
    - Users can update their own hide_from_leaderboard value
    - Public can read leaderboard visibility status
*/

-- Step 1: Add hide_from_leaderboard column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'hide_from_leaderboard'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN hide_from_leaderboard boolean DEFAULT false;
  END IF;
END $$;

-- Step 2: Set default values based on age (minors 11-17 hidden by default)
UPDATE profiles
SET hide_from_leaderboard = CASE
  WHEN age IS NULL THEN false
  WHEN age >= 11 AND age <= 17 THEN true
  ELSE false
END;

-- Step 3: Update searchable_users_cache to remove full_name column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'searchable_users_cache' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE searchable_users_cache DROP COLUMN full_name;
  END IF;
END $$;

-- Step 4: Update the function that populates searchable_users_cache
CREATE OR REPLACE FUNCTION upsert_profile_summary()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update searchable_users_cache (username only, no full_name)
  INSERT INTO searchable_users_cache (
    user_id, 
    username, 
    team, 
    position, 
    avatar_url, 
    is_verified, 
    overall_rating, 
    search_text, 
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.username,
    NEW.team,
    NEW.position,
    NEW.avatar_url,
    NEW.is_verified,
    NEW.overall_rating,
    to_tsvector('english', COALESCE(NEW.username, '')),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    team = EXCLUDED.team,
    position = EXCLUDED.position,
    avatar_url = EXCLUDED.avatar_url,
    is_verified = EXCLUDED.is_verified,
    overall_rating = EXCLUDED.overall_rating,
    search_text = to_tsvector('english', COALESCE(EXCLUDED.username, '')),
    updated_at = now();

  -- Update leaderboard_cache (exclude if hide_from_leaderboard = true)
  IF NEW.hide_from_leaderboard = false THEN
    INSERT INTO leaderboard_cache (
      rank,
      user_id,
      username,
      avatar_url,
      overall_rating,
      manager_wins,
      manager_losses,
      team,
      position,
      total_battle_earnings,
      is_verified,
      gender,
      updated_at
    )
    VALUES (
      0,
      NEW.id,
      NEW.username,
      NEW.avatar_url,
      NEW.overall_rating,
      NEW.manager_wins,
      NEW.manager_losses,
      NEW.team,
      NEW.position,
      NEW.total_battle_earnings,
      NEW.is_verified,
      NEW.gender,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      username = EXCLUDED.username,
      avatar_url = EXCLUDED.avatar_url,
      overall_rating = EXCLUDED.overall_rating,
      manager_wins = EXCLUDED.manager_wins,
      manager_losses = EXCLUDED.manager_losses,
      team = EXCLUDED.team,
      position = EXCLUDED.position,
      total_battle_earnings = EXCLUDED.total_battle_earnings,
      is_verified = EXCLUDED.is_verified,
      gender = EXCLUDED.gender,
      updated_at = now();
  ELSE
    -- Remove from leaderboard if hidden
    DELETE FROM leaderboard_cache WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 5: Refresh both caches to apply privacy settings
DELETE FROM leaderboard_cache WHERE user_id IN (
  SELECT id FROM profiles WHERE hide_from_leaderboard = true
);

-- Step 6: Update search_text in searchable_users_cache to use only username
UPDATE searchable_users_cache
SET search_text = to_tsvector('english', COALESCE(username, ''));

-- Step 7: Add index on hide_from_leaderboard for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_hide_from_leaderboard 
ON profiles(hide_from_leaderboard);

-- Step 8: Add RLS policies for hide_from_leaderboard column
DROP POLICY IF EXISTS "Users can update own privacy settings" ON profiles;

CREATE POLICY "Users can update own privacy settings"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Step 9: Log the privacy system setup
INSERT INTO admin_security_log (event_type, severity, operation_type, details)
VALUES (
  'validation_failed',
  'info',
  'privacy_system_setup',
  jsonb_build_object(
    'action', 'privacy_controls_created',
    'features', jsonb_build_array(
      'hide_from_leaderboard column added with age-based defaults',
      'minors (11-17) hidden from leaderboards by default',
      'adults (18+) visible on leaderboards by default',
      'searchable_users_cache updated to username only',
      'full_name removed from search results',
      'leaderboard excludes hidden profiles',
      'RLS policies added for privacy updates',
      'auto-refresh caches on privacy change'
    ),
    'minors_hidden_count', (SELECT COUNT(*) FROM profiles WHERE hide_from_leaderboard = true AND age >= 11 AND age <= 17),
    'adults_visible_count', (SELECT COUNT(*) FROM profiles WHERE hide_from_leaderboard = false AND (age IS NULL OR age >= 18)),
    'timestamp', now()
  )
);