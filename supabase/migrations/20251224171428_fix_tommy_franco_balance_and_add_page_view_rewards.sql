/*
  # Fix TOMMY_FRANCO Balance and Implement Page View Coin Rewards

  ## Summary
  Fixes TOMMY_FRANCO's coin balance by reclaiming the old comment reward (1.0 coin)
  and applying the correct rate (0.1 coin). Implements a new page view reward system
  that awards 0.1 coins per unique profile view.

  ## Changes Made

  ### 1. Balance Correction for TOMMY_FRANCO
  - Reclaim 1.0 coins back to master pool
  - Award 0.1 coins at new rate
  - Update balance to reflect correct amount
  - Log all transactions for audit trail

  ### 2. Page View Rewards System
  - Award 0.1 coins to profile owner when someone views their profile
  - Track page view coin eligibility to prevent duplicates
  - Only award once per unique viewer (already enforced by profile_views unique constraint)
  - All coins deducted from master 1 billion coin pool

  ### 3. New Table: profile_view_rewards
  - Tracks which profile views have already awarded coins
  - Prevents duplicate coin rewards for same view
  - Links to profile_views table for data integrity

  ### 4. Updated Functions
  - `record_unique_profile_view_with_reward` - Records view and awards coins if eligible
  - `award_page_view_coins` - Awards coins for profile view
  - Enhanced error handling and validation

  ### 5. Transaction Logging
  - All coin movements logged in coin_transactions table
  - Transaction type: 'page_view_reward'
  - Includes viewer_id as reference for traceability
  - Full audit trail maintained

  ## Security
  - RLS policies maintained on all tables
  - Validation: Pool must have sufficient coins before distribution
  - Prevention of duplicate rewards through unique constraints
  - Safe handling of concurrent requests

  ## Important Notes
  - Page view rewards only trigger for NEW unique views after this migration
  - Existing profile views do NOT retroactively award coins
  - Self-views never award coins (viewer cannot be profile owner)
  - Anonymous views never award coins (viewer must be authenticated)
*/

-- Step 1: Fix TOMMY_FRANCO's balance
DO $$
DECLARE
  v_tommy_user_id uuid;
  v_current_balance numeric;
  v_pool_remaining bigint;
BEGIN
  -- Get TOMMY_FRANCO's user ID
  SELECT id INTO v_tommy_user_id
  FROM profiles
  WHERE username = 'tommy_franco';

  IF v_tommy_user_id IS NULL THEN
    RAISE NOTICE 'User tommy_franco not found';
    RETURN;
  END IF;

  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM coins
  WHERE user_id = v_tommy_user_id;

  RAISE NOTICE 'TOMMY_FRANCO current balance: %', v_current_balance;

  -- Calculate what the balance should be from transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_current_balance
  FROM coin_transactions
  WHERE user_id = v_tommy_user_id;

  RAISE NOTICE 'Balance from transactions: %', v_current_balance;

  -- Reclaim 1.0 coins back to pool (from old comment reward rate)
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    v_tommy_user_id,
    -1.00,
    'comment_reward_correction',
    'Balance correction: Reclaim old comment reward rate (1.0 coin)'
  );

  -- Award 0.1 coins at new rate
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    v_tommy_user_id,
    0.10,
    'comment_reward_correction',
    'Balance correction: Apply new comment reward rate (0.1 coin)'
  );

  RAISE NOTICE '✓ TOMMY_FRANCO balance corrected';

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error fixing TOMMY_FRANCO balance: %', SQLERRM;
END $$;

-- Step 2: Create profile_view_rewards table to track coin awards
CREATE TABLE IF NOT EXISTS profile_view_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  viewer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  coin_amount numeric(10, 2) NOT NULL DEFAULT 0.10,
  transaction_id uuid REFERENCES coin_transactions(id) ON DELETE SET NULL,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, viewer_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_profile_view_rewards_profile_id ON profile_view_rewards(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_view_rewards_viewer_id ON profile_view_rewards(viewer_id);
CREATE INDEX IF NOT EXISTS idx_profile_view_rewards_awarded_at ON profile_view_rewards(awarded_at);

-- Enable RLS
ALTER TABLE profile_view_rewards ENABLE ROW LEVEL SECURITY;

-- Users can view rewards for their own profiles
CREATE POLICY "Users can view own profile view rewards"
  ON profile_view_rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

-- Only system can insert rewards
CREATE POLICY "System can manage profile view rewards"
  ON profile_view_rewards FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 3: Drop and recreate function to award page view coins
DROP FUNCTION IF EXISTS award_page_view_coins(uuid, uuid);

CREATE FUNCTION award_page_view_coins(
  p_profile_id uuid,
  p_viewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pool_remaining bigint;
  v_coin_amount numeric := 0.10;
  v_transaction_id uuid;
  v_new_balance numeric;
  v_reward_exists boolean;
BEGIN
  -- Validate inputs
  IF p_profile_id IS NULL OR p_viewer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'awarded', false,
      'error', 'Profile ID and Viewer ID are required'
    );
  END IF;

  -- Don't award for self-views
  IF p_profile_id = p_viewer_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'awarded', false,
      'message', 'Self-views do not earn coins'
    );
  END IF;

  -- Check if reward already exists for this view
  SELECT EXISTS(
    SELECT 1 FROM profile_view_rewards
    WHERE profile_id = p_profile_id AND viewer_id = p_viewer_id
  ) INTO v_reward_exists;

  IF v_reward_exists THEN
    RETURN jsonb_build_object(
      'success', true,
      'awarded', false,
      'message', 'Reward already awarded for this view'
    );
  END IF;

  -- Check if pool has sufficient coins
  SELECT remaining_coins INTO v_pool_remaining
  FROM coin_pool
  LIMIT 1;

  IF v_pool_remaining IS NULL OR v_pool_remaining < v_coin_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'awarded', false,
      'error', 'Insufficient coins in pool'
    );
  END IF;

  -- Create transaction record
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    reference_id
  )
  VALUES (
    p_profile_id,
    v_coin_amount,
    'page_view_reward',
    'Earned coins from profile view',
    p_viewer_id
  )
  RETURNING id INTO v_transaction_id;

  -- Record the reward
  INSERT INTO profile_view_rewards (
    profile_id,
    viewer_id,
    coin_amount,
    transaction_id
  )
  VALUES (
    p_profile_id,
    p_viewer_id,
    v_coin_amount,
    v_transaction_id
  );

  -- Get updated balance
  SELECT balance INTO v_new_balance
  FROM coins
  WHERE user_id = p_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'awarded', true,
    'amount', v_coin_amount,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id,
    'message', 'Page view coins awarded successfully'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', true,
      'awarded', false,
      'message', 'Reward already awarded for this view'
    );
  WHEN OTHERS THEN
    RAISE WARNING 'Error awarding page view coins: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'awarded', false,
      'error', SQLERRM
    );
END;
$$;

-- Step 4: Update record_unique_profile_view to award coins automatically
DROP FUNCTION IF EXISTS record_unique_profile_view_with_reward(uuid, uuid);

CREATE FUNCTION record_unique_profile_view_with_reward(
  p_profile_id uuid,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_reward_result jsonb;
  v_new_count integer;
  v_view_recorded boolean := false;
BEGIN
  -- Don't record if viewer is null (anonymous)
  IF p_viewer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'coins_awarded', false,
      'message', 'Anonymous views are not counted'
    );
  END IF;

  -- Don't record if viewer is the profile owner
  IF p_viewer_id = p_profile_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'coins_awarded', false,
      'message', 'Self-views are not counted'
    );
  END IF;

  -- Try to insert view record with ON CONFLICT to handle race conditions
  INSERT INTO profile_views (profile_id, viewer_id, viewed_at)
  VALUES (p_profile_id, p_viewer_id, now())
  ON CONFLICT (profile_id, viewer_id) WHERE viewer_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_view_recorded;

  -- If a new view was recorded
  IF v_view_recorded IS NOT NULL THEN
    -- Increment the view counter
    UPDATE profiles
    SET profile_views_count = COALESCE(profile_views_count, 0) + 1
    WHERE id = p_profile_id
    RETURNING profile_views_count INTO v_new_count;

    -- Award coins for the page view
    v_reward_result := award_page_view_coins(p_profile_id, p_viewer_id);

    RETURN jsonb_build_object(
      'success', true,
      'counted', true,
      'new_count', v_new_count,
      'coins_awarded', (v_reward_result->>'awarded')::boolean,
      'coin_amount', v_reward_result->>'amount',
      'message', 'View recorded and coins awarded'
    );
  ELSE
    -- View already existed, don't count again
    SELECT profile_views_count INTO v_new_count
    FROM profiles
    WHERE id = p_profile_id;

    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'coins_awarded', false,
      'current_count', v_new_count,
      'message', 'View already recorded for this user'
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'counted', false,
      'coins_awarded', false,
      'error', SQLERRM
    );
END;
$$;

-- Step 5: Create helper function to get page view reward stats
DROP FUNCTION IF EXISTS get_page_view_reward_stats(uuid);

CREATE FUNCTION get_page_view_reward_stats(p_user_id uuid)
RETURNS TABLE (
  total_views_received integer,
  total_coins_earned numeric,
  unique_viewers integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_views_received,
    COALESCE(SUM(coin_amount), 0) as total_coins_earned,
    COUNT(DISTINCT viewer_id)::integer as unique_viewers
  FROM profile_view_rewards
  WHERE profile_id = p_user_id;
END;
$$;

-- Step 6: Verify coin pool integrity
DO $$
DECLARE
  v_actual_distributed numeric;
  v_pool_remaining bigint;
BEGIN
  -- Calculate actual distributed coins from all positive transactions
  SELECT COALESCE(SUM(amount), 0)
  INTO v_actual_distributed
  FROM coin_transactions
  WHERE amount > 0;
  
  RAISE NOTICE 'Total coins distributed: %', v_actual_distributed;
  
  -- Update coin pool to match
  UPDATE coin_pool
  SET 
    distributed_coins = v_actual_distributed::bigint,
    remaining_coins = total_coins - v_actual_distributed::bigint,
    updated_at = now()
  WHERE id = (SELECT id FROM coin_pool LIMIT 1)
  RETURNING remaining_coins INTO v_pool_remaining;
  
  RAISE NOTICE 'Coin pool updated: % remaining', v_pool_remaining;
END $$;
