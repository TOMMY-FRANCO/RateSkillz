/*
  # Fix Balance Transaction Sync Issue - CRITICAL BUG (v3)

  ## Problem
  When users earn coins, coin_transactions records get correct balance_after values,
  BUT profiles.coin_balance doesn't update due to error swallowing in triggers.

  ## Solution
  1. Fix triggers to propagate errors (no silent failures)
  2. Fix balance calculation to use profiles.coin_balance
  3. Create reconciliation functions
  4. Fix all existing discrepancies
*/

-- ============================================================================
-- 1. FIX calculate_transaction_running_balance
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_transaction_running_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance numeric;
BEGIN
  -- Use ACTUAL balance from profiles table as source of truth
  SELECT coin_balance INTO v_current_balance
  FROM profiles
  WHERE id = NEW.user_id;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', NEW.user_id;
  END IF;

  -- Calculate new balance after this transaction
  NEW.balance_after := v_current_balance + NEW.amount;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- DO NOT SWALLOW - propagate error to rollback transaction
  RAISE EXCEPTION 'Failed to calculate transaction balance for user %: %', NEW.user_id, SQLERRM;
END;
$$;

-- ============================================================================
-- 2. FIX update_coin_balance_on_transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION update_coin_balance_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows_affected integer;
  v_old_balance numeric;
  v_new_balance numeric;
BEGIN
  -- Get current balance
  SELECT coin_balance INTO v_old_balance
  FROM profiles
  WHERE id = NEW.user_id;

  IF v_old_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', NEW.user_id;
  END IF;

  -- Update balance atomically
  UPDATE profiles
  SET 
    coin_balance = coin_balance + NEW.amount,
    updated_at = now()
  WHERE id = NEW.user_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'Failed to update balance for user_id: %', NEW.user_id;
  END IF;

  -- Verify the update worked
  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = NEW.user_id;

  IF v_new_balance != (v_old_balance + NEW.amount) THEN
    RAISE EXCEPTION 'Balance update verification failed. Expected: %, Got: %', 
      (v_old_balance + NEW.amount), v_new_balance;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- DO NOT SWALLOW - propagate error to rollback transaction
  RAISE EXCEPTION 'Failed to update coin balance for user %: %', NEW.user_id, SQLERRM;
END;
$$;

-- ============================================================================
-- 3. CREATE Balance Reconciliation Function (Single User)
-- ============================================================================

CREATE OR REPLACE FUNCTION reconcile_user_balance(
  p_user_id uuid,
  p_correction_source text DEFAULT 'manual_reconcile'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_balance numeric;
  v_latest_transaction_balance numeric;
  v_latest_transaction_id uuid;
  v_discrepancy numeric;
BEGIN
  -- Get current profile balance
  SELECT coin_balance INTO v_profile_balance
  FROM profiles
  WHERE id = p_user_id;

  IF v_profile_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Get latest transaction balance using explicit table reference
  SELECT ct.balance_after, ct.id
  INTO v_latest_transaction_balance, v_latest_transaction_id
  FROM coin_transactions ct
  WHERE ct.user_id = p_user_id
  ORDER BY ct.created_at DESC, ct.id DESC
  LIMIT 1;

  -- If no transactions, balance should be 0
  IF v_latest_transaction_balance IS NULL THEN
    IF v_profile_balance != 0 THEN
      UPDATE profiles SET coin_balance = 0, updated_at = now() WHERE id = p_user_id;
      
      INSERT INTO balance_audit_log (
        user_id, old_balance, new_balance, discrepancy, 
        correction_source, notes
      ) VALUES (
        p_user_id, v_profile_balance, 0, -v_profile_balance,
        p_correction_source, 'No transactions found, reset balance to 0'
      );
      
      RETURN json_build_object(
        'success', true, 
        'corrected', true,
        'old_balance', v_profile_balance,
        'new_balance', 0,
        'discrepancy', -v_profile_balance
      );
    END IF;
    
    RETURN json_build_object(
      'success', true,
      'corrected', false,
      'message', 'No transactions, balance already correct'
    );
  END IF;

  -- Calculate discrepancy
  v_discrepancy := v_latest_transaction_balance - v_profile_balance;

  -- If no discrepancy, return
  IF v_discrepancy = 0 THEN
    RETURN json_build_object(
      'success', true,
      'corrected', false,
      'balance', v_profile_balance,
      'message', 'Balance already correct'
    );
  END IF;

  -- Correct the balance
  UPDATE profiles
  SET coin_balance = v_latest_transaction_balance, updated_at = now()
  WHERE id = p_user_id;

  -- Log the correction
  INSERT INTO balance_audit_log (
    user_id, old_balance, new_balance, discrepancy,
    correction_source, latest_transaction_id, notes
  ) VALUES (
    p_user_id,
    v_profile_balance,
    v_latest_transaction_balance,
    v_discrepancy,
    p_correction_source,
    v_latest_transaction_id,
    format('Corrected balance from %s to %s (discrepancy: %s)', 
      v_profile_balance, v_latest_transaction_balance, v_discrepancy)
  );

  RETURN json_build_object(
    'success', true,
    'corrected', true,
    'old_balance', v_profile_balance,
    'new_balance', v_latest_transaction_balance,
    'discrepancy', v_discrepancy
  );
END;
$$;

COMMENT ON FUNCTION reconcile_user_balance IS
'Reconciles a single user balance by comparing profiles.coin_balance with 
latest coin_transactions.balance_after. Automatically corrects discrepancies.';

-- ============================================================================
-- 4. CREATE Bulk Reconciliation Function
-- ============================================================================

CREATE OR REPLACE FUNCTION reconcile_all_balances()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record record;
  v_total integer := 0;
  v_corrected integer := 0;
  v_errors integer := 0;
  v_result json;
BEGIN
  -- Find all users with discrepancies
  FOR v_user_record IN
    SELECT DISTINCT
      p.id,
      p.username,
      p.coin_balance as profile_balance,
      ct.balance_after as transaction_balance
    FROM profiles p
    LEFT JOIN LATERAL (
      SELECT ct2.balance_after
      FROM coin_transactions ct2
      WHERE ct2.user_id = p.id
      ORDER BY ct2.created_at DESC, ct2.id DESC
      LIMIT 1
    ) ct ON true
    WHERE ct.balance_after IS NOT NULL
      AND ct.balance_after != p.coin_balance
  LOOP
    v_total := v_total + 1;
    
    BEGIN
      -- Reconcile this user
      SELECT reconcile_user_balance(v_user_record.id, 'bulk_reconcile') INTO v_result;
      
      IF (v_result->>'corrected')::boolean THEN
        v_corrected := v_corrected + 1;
        RAISE NOTICE 'Corrected balance for user %: % → %',
          v_user_record.username,
          v_user_record.profile_balance,
          v_user_record.transaction_balance;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'Failed to reconcile user %: %', v_user_record.username, SQLERRM;
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'total_users_with_discrepancies', v_total,
    'corrected', v_corrected,
    'errors', v_errors,
    'timestamp', now()
  );
END;
$$;

COMMENT ON FUNCTION reconcile_all_balances IS
'Bulk reconciliation function that fixes balance discrepancies for ALL users.
Safe to run multiple times (idempotent).';

-- ============================================================================
-- 5. CREATE Balance Verification View
-- ============================================================================

CREATE OR REPLACE VIEW balance_verification AS
SELECT 
  p.id as user_id,
  p.username,
  p.coin_balance as profile_balance,
  ct.balance_after as latest_transaction_balance,
  ct.last_tx_time,
  ct.last_tx_type,
  (COALESCE(ct.balance_after, 0) - p.coin_balance) as discrepancy,
  CASE 
    WHEN ct.balance_after IS NULL AND p.coin_balance = 0 THEN 'OK_NO_TRANSACTIONS'
    WHEN ct.balance_after IS NULL AND p.coin_balance != 0 THEN 'ERROR_NO_TRANSACTIONS_BUT_HAS_BALANCE'
    WHEN ct.balance_after = p.coin_balance THEN 'OK'
    WHEN ABS(ct.balance_after - p.coin_balance) < 0.01 THEN 'OK_ROUNDING'
    ELSE 'DISCREPANCY'
  END as status
FROM profiles p
LEFT JOIN LATERAL (
  SELECT 
    ct2.balance_after,
    ct2.created_at as last_tx_time,
    ct2.transaction_type as last_tx_type
  FROM coin_transactions ct2
  WHERE ct2.user_id = p.id
  ORDER BY ct2.created_at DESC, ct2.id DESC
  LIMIT 1
) ct ON true
ORDER BY ABS(COALESCE(ct.balance_after, 0) - p.coin_balance) DESC;

GRANT SELECT ON balance_verification TO authenticated;

COMMENT ON VIEW balance_verification IS
'View showing balance verification status for all users.';

-- ============================================================================
-- 6. RUN Initial Reconciliation
-- ============================================================================

DO $$
DECLARE
  v_result json;
BEGIN
  RAISE NOTICE 'Running initial balance reconciliation...';
  
  SELECT reconcile_all_balances() INTO v_result;
  
  RAISE NOTICE 'Reconciliation complete: %', v_result;

  -- Log to admin security log
  INSERT INTO admin_security_log (
    event_type, severity, user_id, operation_type, details
  ) VALUES (
    'validation_failed', 'info', NULL, 'balance_reconciliation',
    jsonb_build_object(
      'migration', 'fix_balance_transaction_sync_issue',
      'timestamp', now(),
      'reconciliation_result', v_result::jsonb,
      'changes', jsonb_build_array(
        'Fixed calculate_transaction_running_balance to use profiles.coin_balance',
        'Fixed update_coin_balance_on_transaction to propagate errors',
        'Created reconcile_user_balance function',
        'Created reconcile_all_balances function',
        'Created balance_verification view',
        'Ran initial reconciliation to fix all existing discrepancies'
      ),
      'impact', 'CRITICAL - Fixed balance sync issue affecting all coin earnings'
    )
  );
END $$;
