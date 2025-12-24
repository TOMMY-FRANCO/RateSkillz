/*
  # Remove Page View Rewards System

  ## Summary
  Removes the page view reward system that was incorrectly implemented.
  Users should NOT earn coins from profile views.

  ## Changes Made

  ### 1. Remove Page View Reward Functions
  - Drop award_page_view_coins function
  - Drop record_unique_profile_view_with_reward function
  - Drop get_page_view_reward_stats function
  - Restore original record_unique_profile_view function

  ### 2. Remove Page View Reward Table
  - Drop profile_view_rewards table
  - Remove related indexes and policies

  ### 3. Remove Page View Reward Transactions
  - Delete all page_view_reward transactions from coin_transactions
  - Update user balances to remove page view earnings
  - Restore coin pool to correct amount

  ## Important Notes
  - Profile view tracking remains (for stats only, no rewards)
  - Comment rewards remain at 0.1 coins per profile (once per profile)
  - Ad rewards remain at 10 coins per 24 hours GMT
  - Card trading remains at 20 coins starting value
*/

-- Step 1: Remove page view reward transactions and adjust balances
DO $$
DECLARE
  v_total_view_rewards numeric;
  v_user RECORD;
BEGIN
  -- Calculate total page view rewards to reclaim
  SELECT COALESCE(SUM(amount), 0) INTO v_total_view_rewards
  FROM coin_transactions
  WHERE transaction_type = 'page_view_reward';
  
  RAISE NOTICE 'Total page view rewards to reclaim: %', v_total_view_rewards;
  
  -- For each user with page view rewards, remove from their balance
  FOR v_user IN 
    SELECT 
      user_id,
      SUM(amount) as total_view_earnings
    FROM coin_transactions
    WHERE transaction_type = 'page_view_reward'
    GROUP BY user_id
  LOOP
    -- Subtract the view earnings from user balance
    UPDATE coins
    SET 
      balance = balance - v_user.total_view_earnings,
      updated_at = now()
    WHERE user_id = v_user.user_id;
    
    RAISE NOTICE 'Removed % coins from user %', v_user.total_view_earnings, v_user.user_id;
  END LOOP;
  
  -- Delete all page view reward transactions
  DELETE FROM coin_transactions
  WHERE transaction_type = 'page_view_reward';
  
  RAISE NOTICE 'Deleted all page view reward transactions';
  
  -- Update coin pool to reflect removal
  UPDATE coin_pool
  SET 
    distributed_coins = distributed_coins - v_total_view_rewards::bigint,
    remaining_coins = remaining_coins + v_total_view_rewards::bigint,
    updated_at = now()
  WHERE id = (SELECT id FROM coin_pool LIMIT 1);
  
  RAISE NOTICE 'Coin pool updated: % coins returned', v_total_view_rewards;
END $$;

-- Step 2: Drop profile_view_rewards table
DROP TABLE IF EXISTS profile_view_rewards CASCADE;

-- Step 3: Drop page view reward functions
DROP FUNCTION IF EXISTS award_page_view_coins(uuid, uuid);
DROP FUNCTION IF EXISTS record_unique_profile_view_with_reward(uuid, uuid);
DROP FUNCTION IF EXISTS get_page_view_reward_stats(uuid);

-- Step 4: Restore original record_unique_profile_view function (without rewards)
CREATE OR REPLACE FUNCTION record_unique_profile_view(
  p_profile_id uuid,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_count integer;
  v_view_recorded boolean := false;
BEGIN
  -- Don't record if viewer is null (anonymous)
  IF p_viewer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'message', 'Anonymous views are not counted'
    );
  END IF;

  -- Don't record if viewer is the profile owner
  IF p_viewer_id = p_profile_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'message', 'Self-views are not counted'
    );
  END IF;

  -- Try to insert view record with ON CONFLICT to handle race conditions
  INSERT INTO profile_views (profile_id, viewer_id, viewed_at)
  VALUES (p_profile_id, p_viewer_id, now())
  ON CONFLICT (profile_id, viewer_id) WHERE viewer_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_view_recorded;

  -- If a new view was recorded, increment the counter
  IF v_view_recorded IS NOT NULL THEN
    UPDATE profiles
    SET profile_views_count = COALESCE(profile_views_count, 0) + 1
    WHERE id = p_profile_id
    RETURNING profile_views_count INTO v_new_count;

    RETURN jsonb_build_object(
      'success', true,
      'counted', true,
      'new_count', v_new_count,
      'message', 'View recorded successfully'
    );
  ELSE
    -- View already existed, don't count again
    SELECT profile_views_count INTO v_new_count
    FROM profiles
    WHERE id = p_profile_id;

    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'current_count', v_new_count,
      'message', 'View already recorded for this user'
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'counted', false,
      'error', SQLERRM
    );
END;
$$;

-- Step 5: Verify final state
DO $$
DECLARE
  v_pool_state RECORD;
BEGIN
  SELECT * INTO v_pool_state FROM coin_pool LIMIT 1;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PAGE VIEW REWARDS REMOVED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Coin Pool Status:';
  RAISE NOTICE '  Total: %', v_pool_state.total_coins;
  RAISE NOTICE '  Distributed: %', v_pool_state.distributed_coins;
  RAISE NOTICE '  Remaining: %', v_pool_state.remaining_coins;
  RAISE NOTICE '========================================';
END $$;
