/*
  # Fix Ad Transaction Type Consistency

  ## Summary
  Updates the earn_coins_from_ad function to use 'ad_reward' as the transaction type
  instead of 'ad' to match the CHECK constraint and existing transaction records.

  ## Changes Made
  1. Update earn_coins_from_ad to pass 'ad_reward' instead of 'ad'
  2. Ensures consistency with coin_transactions CHECK constraint
  3. Matches existing transaction records in the database

  ## Transaction Type Standards
  - comment_reward: For commenting on profiles (0.1 coins, once per profile)
  - ad_reward: For watching ads (10 coins, once per 24 hours GMT)
  - purchase: For buying coins with real money

  ## Note
  This change only affects new ad rewards. Historical records remain unchanged.
*/

-- Update earn_coins_from_ad to use correct transaction type
CREATE OR REPLACE FUNCTION earn_coins_from_ad(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_ad_date date;
  v_today_gmt date;
  v_result json;
BEGIN
  -- Get current GMT date (not datetime, just the date portion)
  v_today_gmt := (now() AT TIME ZONE 'UTC')::date;
  
  -- Get user's last ad view date from profiles table
  SELECT last_ad_view_date INTO v_last_ad_date
  FROM profiles
  WHERE id = p_user_id;
  
  -- Check if user already watched an ad today (GMT date)
  IF v_last_ad_date IS NOT NULL AND v_last_ad_date >= v_today_gmt THEN
    RETURN json_build_object(
      'success', false,
      'error', 'daily_limit_reached',
      'message', 'You have already watched an ad today. Come back tomorrow at midnight GMT!',
      'last_ad_date', v_last_ad_date,
      'next_available_gmt', (v_today_gmt + INTERVAL '1 day')::date
    );
  END IF;
  
  -- User can watch ad - distribute 10 coins from pool with correct transaction type
  v_result := distribute_coins_from_pool(
    p_user_id,
    10.0,
    'ad_reward',
    'Earned from watching advertisement'
  );
  
  -- Update last_ad_view_date to today's GMT date
  UPDATE profiles
  SET last_ad_view_date = v_today_gmt
  WHERE id = p_user_id;
  
  -- Insert into ad_views table for tracking
  INSERT INTO ad_views (user_id, coins_awarded, created_at)
  VALUES (p_user_id, 10.0, now());
  
  RETURN json_build_object(
    'success', true,
    'amount', 10.0,
    'message', 'You earned 10 coins!',
    'ad_date', v_today_gmt
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
