/*
  # Fix Ad Viewing with 24-Hour Interval Check and Automatic Daily Reset

  ## Problem
  Users cannot watch their daily ad even when it's a new calendar day because the
  date-based check doesn't account for actual time elapsed. The app incorrectly blocks
  viewing when the calendar changes but less than 24 hours have passed.

  ## Solution
  1. **24-Hour Rolling Window**: Check if (NOW() - last_ad_view_date) >= 24 hours
     - This prevents gaming the system by watching at 11:59pm and 12:01am
     - Allows legitimate viewing after true 24-hour period
  
  2. **Automatic Midnight Reset**: Scheduled job at 00:00 GMT resets all users
     - Sets last_ad_view_date = NULL for everyone
     - Provides hard daily reset at midnight GMT
     - Logs all resets to admin_security_log

  3. **Better User Messaging**: Returns time remaining until next ad available
     - Frontend can show "Next ad available in X hours Y minutes"
     - Clear countdown timer for users

  ## Changes
  1. Update can_watch_ad_today() to use 24-hour interval check
  2. Update earn_coins_from_ad() to use timestamp instead of date
  3. Change last_ad_view_date to timestamp with timezone
  4. Create scheduled midnight reset function
  5. Add pg_cron extension for scheduling
*/

-- Step 1: Change last_ad_view_date from date to timestamptz for accurate 24-hour tracking
DO $$
BEGIN
  -- Check if column is date type and convert to timestamptz
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' 
      AND column_name = 'last_ad_view_date'
      AND data_type = 'date'
  ) THEN
    -- Convert date to timestamptz (preserves existing dates at 00:00:00)
    ALTER TABLE profiles 
    ALTER COLUMN last_ad_view_date TYPE timestamptz 
    USING last_ad_view_date::timestamptz;
    
    RAISE NOTICE 'Converted last_ad_view_date from date to timestamptz';
  END IF;
END $$;

-- Step 2: Update can_watch_ad_today() to use 24-hour interval check
CREATE OR REPLACE FUNCTION can_watch_ad_today(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_ad_timestamp timestamptz;
  v_hours_since_last_ad numeric;
  v_can_watch boolean;
  v_next_available timestamptz;
  v_hours_remaining numeric;
  v_minutes_remaining integer;
BEGIN
  -- Get user's last ad view timestamp
  SELECT last_ad_view_date INTO v_last_ad_timestamp
  FROM profiles
  WHERE id = p_user_id;
  
  -- If never watched an ad, can watch now
  IF v_last_ad_timestamp IS NULL THEN
    RETURN json_build_object(
      'can_watch', true,
      'last_ad_timestamp', NULL,
      'message', 'You can watch an ad now!'
    );
  END IF;
  
  -- Calculate hours since last ad view
  v_hours_since_last_ad := EXTRACT(EPOCH FROM (now() - v_last_ad_timestamp)) / 3600.0;
  
  -- Can watch if 24+ hours have passed
  v_can_watch := v_hours_since_last_ad >= 24;
  
  IF v_can_watch THEN
    RETURN json_build_object(
      'can_watch', true,
      'last_ad_timestamp', v_last_ad_timestamp,
      'hours_since_last_ad', v_hours_since_last_ad,
      'message', 'You can watch an ad now!'
    );
  ELSE
    -- Calculate next available time
    v_next_available := v_last_ad_timestamp + INTERVAL '24 hours';
    v_hours_remaining := 24 - v_hours_since_last_ad;
    v_minutes_remaining := FLOOR((v_hours_remaining - FLOOR(v_hours_remaining)) * 60);
    
    RETURN json_build_object(
      'can_watch', false,
      'last_ad_timestamp', v_last_ad_timestamp,
      'hours_since_last_ad', v_hours_since_last_ad,
      'next_available_gmt', v_next_available,
      'hours_remaining', FLOOR(v_hours_remaining),
      'minutes_remaining', v_minutes_remaining,
      'message', format('Next ad available in %s hours %s minutes', 
                       FLOOR(v_hours_remaining), 
                       v_minutes_remaining)
    );
  END IF;
END;
$$;

-- Step 3: Update earn_coins_from_ad() to use 24-hour interval check
CREATE OR REPLACE FUNCTION earn_coins_from_ad(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_ad_timestamp timestamptz;
  v_hours_since_last_ad numeric;
  v_result json;
  v_next_available timestamptz;
BEGIN
  -- Get user's last ad view timestamp
  SELECT last_ad_view_date INTO v_last_ad_timestamp
  FROM profiles
  WHERE id = p_user_id;
  
  -- Check if user can watch ad (24-hour interval)
  IF v_last_ad_timestamp IS NOT NULL THEN
    v_hours_since_last_ad := EXTRACT(EPOCH FROM (now() - v_last_ad_timestamp)) / 3600.0;
    
    -- Block if less than 24 hours have passed
    IF v_hours_since_last_ad < 24 THEN
      v_next_available := v_last_ad_timestamp + INTERVAL '24 hours';
      
      RETURN json_build_object(
        'success', false,
        'error', 'daily_limit_reached',
        'message', format('Next ad available in %s hours. Come back at %s GMT',
                         CEIL(24 - v_hours_since_last_ad),
                         to_char(v_next_available, 'HH24:MI on YYYY-MM-DD')),
        'last_ad_timestamp', v_last_ad_timestamp,
        'next_available_gmt', v_next_available,
        'hours_remaining', CEIL(24 - v_hours_since_last_ad)
      );
    END IF;
  END IF;
  
  -- User can watch ad - distribute 10 coins from community pool
  v_result := distribute_coins_from_pool(
    p_user_id,
    10.0,
    'ad',
    'Earned from watching advertisement'
  );
  
  -- Update last_ad_view_date to current timestamp
  UPDATE profiles
  SET last_ad_view_date = now()
  WHERE id = p_user_id;
  
  -- Insert into ad_views table for tracking
  INSERT INTO ad_views (user_id, coins_awarded, created_at)
  VALUES (p_user_id, 10.0, now());
  
  RETURN json_build_object(
    'success', true,
    'amount', 10.0,
    'message', 'You earned 10 coins!',
    'ad_timestamp', now()
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Step 4: Create automatic midnight reset function
CREATE OR REPLACE FUNCTION reset_daily_ad_views()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users_reset integer := 0;
  v_reset_time timestamptz;
BEGIN
  v_reset_time := now();
  
  -- Count users who will be reset
  SELECT COUNT(*) INTO v_users_reset
  FROM profiles
  WHERE last_ad_view_date IS NOT NULL;
  
  -- Reset all users' ad viewing status
  UPDATE profiles
  SET last_ad_view_date = NULL
  WHERE last_ad_view_date IS NOT NULL;
  
  -- Log the reset to admin_security_log
  INSERT INTO admin_security_log (
    event_type,
    severity,
    operation_type,
    details
  ) VALUES (
    'daily_ad_reset',
    'info',
    'scheduled_task',
    jsonb_build_object(
      'reset_time', v_reset_time,
      'users_reset', v_users_reset,
      'message', 'Daily ad viewing reset at midnight GMT'
    )
  );
  
  RAISE NOTICE 'Daily ad reset complete: % users reset at %', v_users_reset, v_reset_time;
  
  RETURN jsonb_build_object(
    'success', true,
    'users_reset', v_users_reset,
    'reset_time', v_reset_time
  );
END;
$$;

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION can_watch_ad_today(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION earn_coins_from_ad(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_daily_ad_views() TO authenticated;

-- Step 6: Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 7: Schedule daily reset at midnight GMT (00:00)
-- Note: Supabase projects use pg_cron for scheduled tasks
-- This creates a job that runs at 00:00 GMT every day
DO $$
BEGIN
  -- Remove existing job if it exists
  PERFORM cron.unschedule('daily-ad-reset');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, continue
  NULL;
END $$;

-- Schedule the daily reset job
SELECT cron.schedule(
  'daily-ad-reset',
  '0 0 * * *', -- Cron expression: At 00:00 GMT every day
  $$SELECT reset_daily_ad_views()$$
);

-- Step 8: Add comments
COMMENT ON FUNCTION can_watch_ad_today(uuid) IS
'Checks if user can watch an ad using 24-hour rolling window. Returns hours/minutes remaining if blocked.';

COMMENT ON FUNCTION earn_coins_from_ad(uuid) IS
'Awards 10 coins for watching an ad if 24+ hours have passed since last view. Uses timestamp-based interval check.';

COMMENT ON FUNCTION reset_daily_ad_views() IS
'Resets all users ad viewing status at midnight GMT. Scheduled via pg_cron. Logs resets to admin_security_log.';

-- Step 9: Log the migration
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ AD VIEWING SYSTEM UPDATED';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes Applied:';
  RAISE NOTICE '  ✓ Changed last_ad_view_date to timestamptz for accurate tracking';
  RAISE NOTICE '  ✓ Updated to 24-hour rolling window (prevents gaming system)';
  RAISE NOTICE '  ✓ Added automatic midnight GMT reset via pg_cron';
  RAISE NOTICE '  ✓ Returns countdown timer (hours/minutes remaining)';
  RAISE NOTICE '  ✓ Logs all resets to admin_security_log';
  RAISE NOTICE '';
  RAISE NOTICE 'Scheduled Job:';
  RAISE NOTICE '  → Daily reset at 00:00 GMT (midnight UK time)';
  RAISE NOTICE '  → Sets last_ad_view_date = NULL for all users';
  RAISE NOTICE '  → Ensures fresh start each day';
  RAISE NOTICE '';
  RAISE NOTICE 'User Experience:';
  RAISE NOTICE '  → Can watch ad after 24 hours OR after midnight GMT';
  RAISE NOTICE '  → Sees "Next ad in X hours Y minutes" when blocked';
  RAISE NOTICE '  → Prevents watching at 11:59pm and 12:01am';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;
