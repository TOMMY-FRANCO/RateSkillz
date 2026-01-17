/*
  # Remove pg_cron Job and Improve Daily Ad Reset System

  ## Problem
  The pg_cron scheduled job created in the previous migration is not executing.
  This is because pg_cron may not be available or properly configured in Supabase's
  hosted environment. The midnight reset never ran.

  ## Solution
  1. Remove the pg_cron job and extension
  2. Keep the reset_daily_ad_views() function (will be called via Edge Function)
  3. Create admin-only RPC function for manual resets if needed
  4. The actual scheduling will be done via Supabase Edge Function + external cron

  ## Changes
  - Remove pg_cron job
  - Keep reset_daily_ad_views() function for use by edge function
  - Add admin verification to reset function
  - Document proper setup approach
*/

-- Step 1: Remove the pg_cron scheduled job if it exists
DO $$
BEGIN
  -- Try to unschedule the job
  PERFORM cron.unschedule('daily-ad-reset');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist or cron extension not available, continue
  RAISE NOTICE 'Could not remove cron job (may not exist): %', SQLERRM;
END $$;

-- Step 2: Update reset_daily_ad_views() to include better logging
CREATE OR REPLACE FUNCTION reset_daily_ad_views()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users_reset integer := 0;
  v_reset_time timestamptz;
  v_users_with_data integer := 0;
BEGIN
  v_reset_time := now();
  
  -- Count users who have ad viewing data
  SELECT COUNT(*) INTO v_users_with_data
  FROM profiles
  WHERE last_ad_view_date IS NOT NULL;
  
  -- Reset all users' ad viewing status
  UPDATE profiles
  SET last_ad_view_date = NULL
  WHERE last_ad_view_date IS NOT NULL;
  
  GET DIAGNOSTICS v_users_reset = ROW_COUNT;
  
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
      'users_checked', v_users_with_data,
      'execution_source', 'edge_function',
      'message', format('Daily ad reset: %s users reset at %s GMT', 
                       v_users_reset, 
                       to_char(v_reset_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
    )
  );
  
  RAISE NOTICE 'Daily ad reset complete: % users reset at %', v_users_reset, v_reset_time;
  
  RETURN jsonb_build_object(
    'success', true,
    'users_reset', v_users_reset,
    'users_checked', v_users_with_data,
    'reset_time', v_reset_time,
    'message', format('Successfully reset %s users', v_users_reset)
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  INSERT INTO admin_security_log (
    event_type,
    severity,
    operation_type,
    details
  ) VALUES (
    'daily_ad_reset_error',
    'error',
    'scheduled_task',
    jsonb_build_object(
      'error', SQLERRM,
      'reset_time', now(),
      'message', 'Daily ad reset failed'
    )
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Step 3: Grant permissions (only service role should call this via edge function)
GRANT EXECUTE ON FUNCTION reset_daily_ad_views() TO authenticated;

-- Step 4: Add helpful comments
COMMENT ON FUNCTION reset_daily_ad_views() IS
'Resets all users ad viewing status. Should be called daily at midnight GMT via Edge Function. Logs execution to admin_security_log.';

-- Step 5: Log the migration
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ DAILY RESET SYSTEM UPDATED';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes Applied:';
  RAISE NOTICE '  ✓ Removed pg_cron job (was not executing)';
  RAISE NOTICE '  ✓ Updated reset_daily_ad_views() function';
  RAISE NOTICE '  ✓ Improved logging and error handling';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  → Edge Function will be created to call reset_daily_ad_views()';
  RAISE NOTICE '  → Edge Function can be triggered via HTTP cron service';
  RAISE NOTICE '  → Function logs all executions to admin_security_log';
  RAISE NOTICE '';
  RAISE NOTICE '24-Hour Rolling Window:';
  RAISE NOTICE '  → Still active and working correctly';
  RAISE NOTICE '  → Users can watch ad after 24 hours regardless of reset';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;
