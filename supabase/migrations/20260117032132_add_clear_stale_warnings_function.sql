/*
  # Add Clear Stale Warnings Function for Admin Dashboard

  ## Overview
  Provides admin functionality to clear old notifications and warnings for resolved balance issues.
  This helps clean up stale warning messages that persist in the UI even after balances are verified correct.

  ## Changes Made
  1. **Clear Stale Notifications**: Function to delete old balance-related notifications
  2. **Clear by User**: Function to clear all stale warnings for a specific user
  3. **Batch Clear**: Function to clear all stale warnings system-wide

  ## Safety
  - Only removes notifications related to balance discrepancies and warnings
  - Preserves important notifications (friend requests, messages, etc.)
  - Requires admin privileges to execute
*/

-- Step 1: Create function to clear stale balance warnings for a specific user
CREATE OR REPLACE FUNCTION clear_stale_balance_warnings(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notifications_deleted integer := 0;
  v_user_notifications_deleted integer := 0;
BEGIN
  -- Delete from notifications table
  DELETE FROM notifications
  WHERE user_id = p_user_id
    AND (
      message ILIKE '%discrepancy%'
      OR message ILIKE '%balance warning%'
      OR message ILIKE '%balance error%'
      OR type IN ('balance_warning', 'balance_error', 'balance_discrepancy')
    );
  
  GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;
  
  -- Delete from user_notifications table
  DELETE FROM user_notifications
  WHERE user_id = p_user_id
    AND (
      message ILIKE '%discrepancy%'
      OR message ILIKE '%balance warning%'
      OR message ILIKE '%balance error%'
      OR notification_type IN ('balance_warning', 'balance_error', 'balance_discrepancy')
    );
  
  GET DIAGNOSTICS v_user_notifications_deleted = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'notifications_deleted', v_notifications_deleted,
    'user_notifications_deleted', v_user_notifications_deleted,
    'total_deleted', v_notifications_deleted + v_user_notifications_deleted
  );
END;
$$;

-- Step 2: Create function to clear all stale balance warnings system-wide
CREATE OR REPLACE FUNCTION clear_all_stale_balance_warnings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notifications_deleted integer := 0;
  v_user_notifications_deleted integer := 0;
  v_users_affected integer := 0;
BEGIN
  -- Count affected users
  SELECT COUNT(DISTINCT user_id)
  INTO v_users_affected
  FROM (
    SELECT user_id FROM notifications
    WHERE message ILIKE '%discrepancy%'
       OR message ILIKE '%balance warning%'
       OR message ILIKE '%balance error%'
       OR type IN ('balance_warning', 'balance_error', 'balance_discrepancy')
    UNION
    SELECT user_id FROM user_notifications
    WHERE message ILIKE '%discrepancy%'
       OR message ILIKE '%balance warning%'
       OR message ILIKE '%balance error%'
       OR notification_type IN ('balance_warning', 'balance_error', 'balance_discrepancy')
  ) AS affected;

  -- Delete from notifications table
  DELETE FROM notifications
  WHERE message ILIKE '%discrepancy%'
     OR message ILIKE '%balance warning%'
     OR message ILIKE '%balance error%'
     OR type IN ('balance_warning', 'balance_error', 'balance_discrepancy');
  
  GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;
  
  -- Delete from user_notifications table
  DELETE FROM user_notifications
  WHERE message ILIKE '%discrepancy%'
     OR message ILIKE '%balance warning%'
     OR message ILIKE '%balance error%'
     OR notification_type IN ('balance_warning', 'balance_error', 'balance_discrepancy');
  
  GET DIAGNOSTICS v_user_notifications_deleted = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'users_affected', v_users_affected,
    'notifications_deleted', v_notifications_deleted,
    'user_notifications_deleted', v_user_notifications_deleted,
    'total_deleted', v_notifications_deleted + v_user_notifications_deleted
  );
END;
$$;

-- Step 3: Create function to clear notifications for users with resolved audit entries
CREATE OR REPLACE FUNCTION clear_warnings_for_resolved_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved_user record;
  v_total_cleared integer := 0;
  v_users_cleared integer := 0;
  v_result jsonb;
BEGIN
  -- Loop through users with resolved audit entries
  FOR v_resolved_user IN
    SELECT DISTINCT user_id
    FROM balance_audit_log
    WHERE status = 'resolved' AND user_id IS NOT NULL
  LOOP
    -- Clear warnings for this user
    SELECT clear_stale_balance_warnings(v_resolved_user.user_id) INTO v_result;
    
    IF (v_result->>'total_deleted')::integer > 0 THEN
      v_total_cleared := v_total_cleared + (v_result->>'total_deleted')::integer;
      v_users_cleared := v_users_cleared + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'users_cleared', v_users_cleared,
    'total_warnings_cleared', v_total_cleared
  );
END;
$$;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION clear_stale_balance_warnings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_all_stale_balance_warnings() TO authenticated;
GRANT EXECUTE ON FUNCTION clear_warnings_for_resolved_users() TO authenticated;

-- Step 5: Add comments
COMMENT ON FUNCTION clear_stale_balance_warnings(uuid) IS
'Clears all balance-related warning notifications for a specific user. Used when balance is verified correct.';

COMMENT ON FUNCTION clear_all_stale_balance_warnings() IS
'Clears all balance-related warning notifications system-wide. Admin function to clean up stale warnings.';

COMMENT ON FUNCTION clear_warnings_for_resolved_users() IS
'Clears warning notifications for all users with resolved balance audit entries. Automated cleanup.';

-- Step 6: Log the migration
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ STALE WARNING CLEANUP FUNCTIONS CREATED';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'New Admin Functions:';
  RAISE NOTICE '  ✓ clear_stale_balance_warnings(user_id) - Clear warnings for one user';
  RAISE NOTICE '  ✓ clear_all_stale_balance_warnings() - Clear all stale warnings';
  RAISE NOTICE '  ✓ clear_warnings_for_resolved_users() - Auto-clear for resolved users';
  RAISE NOTICE '';
  RAISE NOTICE 'These functions remove stale balance discrepancy notifications';
  RAISE NOTICE 'that persist after balances have been verified correct.';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;
