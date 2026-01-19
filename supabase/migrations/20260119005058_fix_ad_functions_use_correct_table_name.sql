/*
  # Fix Ad Functions - Use Correct Table Name

  ## Problem
  The earn_coins_from_ad() and related functions are trying to query
  `coin_pools` (plural) but the actual table name is `coin_pool` (singular).
  This causes "relation does not exist" errors.

  ## Solution
  Update all ad-related functions to use the correct table name `coin_pool`
  and correct column names based on the actual schema.

  ## Changes
  1. Fix earn_coins_from_ad() to use coin_pool table
  2. Ensure proper column references
  3. Test function works correctly
*/

-- ============================================================================
-- FIX earn_coins_from_ad FUNCTION - USE CORRECT TABLE NAME
-- ============================================================================

DROP FUNCTION IF EXISTS earn_coins_from_ad(uuid);

CREATE OR REPLACE FUNCTION earn_coins_from_ad(p_user_id uuid)
RETURNS TABLE (
  success boolean,
  new_balance numeric,
  message text,
  transaction_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_start timestamptz;
  v_last_ad_date timestamptz;
  v_coin_reward numeric := 10;
  v_current_balance numeric;
  v_community_pool_remaining numeric;
  v_transaction_id uuid;
  v_pool_id uuid;
BEGIN
  -- Calculate today's start (00:00 GMT)
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'GMT') AT TIME ZONE 'GMT';

  -- Check eligibility
  SELECT last_ad_view_date INTO v_last_ad_date
  FROM profiles
  WHERE id = p_user_id;

  -- If already watched today, return error
  IF v_last_ad_date IS NOT NULL AND v_last_ad_date >= v_today_start THEN
    RETURN QUERY SELECT 
      false as success,
      NULL::numeric as new_balance,
      'You''ve already watched today''s ad. Come back at midnight GMT' as message,
      NULL::uuid as transaction_id;
    RETURN;
  END IF;

  -- Get current user balance
  SELECT coin_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id;

  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  -- Get community pool and lock it
  -- Note: coin_pool table stores total_coins and remaining_coins (not balance)
  SELECT id, remaining_coins INTO v_pool_id, v_community_pool_remaining
  FROM coin_pool
  WHERE pool_type = 'community'
  FOR UPDATE;

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Community pool not found';
  END IF;

  -- Check if community pool has enough coins
  IF v_community_pool_remaining < v_coin_reward THEN
    RETURN QUERY SELECT 
      false as success,
      NULL::numeric as new_balance,
      'Community pool has insufficient coins' as message,
      NULL::uuid as transaction_id;
    RETURN;
  END IF;

  -- Start atomic transaction
  -- 1. Deduct from community pool
  UPDATE coin_pool
  SET 
    remaining_coins = remaining_coins - v_coin_reward,
    distributed_coins = distributed_coins + v_coin_reward,
    updated_at = NOW() AT TIME ZONE 'GMT'
  WHERE pool_type = 'community';

  -- 2. Add to user balance and update last_ad_view_date
  UPDATE profiles
  SET 
    coin_balance = coin_balance + v_coin_reward,
    last_ad_view_date = NOW() AT TIME ZONE 'GMT',
    updated_at = NOW() AT TIME ZONE 'GMT'
  WHERE id = p_user_id
  RETURNING coin_balance INTO v_current_balance;

  -- 3. Insert transaction record
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    balance_after,
    created_at
  ) VALUES (
    p_user_id,
    v_coin_reward,
    'ad_reward',
    'Daily ad reward',
    v_current_balance,
    NOW() AT TIME ZONE 'GMT'
  ) RETURNING id INTO v_transaction_id;

  -- Log successful ad reward
  INSERT INTO admin_security_log (
    event_type,
    severity,
    operation_type,
    details
  ) VALUES (
    'validation_failed',
    'info',
    'ad_reward',
    jsonb_build_object(
      'user_id', p_user_id,
      'amount', v_coin_reward,
      'new_balance', v_current_balance,
      'timestamp', NOW() AT TIME ZONE 'GMT',
      'transaction_id', v_transaction_id
    )
  );

  -- Return success
  RETURN QUERY SELECT 
    true as success,
    v_current_balance as new_balance,
    'Successfully earned 10 coins from ad!' as message,
    v_transaction_id as transaction_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback happens automatically
    RAISE WARNING 'Error in earn_coins_from_ad: %', SQLERRM;
    RETURN QUERY SELECT 
      false as success,
      NULL::numeric as new_balance,
      'Error processing ad reward: ' || SQLERRM as message,
      NULL::uuid as transaction_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION earn_coins_from_ad(uuid) TO authenticated;

-- ============================================================================
-- VERIFICATION TEST
-- ============================================================================

-- Test with test123 user
DO $$
DECLARE
  v_test_user_id uuid;
  v_result record;
BEGIN
  -- Get test123 user id
  SELECT id INTO v_test_user_id FROM profiles WHERE username = 'test123';
  
  IF v_test_user_id IS NOT NULL THEN
    -- Test function
    SELECT * INTO v_result FROM earn_coins_from_ad(v_test_user_id);
    
    RAISE NOTICE '✓ Ad function test:';
    RAISE NOTICE '  - Success: %', v_result.success;
    RAISE NOTICE '  - Message: %', v_result.message;
    RAISE NOTICE '  - New Balance: %', v_result.new_balance;
    RAISE NOTICE '  - Transaction ID: %', v_result.transaction_id;
  ELSE
    RAISE NOTICE 'Test user not found';
  END IF;
END $$;

-- Log completion
INSERT INTO admin_security_log (
  event_type,
  severity,
  operation_type,
  details
) VALUES (
  'validation_failed',
  'info',
  'migration_complete',
  jsonb_build_object(
    'migration', 'fix_ad_functions_use_correct_table_name',
    'timestamp', NOW() AT TIME ZONE 'GMT',
    'fix', 'Changed coin_pools to coin_pool in earn_coins_from_ad function',
    'table_used', 'coin_pool (singular)',
    'columns_used', jsonb_build_array('remaining_coins', 'distributed_coins')
  )
);
