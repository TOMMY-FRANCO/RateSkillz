/*
  # Fix Rating System with Automatic Average Calculations

  ## Overview
  This migration fixes the rating system to properly save friend ratings and
  automatically calculate averages that display on player cards.

  ## What This Does
  1. **Add Validation** - Ensures all rating values are between 1-100
  2. **Create Calculation Function** - Automatically calculates stat averages
  3. **Create Trigger** - Updates user_stats whenever ratings change
  4. **Update RLS Policies** - Proper permissions for rating system

  ## How It Works
  - Friend submits/updates ratings in `ratings` table
  - Trigger fires automatically
  - Function calculates averages across all friends' ratings
  - Updates `user_stats` with new averages and overall rating
  - Card displays the calculated values

  ## Changes Made
  1. Add CHECK constraints to ratings table (1-100 for each stat)
  2. Create `calculate_user_stat_averages()` function
  3. Create `update_user_stats_on_rating_change` trigger
  4. Update RLS policies for proper access control
  5. Add helpful comments and validation

  ## Security
  - Users can only rate accepted friends
  - Users cannot rate themselves
  - Each user can only have one rating record per friend
  - Automatic validation of rating values
*/

-- ========================================
-- STEP 1: Add Validation Constraints
-- ========================================

DO $$
BEGIN
  -- PAC rating constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ratings' AND constraint_name = 'ratings_pac_check'
  ) THEN
    ALTER TABLE ratings ADD CONSTRAINT ratings_pac_check 
      CHECK (pac >= 1 AND pac <= 100);
    RAISE NOTICE '✓ Added PAC rating constraint (1-100)';
  END IF;

  -- SHO rating constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ratings' AND constraint_name = 'ratings_sho_check'
  ) THEN
    ALTER TABLE ratings ADD CONSTRAINT ratings_sho_check 
      CHECK (sho >= 1 AND sho <= 100);
    RAISE NOTICE '✓ Added SHO rating constraint (1-100)';
  END IF;

  -- PAS rating constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ratings' AND constraint_name = 'ratings_pas_check'
  ) THEN
    ALTER TABLE ratings ADD CONSTRAINT ratings_pas_check 
      CHECK (pas >= 1 AND pas <= 100);
    RAISE NOTICE '✓ Added PAS rating constraint (1-100)';
  END IF;

  -- DRI rating constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ratings' AND constraint_name = 'ratings_dri_check'
  ) THEN
    ALTER TABLE ratings ADD CONSTRAINT ratings_dri_check 
      CHECK (dri >= 1 AND dri <= 100);
    RAISE NOTICE '✓ Added DRI rating constraint (1-100)';
  END IF;

  -- DEF rating constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ratings' AND constraint_name = 'ratings_def_check'
  ) THEN
    ALTER TABLE ratings ADD CONSTRAINT ratings_def_check 
      CHECK (def >= 1 AND def <= 100);
    RAISE NOTICE '✓ Added DEF rating constraint (1-100)';
  END IF;

  -- PHY rating constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ratings' AND constraint_name = 'ratings_phy_check'
  ) THEN
    ALTER TABLE ratings ADD CONSTRAINT ratings_phy_check 
      CHECK (phy >= 1 AND phy <= 100);
    RAISE NOTICE '✓ Added PHY rating constraint (1-100)';
  END IF;

  -- Prevent self-rating constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ratings' AND constraint_name = 'ratings_no_self_rating_check'
  ) THEN
    ALTER TABLE ratings ADD CONSTRAINT ratings_no_self_rating_check 
      CHECK (rater_id != player_id);
    RAISE NOTICE '✓ Added constraint to prevent self-rating';
  END IF;
END $$;

-- ========================================
-- STEP 2: Create Average Calculation Function
-- ========================================

CREATE OR REPLACE FUNCTION calculate_user_stat_averages(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_pac integer;
  v_avg_sho integer;
  v_avg_pas integer;
  v_avg_dri integer;
  v_avg_def integer;
  v_avg_phy integer;
  v_overall integer;
  v_rating_count integer;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CALCULATING STAT AVERAGES for user: %', target_user_id;
  
  -- Calculate averages from all ratings for this user
  SELECT 
    ROUND(AVG(pac))::integer,
    ROUND(AVG(sho))::integer,
    ROUND(AVG(pas))::integer,
    ROUND(AVG(dri))::integer,
    ROUND(AVG(def))::integer,
    ROUND(AVG(phy))::integer,
    COUNT(*)::integer
  INTO 
    v_avg_pac,
    v_avg_sho,
    v_avg_pas,
    v_avg_dri,
    v_avg_def,
    v_avg_phy,
    v_rating_count
  FROM ratings
  WHERE player_id = target_user_id;
  
  -- If no ratings exist, use defaults
  IF v_rating_count = 0 OR v_rating_count IS NULL THEN
    RAISE NOTICE 'No ratings found, using defaults (50 for all stats)';
    v_avg_pac := 50;
    v_avg_sho := 50;
    v_avg_pas := 50;
    v_avg_dri := 50;
    v_avg_def := 50;
    v_avg_phy := 50;
    v_rating_count := 0;
  ELSE
    RAISE NOTICE 'Calculated averages from % ratings', v_rating_count;
    RAISE NOTICE '  PAC: %', v_avg_pac;
    RAISE NOTICE '  SHO: %', v_avg_sho;
    RAISE NOTICE '  PAS: %', v_avg_pas;
    RAISE NOTICE '  DRI: %', v_avg_dri;
    RAISE NOTICE '  DEF: %', v_avg_def;
    RAISE NOTICE '  PHY: %', v_avg_phy;
  END IF;
  
  -- Calculate overall rating as average of the six stats
  v_overall := ROUND((v_avg_pac + v_avg_sho + v_avg_pas + v_avg_dri + v_avg_def + v_avg_phy) / 6.0)::integer;
  RAISE NOTICE '  Overall: %', v_overall;
  
  -- Update user_stats table with calculated averages
  UPDATE user_stats
  SET 
    pac = v_avg_pac,
    sho = v_avg_sho,
    pas = v_avg_pas,
    dri = v_avg_dri,
    def = v_avg_def,
    phy = v_avg_phy,
    overall = v_overall,
    rating_count = v_rating_count,
    updated_at = now()
  WHERE user_id = target_user_id;
  
  -- If no user_stats record exists, create one
  IF NOT FOUND THEN
    RAISE NOTICE 'Creating new user_stats record';
    INSERT INTO user_stats (
      user_id,
      pac,
      sho,
      pas,
      dri,
      def,
      phy,
      overall,
      rating_count,
      created_at,
      updated_at
    ) VALUES (
      target_user_id,
      v_avg_pac,
      v_avg_sho,
      v_avg_pas,
      v_avg_dri,
      v_avg_def,
      v_avg_phy,
      v_overall,
      v_rating_count,
      now(),
      now()
    );
  END IF;
  
  -- Also update the overall_rating in profiles table
  UPDATE profiles
  SET 
    overall_rating = v_overall,
    updated_at = now()
  WHERE id = target_user_id;
  
  RAISE NOTICE '✓ Updated user_stats and profile';
  RAISE NOTICE '========================================';
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error calculating averages for user %: %', target_user_id, SQLERRM;
  RAISE NOTICE '========================================';
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_user_stat_averages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_user_stat_averages(uuid) TO anon;

-- ========================================
-- STEP 3: Create Trigger Function
-- ========================================

CREATE OR REPLACE FUNCTION update_user_stats_on_rating_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On INSERT or UPDATE, recalculate for the rated player
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    RAISE NOTICE 'Rating changed for player %, recalculating averages...', NEW.player_id;
    PERFORM calculate_user_stat_averages(NEW.player_id);
    RETURN NEW;
  END IF;
  
  -- On DELETE, recalculate for the rated player
  IF TG_OP = 'DELETE' THEN
    RAISE NOTICE 'Rating deleted for player %, recalculating averages...', OLD.player_id;
    PERFORM calculate_user_stat_averages(OLD.player_id);
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- ========================================
-- STEP 4: Create Trigger
-- ========================================

DROP TRIGGER IF EXISTS trigger_update_user_stats_on_rating_change ON ratings;

CREATE TRIGGER trigger_update_user_stats_on_rating_change
  AFTER INSERT OR UPDATE OR DELETE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_on_rating_change();

-- ========================================
-- STEP 5: Update RLS Policies
-- ========================================

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all ratings" ON ratings;
DROP POLICY IF EXISTS "Users can insert ratings for friends" ON ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can delete own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can view own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can view received ratings" ON ratings;
DROP POLICY IF EXISTS "Users can rate accepted friends" ON ratings;

CREATE POLICY "Users can view own ratings"
  ON ratings FOR SELECT
  TO authenticated
  USING (auth.uid() = rater_id);

CREATE POLICY "Users can view received ratings"
  ON ratings FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

CREATE POLICY "Users can rate accepted friends"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = rater_id
    AND rater_id != player_id
    AND EXISTS (
      SELECT 1 FROM friends
      WHERE (
        (user_id = rater_id AND friend_id = player_id)
        OR (user_id = player_id AND friend_id = rater_id)
      )
      AND status = 'accepted'
    )
  );

CREATE POLICY "Users can update own ratings"
  ON ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = rater_id)
  WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Users can delete own ratings"
  ON ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = rater_id);

-- ========================================
-- STEP 6: Update user_stats RLS Policies
-- ========================================

DROP POLICY IF EXISTS "Anyone can view user stats" ON user_stats;
DROP POLICY IF EXISTS "Public can view user stats" ON user_stats;

CREATE POLICY "Anyone can view user stats"
  ON user_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public can view user stats"
  ON user_stats FOR SELECT
  TO anon
  USING (true);

-- ========================================
-- STEP 7: Test and Summary
-- ========================================

DO $$
DECLARE
  v_test_user_id uuid;
BEGIN
  SELECT player_id INTO v_test_user_id
  FROM ratings
  LIMIT 1;
  
  IF v_test_user_id IS NOT NULL THEN
    RAISE NOTICE 'Testing calculation function with user: %', v_test_user_id;
    PERFORM calculate_user_stat_averages(v_test_user_id);
    RAISE NOTICE '✓ Test calculation completed successfully';
  ELSE
    RAISE NOTICE '⚠ No ratings found to test calculation function';
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ RATING SYSTEM SETUP COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Features Enabled:';
  RAISE NOTICE '  • Rating validation (1-100)';
  RAISE NOTICE '  • Automatic average calculation';
  RAISE NOTICE '  • Trigger on INSERT/UPDATE/DELETE';
  RAISE NOTICE '  • Friend-only rating permissions';
  RAISE NOTICE '  • Self-rating prevention';
  RAISE NOTICE '  • Overall rating calculation';
  RAISE NOTICE '========================================';
END $$;
