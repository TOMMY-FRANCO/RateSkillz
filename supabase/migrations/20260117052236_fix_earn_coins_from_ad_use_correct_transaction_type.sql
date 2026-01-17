/*
  # Fix earn_coins_from_ad to Use Correct Transaction Type

  ## Problem
  The earn_coins_from_ad function passes 'ad' as transaction_type to distribute_coins_from_pool,
  but the coin_transactions table constraint only accepts 'ad_reward', not 'ad'.
  
  This causes: "new row for relation coin_transactions violates check constraint coin_transactions_transaction_type_check"

  ## Solution
  Update earn_coins_from_ad to pass 'ad_reward' instead of 'ad' to match the constraint.

  ## Changes
  - Change transaction_type from 'ad' to 'ad_reward' in distribute_coins_from_pool call
*/

-- Fix earn_coins_from_ad to use correct transaction type
CREATE OR REPLACE FUNCTION earn_coins_from_ad(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_current_timestamp timestamptz;
BEGIN
  -- Get current timestamp
  v_current_timestamp := now();
  
  -- Award 10 coins from community pool (no eligibility check - frontend already checked)
  -- The eligibility check happens at page load via can_watch_ad_today()
  -- If user got here, they passed the check and watched the video
  v_result := distribute_coins_from_pool(
    p_user_id,
    10.0,
    'ad_reward',  -- Changed from 'ad' to 'ad_reward' to match constraint
    'Earned from watching advertisement'
  );
  
  -- Set last_ad_view_date to current timestamp (prevents duplicate awards in same session)
  UPDATE profiles
  SET last_ad_view_date = v_current_timestamp
  WHERE id = p_user_id;
  
  -- Insert into ad_views table for tracking
  INSERT INTO ad_views (user_id, coins_awarded, created_at)
  VALUES (p_user_id, 10.0, v_current_timestamp);
  
  RETURN json_build_object(
    'success', true,
    'amount', 10.0,
    'message', 'You earned 10 coins!',
    'ad_timestamp', v_current_timestamp
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Failed to award ad coins. Please try again.'
  );
END;
$$;

-- Update function comment
COMMENT ON FUNCTION earn_coins_from_ad(uuid) IS
'Awards 10 coins for watching an ad. No eligibility check - frontend checks via can_watch_ad_today() before showing button. Uses ad_reward transaction type.';

-- Log the fix
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ FIXED: Transaction Type in earn_coins_from_ad';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes Applied:';
  RAISE NOTICE '  ✓ Changed transaction_type from ad to ad_reward';
  RAISE NOTICE '  ✓ Now matches coin_transactions constraint';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;
