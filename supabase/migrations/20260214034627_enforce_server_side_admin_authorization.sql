/*
  # Enforce Server-Side Admin Authorization on All Admin Functions

  ## Overview
  This migration closes a privilege escalation gap where admin functions used
  SECURITY DEFINER (bypassing RLS) but did not verify the caller is an admin.
  Any authenticated user could invoke these RPCs directly.

  ## Changes Made

  1. **New helper: `require_admin()`**
     - Reusable guard that checks `auth.uid()` against `profiles.is_admin`
     - Raises an exception if the caller is not admin
     - Cannot be spoofed (uses `auth.uid()`, not a parameter)

  2. **Fixed `is_user_admin()`**
     - Now uses `auth.uid()` instead of accepting arbitrary user IDs
     - Prevents information leakage about who is/isn't admin

  3. **Admin check added to all unprotected admin functions:**
     - `get_coin_pool_status()`
     - `get_resource_pools()`
     - `sync_coin_pool_integrity()`
     - `get_audit_log_by_status()`
     - `get_active_audit_warnings()`
     - `get_coin_pool_discrepancy_logs()`
     - `clear_warnings_for_resolved_users()`
     - `clear_stale_balance_warnings()`
     - `clear_all_stale_balance_warnings()`
     - `mark_audit_as_resolved()`
     - `log_admin_access()`
     - `execute_monthly_distribution()`
     - `verify_pool_integrity()`
     - `transfer_between_pools()`
     - `get_system_ledger_history()`
     - `calculate_actual_distributed_coins()`

  4. **Already protected (no changes needed):**
     - `get_all_moderation_cases()` - already checks is_admin
     - `resolve_moderation_case()` - already checks is_admin
     - `get_filtered_comments_stats()` - already checks is_admin
     - `manage_profanity_filter()` - already checks is_admin

  ## Security
  - Every admin RPC now enforces `auth.uid()` is_admin check before executing
  - SECURITY DEFINER functions no longer bypass authorization
  - Non-admin callers receive a clear "Unauthorized" error
*/

-- ============================================================================
-- STEP 1: Create reusable require_admin() guard function
-- ============================================================================

CREATE OR REPLACE FUNCTION require_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_is_admin boolean;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized - not authenticated';
  END IF;

  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = v_uid;

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Unauthorized - admin access required';
  END IF;
END;
$$;

COMMENT ON FUNCTION require_admin() IS
'Reusable guard: raises exception if the caller (auth.uid()) is not an admin. Call at the top of every admin-only function.';

-- ============================================================================
-- STEP 2: Fix is_user_admin() to use auth.uid() instead of parameter
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_admin(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id != v_uid THEN
    RETURN false;
  END IF;

  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = v_uid;

  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- ============================================================================
-- STEP 3: Fix log_admin_access() to verify caller identity
-- ============================================================================

CREATE OR REPLACE FUNCTION log_admin_access(
  p_user_id uuid,
  p_action_type text,
  p_resource_accessed text DEFAULT NULL,
  p_access_granted boolean DEFAULT true,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username text;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized - not authenticated';
  END IF;

  IF p_user_id != v_uid THEN
    RAISE EXCEPTION 'Unauthorized - cannot log access for another user';
  END IF;

  SELECT username INTO v_username
  FROM profiles
  WHERE id = v_uid;

  INSERT INTO admin_access_log (
    user_id,
    username,
    action_type,
    resource_accessed,
    access_granted,
    notes
  ) VALUES (
    v_uid,
    v_username,
    p_action_type,
    p_resource_accessed,
    p_access_granted,
    p_notes
  );
END;
$$;

-- ============================================================================
-- STEP 4: Add admin check to get_coin_pool_status()
-- ============================================================================

CREATE OR REPLACE FUNCTION get_coin_pool_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  pool_data record;
  actual_distributed numeric;
  discrepancy numeric;
  total_users integer;
  result jsonb;
BEGIN
  PERFORM require_admin();

  SELECT * INTO pool_data
  FROM coin_pool
  WHERE pool_name = 'Community Rewards Pool'
  LIMIT 1;

  actual_distributed := calculate_actual_distributed_coins();
  discrepancy := pool_data.distributed_coins - actual_distributed;

  SELECT COUNT(*) INTO total_users
  FROM profiles
  WHERE coin_balance > 0;

  result := jsonb_build_object(
    'pool_name', pool_data.pool_name,
    'total_coins', pool_data.total_coins,
    'distributed_coins', pool_data.distributed_coins,
    'actual_distributed', actual_distributed,
    'remaining_coins', pool_data.total_coins - actual_distributed,
    'discrepancy', discrepancy,
    'is_synced', ABS(discrepancy) <= 0.01,
    'total_users_with_coins', total_users,
    'last_updated', pool_data.updated_at
  );

  RETURN result;
END;
$$;

-- ============================================================================
-- STEP 5: Add admin check to get_resource_pools()
-- ============================================================================

CREATE OR REPLACE FUNCTION get_resource_pools()
RETURNS TABLE (
  id uuid,
  pool_name text,
  pool_type text,
  total_coins numeric,
  description text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_admin();

  RETURN QUERY
  SELECT
    rp.id,
    rp.pool_name,
    rp.pool_type,
    rp.total_coins,
    rp.description,
    rp.is_active,
    rp.created_at,
    rp.updated_at
  FROM resource_pools rp
  WHERE rp.is_active = true
  ORDER BY
    CASE rp.pool_type
      WHEN 'operational' THEN 1
      WHEN 'growth' THEN 2
      WHEN 'founder' THEN 3
      ELSE 4
    END;
END;
$$;

-- ============================================================================
-- STEP 6: Add admin check to calculate_actual_distributed_coins()
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_actual_distributed_coins()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  total_distributed numeric;
BEGIN
  PERFORM require_admin();

  SELECT COALESCE(SUM(coin_balance), 0)
  INTO total_distributed
  FROM profiles;

  RETURN total_distributed;
END;
$$;

-- ============================================================================
-- STEP 7: Add admin check to sync_coin_pool_integrity()
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_coin_pool_integrity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actual_distributed numeric;
  recorded_distributed numeric;
  discrepancy numeric;
  pool_id uuid;
  result jsonb;
BEGIN
  PERFORM require_admin();

  SELECT COALESCE(SUM(coin_balance), 0) INTO actual_distributed FROM profiles;

  SELECT id, distributed_coins
  INTO pool_id, recorded_distributed
  FROM coin_pool
  LIMIT 1;

  discrepancy := recorded_distributed - actual_distributed;

  IF ABS(discrepancy) > 0.01 THEN
    UPDATE coin_pool
    SET
      distributed_coins = actual_distributed,
      updated_at = now()
    WHERE id = pool_id;

    INSERT INTO balance_audit_log (
      user_id, correction_type, old_balance, new_balance,
      discrepancy, notes, corrected_by
    ) VALUES (
      NULL, 'coin_pool_sync', recorded_distributed, actual_distributed,
      discrepancy,
      format('Coin pool sync: Corrected discrepancy of %s coins. Recorded: %s, Actual: %s',
        discrepancy, recorded_distributed, actual_distributed),
      'auto_sync_system'
    );

    result := jsonb_build_object(
      'success', true,
      'corrected', true,
      'discrepancy', discrepancy,
      'old_distributed', recorded_distributed,
      'new_distributed', actual_distributed,
      'message', format('Corrected discrepancy of %s coins', discrepancy)
    );
  ELSE
    result := jsonb_build_object(
      'success', true,
      'corrected', false,
      'discrepancy', discrepancy,
      'distributed', actual_distributed,
      'message', 'Coin pool is in sync'
    );
  END IF;

  RETURN result;
END;
$$;

-- ============================================================================
-- STEP 8: Add admin check to get_audit_log_by_status()
-- ============================================================================

CREATE OR REPLACE FUNCTION get_audit_log_by_status(p_status text DEFAULT 'active')
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  correction_type text,
  old_balance numeric,
  new_balance numeric,
  discrepancy numeric,
  notes text,
  corrected_by text,
  corrected_at timestamptz,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_admin();

  RETURN QUERY
  SELECT
    bal.id,
    bal.user_id,
    p.username,
    bal.correction_type,
    bal.old_balance,
    bal.new_balance,
    bal.discrepancy,
    bal.notes,
    bal.corrected_by,
    bal.corrected_at,
    bal.status
  FROM balance_audit_log bal
  LEFT JOIN profiles p ON p.id = bal.user_id
  WHERE bal.status = p_status OR p_status = 'all'
  ORDER BY bal.corrected_at DESC;
END;
$$;

-- ============================================================================
-- STEP 9: Add admin check to get_active_audit_warnings()
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_audit_warnings()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  correction_type text,
  discrepancy numeric,
  notes text,
  corrected_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_admin();

  RETURN QUERY
  SELECT
    bal.id,
    bal.user_id,
    p.username,
    bal.correction_type,
    bal.discrepancy,
    bal.notes,
    bal.corrected_at
  FROM balance_audit_log bal
  LEFT JOIN profiles p ON p.id = bal.user_id
  WHERE bal.status = 'active'
  ORDER BY bal.corrected_at DESC;
END;
$$;

-- ============================================================================
-- STEP 10: Add admin check to get_coin_pool_discrepancy_logs()
-- ============================================================================

CREATE OR REPLACE FUNCTION get_coin_pool_discrepancy_logs(limit_count int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  correction_type text,
  old_balance numeric,
  new_balance numeric,
  discrepancy numeric,
  notes text,
  corrected_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_admin();

  RETURN QUERY
  SELECT
    bal.id,
    bal.correction_type,
    bal.old_balance,
    bal.new_balance,
    bal.discrepancy,
    bal.notes,
    bal.corrected_at
  FROM balance_audit_log bal
  WHERE bal.correction_type = 'coin_pool_sync'
  ORDER BY bal.corrected_at DESC
  LIMIT limit_count;
END;
$$;

-- ============================================================================
-- STEP 11: Add admin check to mark_audit_as_resolved()
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_audit_as_resolved(p_audit_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_admin();

  UPDATE balance_audit_log
  SET status = 'resolved'
  WHERE id = p_audit_id;

  RETURN FOUND;
END;
$$;

-- ============================================================================
-- STEP 12: Add admin check to clear_stale_balance_warnings()
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_stale_balance_warnings(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notifications_deleted integer := 0;
  v_user_notifications_deleted integer := 0;
BEGIN
  PERFORM require_admin();

  DELETE FROM notifications
  WHERE user_id = p_user_id
    AND (
      message ILIKE '%discrepancy%'
      OR message ILIKE '%balance warning%'
      OR message ILIKE '%balance error%'
      OR type IN ('balance_warning', 'balance_error', 'balance_discrepancy')
    );
  GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;

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

-- ============================================================================
-- STEP 13: Add admin check to clear_all_stale_balance_warnings()
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_all_stale_balance_warnings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notifications_deleted integer := 0;
  v_user_notifications_deleted integer := 0;
  v_users_affected integer := 0;
BEGIN
  PERFORM require_admin();

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

  DELETE FROM notifications
  WHERE message ILIKE '%discrepancy%'
     OR message ILIKE '%balance warning%'
     OR message ILIKE '%balance error%'
     OR type IN ('balance_warning', 'balance_error', 'balance_discrepancy');
  GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;

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

-- ============================================================================
-- STEP 14: Add admin check to clear_warnings_for_resolved_users()
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_warnings_for_resolved_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_resolved_user record;
  v_total_cleared integer := 0;
  v_users_cleared integer := 0;
  v_result jsonb;
BEGIN
  PERFORM require_admin();

  FOR v_resolved_user IN
    SELECT DISTINCT user_id
    FROM balance_audit_log
    WHERE status = 'resolved' AND user_id IS NOT NULL
  LOOP
    v_result := clear_stale_balance_warnings(v_resolved_user.user_id);

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

-- ============================================================================
-- STEP 15: Add admin check to execute_monthly_distribution()
-- ============================================================================

CREATE OR REPLACE FUNCTION execute_monthly_distribution()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_infrastructure_balance numeric;
  v_distribution_amount numeric := 4000.00;
  v_coder_amount numeric := 2000.00;
  v_infrastructure_cost_amount numeric := 2000.00;
  v_transfer_date timestamptz := now();
  v_result jsonb;
  v_ledger_id_1 uuid;
  v_ledger_id_2 uuid;
BEGIN
  PERFORM require_admin();

  IF EXISTS (
    SELECT 1 FROM system_ledger
    WHERE reason = 'MONTHLY_DISTRIBUTION'
    AND DATE_TRUNC('month', transfer_date) = DATE_TRUNC('month', v_transfer_date)
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Monthly distribution already executed for this month',
      'executed_at', v_transfer_date
    );
  END IF;

  SELECT total_coins INTO v_infrastructure_balance
  FROM resource_pools
  WHERE pool_name = 'Infrastructure_Reserve'
  FOR UPDATE;

  IF v_infrastructure_balance < v_distribution_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance in Infrastructure_Reserve',
      'required', v_distribution_amount,
      'available', v_infrastructure_balance
    );
  END IF;

  UPDATE resource_pools
  SET total_coins = total_coins - v_distribution_amount, updated_at = v_transfer_date
  WHERE pool_name = 'Infrastructure_Reserve';

  UPDATE resource_pools
  SET total_coins = total_coins + v_coder_amount, updated_at = v_transfer_date
  WHERE pool_name = 'Coder_Credits';

  UPDATE resource_pools
  SET total_coins = total_coins + v_infrastructure_cost_amount, updated_at = v_transfer_date
  WHERE pool_name = 'Monthly_Infrastructure_Cost';

  INSERT INTO system_ledger (source_pool, destination_pool, amount, reason, transfer_date, notes)
  VALUES ('Infrastructure_Reserve', 'Coder_Credits', v_coder_amount, 'MONTHLY_DISTRIBUTION', v_transfer_date,
    'Automated monthly distribution for coder compensation')
  RETURNING id INTO v_ledger_id_1;

  INSERT INTO system_ledger (source_pool, destination_pool, amount, reason, transfer_date, notes)
  VALUES ('Infrastructure_Reserve', 'Monthly_Infrastructure_Cost', v_infrastructure_cost_amount, 'MONTHLY_DISTRIBUTION', v_transfer_date,
    'Automated monthly distribution for infrastructure costs')
  RETURNING id INTO v_ledger_id_2;

  v_result := jsonb_build_object(
    'success', true,
    'distribution_date', v_transfer_date,
    'total_distributed', v_distribution_amount,
    'transfers', jsonb_build_array(
      jsonb_build_object('ledger_id', v_ledger_id_1, 'from', 'Infrastructure_Reserve', 'to', 'Coder_Credits', 'amount', v_coder_amount),
      jsonb_build_object('ledger_id', v_ledger_id_2, 'from', 'Infrastructure_Reserve', 'to', 'Monthly_Infrastructure_Cost', 'amount', v_infrastructure_cost_amount)
    ),
    'new_infrastructure_balance', v_infrastructure_balance - v_distribution_amount
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'attempted_at', v_transfer_date
    );
END;
$$;

-- ============================================================================
-- STEP 16: Add admin check to verify_pool_integrity()
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_pool_integrity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pool record;
  v_pool_name text;
  v_ledger_inflow numeric;
  v_ledger_outflow numeric;
  v_net_from_ledger numeric;
  v_current_balance numeric;
  v_discrepancy numeric;
  v_results jsonb := '[]'::jsonb;
  v_total_discrepancy numeric := 0;
  v_pools_checked integer := 0;
  v_pools_with_issues integer := 0;
BEGIN
  PERFORM require_admin();

  FOR v_pool IN
    SELECT rp.pool_name, rp.total_coins
    FROM resource_pools rp
    WHERE rp.is_active = true
    ORDER BY rp.pool_name
  LOOP
    v_pools_checked := v_pools_checked + 1;
    v_pool_name := v_pool.pool_name;
    v_current_balance := v_pool.total_coins;

    SELECT COALESCE(SUM(amount), 0) INTO v_ledger_inflow
    FROM system_ledger WHERE destination_pool = v_pool_name;

    SELECT COALESCE(SUM(amount), 0) INTO v_ledger_outflow
    FROM system_ledger WHERE source_pool = v_pool_name;

    v_net_from_ledger := v_ledger_inflow - v_ledger_outflow;
    v_discrepancy := v_current_balance - v_net_from_ledger;

    IF ABS(v_discrepancy) > 0.01 AND v_ledger_inflow = 0 AND v_ledger_outflow = 0 THEN
      v_results := v_results || jsonb_build_object(
        'pool_name', v_pool_name, 'current_balance', v_current_balance,
        'ledger_inflow', v_ledger_inflow, 'ledger_outflow', v_ledger_outflow,
        'net_ledger_change', v_net_from_ledger, 'discrepancy', v_discrepancy,
        'status', 'INITIAL_BALANCE', 'notes', 'Pool has initial balance with no ledger history (expected)');
    ELSIF ABS(v_discrepancy) > 0.01 THEN
      v_pools_with_issues := v_pools_with_issues + 1;
      v_total_discrepancy := v_total_discrepancy + v_discrepancy;
      v_results := v_results || jsonb_build_object(
        'pool_name', v_pool_name, 'current_balance', v_current_balance,
        'ledger_inflow', v_ledger_inflow, 'ledger_outflow', v_ledger_outflow,
        'net_ledger_change', v_net_from_ledger, 'discrepancy', v_discrepancy,
        'status', 'DISCREPANCY_DETECTED', 'notes', 'Pool balance does not match ledger records');
    ELSE
      v_results := v_results || jsonb_build_object(
        'pool_name', v_pool_name, 'current_balance', v_current_balance,
        'ledger_inflow', v_ledger_inflow, 'ledger_outflow', v_ledger_outflow,
        'net_ledger_change', v_net_from_ledger, 'discrepancy', v_discrepancy,
        'status', 'SYNCED', 'notes', 'Pool is properly synced with ledger');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'sync_date', now(),
    'pools_checked', v_pools_checked,
    'pools_with_issues', v_pools_with_issues,
    'total_discrepancy', v_total_discrepancy,
    'overall_status', CASE WHEN v_pools_with_issues = 0 THEN 'HEALTHY' ELSE 'ISSUES_DETECTED' END,
    'pool_details', v_results
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sync_date', now()
    );
END;
$$;

-- ============================================================================
-- STEP 17: Add admin check to transfer_between_pools()
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_between_pools(
  p_source_pool text,
  p_destination_pool text,
  p_amount numeric,
  p_reason text DEFAULT 'MANUAL_TRANSFER',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source_balance numeric;
  v_transfer_date timestamptz := now();
  v_ledger_id uuid;
BEGIN
  PERFORM require_admin();

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM resource_pools WHERE pool_name = p_source_pool) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Source pool does not exist', 'pool', p_source_pool);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM resource_pools WHERE pool_name = p_destination_pool) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Destination pool does not exist', 'pool', p_destination_pool);
  END IF;

  SELECT total_coins INTO v_source_balance
  FROM resource_pools WHERE pool_name = p_source_pool FOR UPDATE;

  IF v_source_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance in source pool', 'required', p_amount, 'available', v_source_balance);
  END IF;

  UPDATE resource_pools SET total_coins = total_coins - p_amount, updated_at = v_transfer_date WHERE pool_name = p_source_pool;
  UPDATE resource_pools SET total_coins = total_coins + p_amount, updated_at = v_transfer_date WHERE pool_name = p_destination_pool;

  INSERT INTO system_ledger (source_pool, destination_pool, amount, reason, transfer_date, notes)
  VALUES (p_source_pool, p_destination_pool, p_amount, p_reason, v_transfer_date, p_notes)
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true, 'ledger_id', v_ledger_id,
    'source_pool', p_source_pool, 'destination_pool', p_destination_pool,
    'amount', p_amount, 'transfer_date', v_transfer_date,
    'new_source_balance', v_source_balance - p_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- STEP 18: Add admin check to get_system_ledger_history()
-- ============================================================================

CREATE OR REPLACE FUNCTION get_system_ledger_history(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  source_pool text,
  destination_pool text,
  amount numeric,
  reason text,
  transfer_date timestamptz,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_admin();

  RETURN QUERY
  SELECT
    sl.id, sl.source_pool, sl.destination_pool,
    sl.amount, sl.reason, sl.transfer_date, sl.notes
  FROM system_ledger sl
  ORDER BY sl.transfer_date DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ============================================================================
-- STEP 19: Grant execute on the new helper
-- ============================================================================

GRANT EXECUTE ON FUNCTION require_admin() TO authenticated;
