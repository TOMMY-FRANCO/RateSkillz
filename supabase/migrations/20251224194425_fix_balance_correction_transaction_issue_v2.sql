/*
  # Fix Balance Correction Transaction Issue

  ## Problem
  The previous correction transaction (-31.10) triggered the automatic balance update,
  causing the balance to be incorrect (19.00 instead of 50.10).

  ## Solution
  1. Delete the erroneous correction transaction
  2. Manually fix the balance to match the legitimate transaction sum
  3. The correction is documented in the audit log table

  ## Impact
  - Removes the -31.10 correction transaction that caused balance mismatch
  - Sets balance to 50.10 (matching legitimate transaction history)
  - Audit trail maintained in balance_audit_log table
*/

DO $$
DECLARE
  v_tommy_user_id uuid;
  v_correction_tx_id uuid;
  v_legitimate_sum numeric;
  v_audit_log_id uuid;
BEGIN
  -- Get tommy_franco's user ID
  SELECT id INTO v_tommy_user_id
  FROM profiles
  WHERE username = 'tommy_franco';

  IF v_tommy_user_id IS NULL THEN
    RAISE NOTICE 'User tommy_franco not found';
    RETURN;
  END IF;

  -- Delete the erroneous balance_correction transaction
  DELETE FROM coin_transactions
  WHERE user_id = v_tommy_user_id
    AND transaction_type = 'balance_correction'
  RETURNING id INTO v_correction_tx_id;

  IF v_correction_tx_id IS NOT NULL THEN
    RAISE NOTICE '✓ Deleted erroneous correction transaction: %', v_correction_tx_id;
  END IF;

  -- Calculate legitimate transaction sum (without corrections)
  SELECT COALESCE(SUM(amount), 0) INTO v_legitimate_sum
  FROM coin_transactions
  WHERE user_id = v_tommy_user_id;

  RAISE NOTICE 'Legitimate transaction sum: % coins', v_legitimate_sum;

  -- Manually set balance to match legitimate transactions
  UPDATE coins
  SET 
    balance = v_legitimate_sum,
    updated_at = now()
  WHERE user_id = v_tommy_user_id;

  RAISE NOTICE '✓ Balance corrected to: % coins', v_legitimate_sum;

  -- Update the audit log to reflect the correction
  SELECT id INTO v_audit_log_id
  FROM balance_audit_log
  WHERE user_id = v_tommy_user_id
    AND correction_type = 'balance_sync'
  ORDER BY corrected_at DESC
  LIMIT 1;

  IF v_audit_log_id IS NOT NULL THEN
    UPDATE balance_audit_log
    SET 
      notes = notes || ' Correction transaction removed; balance manually adjusted to match transaction history.',
      corrected_at = now()
    WHERE id = v_audit_log_id;
    
    RAISE NOTICE '✓ Audit log updated';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'BALANCE CORRECTION COMPLETE';
  RAISE NOTICE 'Final balance: % coins', v_legitimate_sum;
  RAISE NOTICE '========================================';

EXCEPTION 
  WHEN OTHERS THEN
    RAISE WARNING 'Error fixing balance: %', SQLERRM;
    RAISE;
END $$;

-- Verify the fix
DO $$
DECLARE
  v_validation RECORD;
BEGIN
  SELECT * INTO v_validation
  FROM validate_all_user_balances()
  WHERE username = 'tommy_franco';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDATION CHECK';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Username: %', v_validation.username;
  RAISE NOTICE 'Current balance: %', v_validation.current_balance;
  RAISE NOTICE 'Transaction sum: %', v_validation.transaction_sum;
  RAISE NOTICE 'Discrepancy: %', v_validation.discrepancy;
  RAISE NOTICE 'Is consistent: %', v_validation.is_consistent;
  RAISE NOTICE '========================================';

  IF v_validation.is_consistent THEN
    RAISE NOTICE '✓ SUCCESS: Balance is now consistent with transaction history!';
  ELSE
    RAISE WARNING '⚠ Balance still inconsistent. Manual review required.';
  END IF;
END $$;
