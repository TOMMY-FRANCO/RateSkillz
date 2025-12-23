/*
  # Fix Ad Viewing to Reset at Midnight GMT

  ## Problem
  The `earn_coins_from_ad` function currently has NO daily limit checking.
  Users can watch unlimited ads and earn unlimited coins without restriction.
  The ad_views table and last_ad_view_date column exist but are not being used.

  ## Solution
  Update the `earn_coins_from_ad` function to:
  1. Check if user already watched an ad today (GMT date)
  2. Use GMT timezone for consistent worldwide reset at 00:00 GMT
  3. Compare dates using GMT, not local timezone or 24-hour periods
  4. Update last_ad_view_date when user watches ad
  5. Insert record into ad_views for tracking

  ## Changes
  1. Fix earn_coins_from_ad function to check GMT date
  2. Only allow one ad per GMT day (resets at 00:00:00 GMT)
  3. Return clear error message when limit reached
  4. Track ad views in ad_views table
  5. Update last_ad_view_date in profiles table

  ## Reset Logic
  - User watches ad on Dec 23 at 23:59 GMT → Cannot watch another until 00:00 GMT
  - At exactly 00:00:00 GMT Dec 24 → User can watch ad again
  - Date comparison uses GMT timezone, not user's local time
  - All users worldwide reset at same moment (00:00 GMT)
*/

-- Drop and recreate the earn_coins_from_ad function with GMT date checking
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
  
  -- User can watch ad - distribute 10 coins from pool
  v_result := distribute_coins_from_pool(
    p_user_id,
    10.0,
    'ad',
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

-- Create helper function to check if user can watch ad (for frontend to call)
CREATE OR REPLACE FUNCTION can_watch_ad_today(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_ad_date date;
  v_today_gmt date;
  v_next_available timestamptz;
BEGIN
  -- Get current GMT date
  v_today_gmt := (now() AT TIME ZONE 'UTC')::date;
  
  -- Get user's last ad view date
  SELECT last_ad_view_date INTO v_last_ad_date
  FROM profiles
  WHERE id = p_user_id;
  
  -- Calculate next available time (midnight GMT of next day if already watched today)
  IF v_last_ad_date IS NOT NULL AND v_last_ad_date >= v_today_gmt THEN
    v_next_available := ((v_today_gmt + INTERVAL '1 day')::timestamp AT TIME ZONE 'UTC');
    
    RETURN json_build_object(
      'can_watch', false,
      'last_ad_date', v_last_ad_date,
      'today_gmt', v_today_gmt,
      'next_available_gmt', v_next_available,
      'message', 'Already watched ad today. Next available at midnight GMT.'
    );
  ELSE
    RETURN json_build_object(
      'can_watch', true,
      'last_ad_date', v_last_ad_date,
      'today_gmt', v_today_gmt,
      'message', 'You can watch an ad now!'
    );
  END IF;
END;
$$;

-- Grant execute permissions on the new function
GRANT EXECUTE ON FUNCTION can_watch_ad_today(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION earn_coins_from_ad(uuid) TO authenticated;

-- Add RLS policy for ad_views if not exists
DROP POLICY IF EXISTS "Users can view their own ad views" ON ad_views;
CREATE POLICY "Users can view their own ad views"
  ON ad_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Note: last_ad_view_date column already exists from previous migration
-- This migration only fixes the function logic to use it properly
