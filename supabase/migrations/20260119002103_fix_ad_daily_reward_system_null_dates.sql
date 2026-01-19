/*
  # Fix Ad Daily Reward System - NULL Dates & Reset Logic

  ## Problem
  Ad watching is broken because profiles.last_ad_view_date is NULL for all users,
  causing the system to incorrectly determine eligibility.

  ## Solution
  1. Update all NULL last_ad_view_date values to 7 days ago
  2. Create check_daily_ad_eligibility() function with proper GMT timezone handling
  3. Fix earn_coins_from_ad() function to be atomic and handle GMT properly
  4. Add proper error messages and loading states

  ## Rules
  - Each user can watch ONE ad per day
  - Reward: 10 coins from community pool
  - Reset: 00:00 GMT daily (midnight UK time)
  - All operations atomic (rollback if any fails)

  ## Changes
  1. Set NULL dates to past date (7 days ago)
  2. Create eligibility check function
  3. Update ad reward function with proper GMT handling
  4. Add error handling and messages
*/

-- ============================================================================
-- 1. UPDATE ALL NULL last_ad_view_date VALUES TO 7 DAYS AGO
-- ============================================================================

UPDATE profiles
SET last_ad_view_date = (NOW() AT TIME ZONE 'GMT') - INTERVAL '7 days'
WHERE last_ad_view_date IS NULL;

-- Log the update
INSERT INTO admin_security_log (
  event_type,
  severity,
  operation_type,
  details
) VALUES (
  'validation_failed',
  'info',
  'data_fix',
  jsonb_build_object(
    'migration', 'fix_ad_daily_reward_system_null_dates',
    'action', 'update_null_dates',
    'timestamp', NOW() AT TIME ZONE 'GMT',
    'updated_count', (SELECT COUNT(*) FROM profiles WHERE last_ad_view_date IS NOT NULL),
    'message', 'Set all NULL last_ad_view_date to 7 days ago'
  )
);

-- ============================================================================
-- 2. CREATE check_daily_ad_eligibility FUNCTION
-- ============================================================================

-- Function to check if user is eligible to watch ad today
CREATE OR REPLACE FUNCTION check_daily_ad_eligibility(p_user_id uuid)
RETURNS TABLE (
  eligible boolean,
  last_watch_date timestamptz,
  next_eligible_time timestamptz,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_ad_date timestamptz;
  v_today_start timestamptz;
  v_next_midnight timestamptz;
BEGIN
  -- Get user's last ad view date
  SELECT last_ad_view_date INTO v_last_ad_date
  FROM profiles
  WHERE id = p_user_id;

  -- Calculate today's start (00:00 GMT)
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'GMT') AT TIME ZONE 'GMT';
  
  -- Calculate next midnight GMT
  v_next_midnight := (date_trunc('day', NOW() AT TIME ZONE 'GMT') + INTERVAL '1 day') AT TIME ZONE 'GMT';

  -- If last_ad_date is NULL or before today's start, user is eligible
  IF v_last_ad_date IS NULL OR v_last_ad_date < v_today_start THEN
    RETURN QUERY SELECT 
      true as eligible,
      v_last_ad_date as last_watch_date,
      v_today_start as next_eligible_time,
      'You are eligible to watch today''s ad' as message;
  ELSE
    -- User already watched today
    RETURN QUERY SELECT 
      false as eligible,
      v_last_ad_date as last_watch_date,
      v_next_midnight as next_eligible_time,
      'You''ve already watched today''s ad. Come back at midnight GMT' as message;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_daily_ad_eligibility(uuid) TO authenticated;

-- ============================================================================
-- 3. FIX earn_coins_from_ad FUNCTION - ATOMIC WITH GMT HANDLING
-- ============================================================================

-- Drop old function
DROP FUNCTION IF EXISTS earn_coins_from_ad(uuid);

-- Create new atomic function with proper GMT handling
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
  v_community_pool_balance numeric;
  v_transaction_id uuid;
  v_pool_record record;
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
  SELECT * INTO v_pool_record
  FROM coin_pools
  WHERE pool_type = 'community'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community pool not found';
  END IF;

  v_community_pool_balance := v_pool_record.balance;

  -- Check if community pool has enough coins
  IF v_community_pool_balance < v_coin_reward THEN
    RETURN QUERY SELECT 
      false as success,
      NULL::numeric as new_balance,
      'Community pool has insufficient coins' as message,
      NULL::uuid as transaction_id;
    RETURN;
  END IF;

  -- Start atomic transaction
  -- 1. Deduct from community pool
  UPDATE coin_pools
  SET 
    balance = balance - v_coin_reward,
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
-- 4. CREATE HELPER FUNCTION TO GET AD STATUS
-- ============================================================================

-- Function to get user's ad watching status
CREATE OR REPLACE FUNCTION get_ad_status(p_user_id uuid)
RETURNS TABLE (
  can_watch boolean,
  last_watched timestamptz,
  next_available timestamptz,
  hours_until_next integer,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_ad_date timestamptz;
  v_today_start timestamptz;
  v_next_midnight timestamptz;
  v_can_watch boolean;
  v_hours_until integer;
BEGIN
  -- Get user's last ad view date
  SELECT last_ad_view_date INTO v_last_ad_date
  FROM profiles
  WHERE id = p_user_id;

  -- Calculate today's start and next midnight (00:00 GMT)
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'GMT') AT TIME ZONE 'GMT';
  v_next_midnight := (date_trunc('day', NOW() AT TIME ZONE 'GMT') + INTERVAL '1 day') AT TIME ZONE 'GMT';

  -- Determine if user can watch
  v_can_watch := (v_last_ad_date IS NULL OR v_last_ad_date < v_today_start);

  -- Calculate hours until next availability
  IF v_can_watch THEN
    v_hours_until := 0;
  ELSE
    v_hours_until := EXTRACT(EPOCH FROM (v_next_midnight - (NOW() AT TIME ZONE 'GMT'))) / 3600;
  END IF;

  RETURN QUERY SELECT 
    v_can_watch as can_watch,
    v_last_ad_date as last_watched,
    CASE 
      WHEN v_can_watch THEN v_today_start
      ELSE v_next_midnight
    END as next_available,
    v_hours_until::integer as hours_until_next,
    CASE 
      WHEN v_can_watch THEN 'You can watch today''s ad now!'
      ELSE 'Come back at midnight GMT for your next ad'
    END as message;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_ad_status(uuid) TO authenticated;

-- ============================================================================
-- 5. VERIFICATION
-- ============================================================================

-- Verify all users now have last_ad_view_date set
DO $$
DECLARE
  v_null_count int;
  v_total_count int;
BEGIN
  SELECT COUNT(*) INTO v_null_count FROM profiles WHERE last_ad_view_date IS NULL;
  SELECT COUNT(*) INTO v_total_count FROM profiles;
  
  RAISE NOTICE '✓ Ad system fixed:';
  RAISE NOTICE '  - Total profiles: %', v_total_count;
  RAISE NOTICE '  - Profiles with NULL dates: %', v_null_count;
  RAISE NOTICE '  - All users now eligible to watch ads: %', (v_null_count = 0);
  RAISE NOTICE '  - Functions created: check_daily_ad_eligibility, earn_coins_from_ad, get_ad_status';
  RAISE NOTICE '  - Timezone: GMT (00:00 midnight reset)';
  RAISE NOTICE '  - Reward: 10 coins per day';
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
    'migration', 'fix_ad_daily_reward_system_null_dates',
    'timestamp', NOW() AT TIME ZONE 'GMT',
    'changes', jsonb_build_array(
      'Updated NULL last_ad_view_date to 7 days ago',
      'Created check_daily_ad_eligibility function',
      'Fixed earn_coins_from_ad with atomic operations',
      'Created get_ad_status helper function',
      'All timestamps use GMT timezone',
      'Proper error handling and messages added'
    ),
    'rules', jsonb_build_object(
      'ads_per_day', 1,
      'reward_amount', 10,
      'reset_time', '00:00 GMT',
      'pool_source', 'community'
    )
  )
);
