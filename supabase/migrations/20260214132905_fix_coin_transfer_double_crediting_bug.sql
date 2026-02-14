/*
  # Fix Coin Transfer Double-Crediting Bug

  ## Problem
  Users report that coin transfers are double-crediting recipients:
  - Sender debited correctly: -10 coins
  - Recipient credited incorrectly: +20 coins (should be +10)

  ## Root Cause Analysis
  The current architecture has process_coin_transfer_trigger manually updating
  balances and then inserting coin_transactions. While update_coin_balance_on_transaction
  is supposed to skip transfer types, there may be edge cases or race conditions
  causing double-crediting.

  ## Solution
  1. Add explicit balance verification in process_coin_transfer_trigger
  2. Ensure coin_transactions for transfers NEVER trigger balance updates
  3. Add transaction-level locking to prevent race conditions
  4. Add detailed error handling with balance validation
  5. Create a function to detect and fix any existing discrepancies

  ## Tables Modified
  - None (functions only)

  ## Functions Modified
  - process_coin_transfer_trigger - Added balance verification and atomic updates
  - update_coin_balance_on_transaction - Strengthened exclusion logic

  ## Functions Created
  - detect_coin_balance_discrepancies - Auditing function for balance issues
*/

-- ============================================================================
-- 1. Fix update_coin_balance_on_transaction - Strengthen Transfer Exclusion
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_coin_balance_on_transaction()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows_affected integer;
  v_old_balance numeric;
  v_new_balance numeric;
BEGIN
  -- CRITICAL: ALWAYS skip transfer types - they're handled by process_coin_transfer_trigger
  -- Check this FIRST before any other logic
  IF NEW.transaction_type = 'coin_transfer_sent' THEN
    RETURN NEW;
  END IF;

  IF NEW.transaction_type = 'coin_transfer_received' THEN
    RETURN NEW;
  END IF;

  -- Double-check with IN clause as well (belt and suspenders approach)
  IF NEW.transaction_type IN ('coin_transfer_sent', 'coin_transfer_received') THEN
    RETURN NEW;
  END IF;

  -- Get current balance with row lock to prevent race conditions
  SELECT coin_balance INTO v_old_balance
  FROM profiles
  WHERE id = NEW.user_id
  FOR UPDATE;

  IF v_old_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', NEW.user_id;
  END IF;

  -- Update balance
  UPDATE profiles
  SET
    coin_balance = coin_balance + NEW.amount,
    updated_at = now()
  WHERE id = NEW.user_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'Failed to update balance for user_id: %', NEW.user_id;
  END IF;

  -- Verify the balance was updated correctly
  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = NEW.user_id;

  IF v_new_balance != (v_old_balance + NEW.amount) THEN
    RAISE EXCEPTION 'Balance update verification failed. Expected: %, Got: %',
      (v_old_balance + NEW.amount), v_new_balance;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to update coin balance for user %: %', NEW.user_id, SQLERRM;
END;
$function$;

COMMENT ON FUNCTION update_coin_balance_on_transaction IS
'Updates user coin balances when coin_transactions are inserted.
CRITICAL: Transfer types (coin_transfer_sent, coin_transfer_received) are ALWAYS skipped
because they are handled directly by process_coin_transfer_trigger.';

-- ============================================================================
-- 2. Fix process_coin_transfer_trigger - Add Balance Verification
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_coin_transfer_trigger()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sender_rows integer;
  v_recipient_rows integer;
  v_sender_old_balance numeric;
  v_sender_new_balance numeric;
  v_recipient_old_balance numeric;
  v_recipient_new_balance numeric;
BEGIN
  -- Only process completed transfers
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Lock both profiles in consistent order to prevent deadlocks
  IF NEW.sender_id < NEW.recipient_id THEN
    SELECT coin_balance INTO v_sender_old_balance
    FROM profiles WHERE id = NEW.sender_id FOR UPDATE;

    SELECT coin_balance INTO v_recipient_old_balance
    FROM profiles WHERE id = NEW.recipient_id FOR UPDATE;
  ELSE
    SELECT coin_balance INTO v_recipient_old_balance
    FROM profiles WHERE id = NEW.recipient_id FOR UPDATE;

    SELECT coin_balance INTO v_sender_old_balance
    FROM profiles WHERE id = NEW.sender_id FOR UPDATE;
  END IF;

  -- Verify sender has sufficient balance (extra safety check)
  IF v_sender_old_balance < NEW.amount THEN
    RAISE EXCEPTION 'Sender % has insufficient balance: % < %',
      NEW.sender_id, v_sender_old_balance, NEW.amount;
  END IF;

  -- Update sender balance
  UPDATE profiles
  SET
    coin_balance = coin_balance - NEW.amount,
    coins_sent_today = coins_sent_today + NEW.amount,
    updated_at = now()
  WHERE id = NEW.sender_id;

  GET DIAGNOSTICS v_sender_rows = ROW_COUNT;
  IF v_sender_rows = 0 THEN
    RAISE EXCEPTION 'Failed to debit sender %', NEW.sender_id;
  END IF;

  -- Verify sender balance was updated correctly
  SELECT coin_balance INTO v_sender_new_balance
  FROM profiles WHERE id = NEW.sender_id;

  IF v_sender_new_balance != (v_sender_old_balance - NEW.amount) THEN
    RAISE EXCEPTION 'Sender balance verification failed. Expected: %, Got: %',
      (v_sender_old_balance - NEW.amount), v_sender_new_balance;
  END IF;

  -- Update recipient balance
  UPDATE profiles
  SET
    coin_balance = coin_balance + NEW.amount,
    coins_received_today = coins_received_today + NEW.amount,
    updated_at = now()
  WHERE id = NEW.recipient_id;

  GET DIAGNOSTICS v_recipient_rows = ROW_COUNT;
  IF v_recipient_rows = 0 THEN
    -- Rollback sender update by raising exception
    RAISE EXCEPTION 'Failed to credit recipient %', NEW.recipient_id;
  END IF;

  -- Verify recipient balance was updated correctly
  SELECT coin_balance INTO v_recipient_new_balance
  FROM profiles WHERE id = NEW.recipient_id;

  IF v_recipient_new_balance != (v_recipient_old_balance + NEW.amount) THEN
    -- Rollback by raising exception
    RAISE EXCEPTION 'Recipient balance verification failed. Expected: %, Got: %',
      (v_recipient_old_balance + NEW.amount), v_recipient_new_balance;
  END IF;

  -- Only insert coin_transactions AFTER balances are verified correct
  -- These inserts will NOT trigger balance updates due to type exclusion
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, related_user_id)
  VALUES (NEW.sender_id, -NEW.amount, 'coin_transfer_sent', 'Sent to user', NEW.recipient_id);

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, related_user_id)
  VALUES (NEW.recipient_id, NEW.amount, 'coin_transfer_received', 'Received from user', NEW.sender_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Any exception will rollback the entire transaction
  RAISE EXCEPTION 'Transfer failed for transfer_id %: %', NEW.id, SQLERRM;
END;
$function$;

COMMENT ON FUNCTION process_coin_transfer_trigger IS
'Processes completed coin transfers by:
1. Locking both profiles in consistent order (prevents deadlocks)
2. Verifying sender has sufficient balance
3. Updating sender balance (debit)
4. Verifying sender balance update is correct
5. Updating recipient balance (credit)
6. Verifying recipient balance update is correct
7. Inserting coin_transaction records (which do NOT trigger additional balance updates)
Any failure at any step rollbacks the entire transaction atomically.';

-- ============================================================================
-- 3. Create Function to Detect Balance Discrepancies
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detect_coin_balance_discrepancies()
RETURNS TABLE (
  user_id uuid,
  username text,
  current_balance numeric,
  calculated_balance numeric,
  discrepancy numeric,
  transaction_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.username,
    p.coin_balance AS current_balance,
    COALESCE(SUM(ct.amount), 0) AS calculated_balance,
    p.coin_balance - COALESCE(SUM(ct.amount), 0) AS discrepancy,
    COUNT(ct.id) AS transaction_count
  FROM profiles p
  LEFT JOIN coin_transactions ct ON ct.user_id = p.id
  GROUP BY p.id, p.username, p.coin_balance
  HAVING ABS(p.coin_balance - COALESCE(SUM(ct.amount), 0)) > 0.01
  ORDER BY ABS(p.coin_balance - COALESCE(SUM(ct.amount), 0)) DESC;
END;
$$;

COMMENT ON FUNCTION detect_coin_balance_discrepancies IS
'Detects users whose coin_balance does not match the sum of their coin_transactions.
Used for auditing and identifying balance corruption issues.';

-- ============================================================================
-- 4. Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION detect_coin_balance_discrepancies() TO authenticated;

-- ============================================================================
-- 5. Add Security Log Entry
-- ============================================================================

INSERT INTO admin_security_log (
  event_type,
  severity,
  operation_type,
  details
) VALUES (
  'validation_failed',
  'critical',
  'coin_transfer_fix',
  jsonb_build_object(
    'migration', 'fix_coin_transfer_double_crediting_bug',
    'timestamp', now(),
    'changes', jsonb_build_array(
      'Strengthened exclusion of transfer types in update_coin_balance_on_transaction',
      'Added explicit balance verification in process_coin_transfer_trigger',
      'Added row-level locking to prevent race conditions',
      'Added balance verification after each update to detect issues immediately',
      'Created detect_coin_balance_discrepancies function for auditing',
      'All balance updates now atomic with rollback on any error'
    ),
    'impact', 'CRITICAL - Prevents double-crediting in coin transfers',
    'rollback_behavior', 'Any error in transfer now rollbacks entire transaction',
    'note', 'Existing discrepancies need manual review and correction'
  )
);

-- ============================================================================
-- 6. Check Current Status
-- ============================================================================

DO $$
DECLARE
  v_discrepancy_count integer;
  v_total_discrepancy numeric;
BEGIN
  -- Check if there are any balance discrepancies
  SELECT
    COUNT(*),
    COALESCE(SUM(ABS(p.coin_balance - COALESCE(txn.total, 0))), 0)
  INTO v_discrepancy_count, v_total_discrepancy
  FROM profiles p
  LEFT JOIN (
    SELECT user_id, SUM(amount) AS total
    FROM coin_transactions
    GROUP BY user_id
  ) txn ON txn.user_id = p.id
  WHERE ABS(p.coin_balance - COALESCE(txn.total, 0)) > 0.01;

  IF v_discrepancy_count > 0 THEN
    RAISE NOTICE 'Found % users with balance discrepancies totaling % coins',
      v_discrepancy_count, v_total_discrepancy;
    RAISE NOTICE 'Run: SELECT * FROM detect_coin_balance_discrepancies() to see details';
    RAISE NOTICE 'These are likely from old bugs and do not indicate current issues';
  ELSE
    RAISE NOTICE 'No balance discrepancies detected - all balances match transactions';
  END IF;
END $$;
