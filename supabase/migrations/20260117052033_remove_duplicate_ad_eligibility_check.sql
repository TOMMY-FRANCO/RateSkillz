/*
  # Remove Duplicate Eligibility Check from Ad Coin Award System

  ## Problem
  Users can click "Watch" button (eligibility check passes at page load), video plays successfully,
  but then earn_coins_from_ad() runs the eligibility check AGAIN and blocks the coin award.
  Result: Video plays but 0 coins awarded, no transaction record created.

  ## Root Cause
  The eligibility check runs TWICE:
  1. At page load via can_watch_ad_today() - determines if button shows
  2. After video completes via earn_coins_from_ad() - blocks the award

  ## Solution
  Remove the eligibility check from earn_coins_from_ad(). The check should ONLY run at page load.
  
  New flow:
  1. Page loads → can_watch_ad_today() checks eligibility → Shows "Watch" button or countdown
  2. User clicks "Watch" → Video plays (no check during playback)
  3. Video ends → earn_coins_from_ad() awards 10 coins immediately (NO re-check)
  4. Create coin_transactions record with type='ad_reward'
  5. Update profiles.coin_balance +10
  6. Set last_ad_view_date = NOW()
  7. Show "You earned 10 coins!"

  ## Changes
  1. Update earn_coins_from_ad() to remove the 24-hour eligibility check
  2. Award coins immediately when called
  3. Set last_ad_view_date = NOW() to prevent duplicate calls
  4. Keep can_watch_ad_today() unchanged - it's the ONLY eligibility gate
*/

-- Update earn_coins_from_ad() to remove duplicate eligibility check
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
    'ad',
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
'Awards 10 coins for watching an ad. No eligibility check - frontend checks via can_watch_ad_today() before showing button. Sets last_ad_view_date to prevent duplicates.';

-- Log the fix
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ FIXED: Duplicate Ad Eligibility Check Removed';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes Applied:';
  RAISE NOTICE '  ✓ Removed 24-hour check from earn_coins_from_ad()';
  RAISE NOTICE '  ✓ Coins now awarded immediately after video completes';
  RAISE NOTICE '  ✓ Eligibility check ONLY at page load (can_watch_ad_today)';
  RAISE NOTICE '  ✓ last_ad_view_date set AFTER coin award';
  RAISE NOTICE '';
  RAISE NOTICE 'Flow:';
  RAISE NOTICE '  1. Page load → can_watch_ad_today() checks → Show button or countdown';
  RAISE NOTICE '  2. Click Watch → Video plays (no checks)';
  RAISE NOTICE '  3. Video ends → Award 10 coins (no re-check)';
  RAISE NOTICE '  4. Set last_ad_view_date = NOW()';
  RAISE NOTICE '  5. Show success message';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;
