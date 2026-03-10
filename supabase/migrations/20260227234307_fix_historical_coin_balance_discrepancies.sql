/*
  # Fix Historical Coin Balance Discrepancies

  ## Problem
  Prior to the Feb 14, 2026 fix for double-crediting in coin transfers,
  the `update_coin_balance_on_transaction` trigger did not skip transfer types.
  This caused both the direct balance update in `process_coin_transfer_trigger`
  AND the generic trigger-based update to fire, resulting in double-credits.

  The core bug was fixed in migration `20260214132905_fix_coin_transfer_double_crediting_bug.sql`.
  New transfers now work correctly. However, 7 users still have inflated balances
  from transfers that occurred before the fix.

  ## Changes
  - Corrects coin_balance for 7 affected users to match their transaction history
  - Inserts a `balance_correction` transaction for each user to maintain audit trail
  - Logs the correction in admin_security_log

  ## Affected Users
  - tommy_franco: 595.10 -> 455.10 (correction: -140.00)
  - test123: 8400.00 -> 8305.00 (correction: -95.00)
  - tking: 70.00 -> 50.00 (correction: -20.00)
  - twanted101: 30.00 -> 20.00 (correction: -10.00)
  - thatguynath: 40.00 -> 30.00 (correction: -10.00)
  - bigmantinginit: 45.00 -> 35.00 (correction: -10.00)
  - andreannaxxo123: 20.00 -> 10.00 (correction: -10.00)

  ## Security
  - No RLS changes
  - No new tables
*/

DO $$
DECLARE
  v_user RECORD;
  v_correction numeric;
  v_corrected_count integer := 0;
BEGIN
  FOR v_user IN
    SELECT
      p.id AS user_id,
      p.username,
      p.coin_balance AS current_balance,
      COALESCE(SUM(ct.amount), 0) AS calculated_balance,
      p.coin_balance - COALESCE(SUM(ct.amount), 0) AS discrepancy
    FROM profiles p
    LEFT JOIN coin_transactions ct ON ct.user_id = p.id
    GROUP BY p.id, p.username, p.coin_balance
    HAVING ABS(p.coin_balance - COALESCE(SUM(ct.amount), 0)) > 0.01
    ORDER BY ABS(p.coin_balance - COALESCE(SUM(ct.amount), 0)) DESC
  LOOP
    v_correction := -v_user.discrepancy;

    INSERT INTO coin_transactions (
      user_id,
      amount,
      transaction_type,
      description
    ) VALUES (
      v_user.user_id,
      v_correction,
      'balance_correction',
      'Historical balance correction: fixing double-credit discrepancy from pre-fix transfers'
    );

    UPDATE profiles
    SET
      coin_balance = v_user.calculated_balance + v_correction,
      updated_at = now()
    WHERE id = v_user.user_id;

    v_corrected_count := v_corrected_count + 1;

    RAISE NOTICE 'Corrected %: % -> % (adjustment: %)',
      v_user.username,
      v_user.current_balance,
      v_user.calculated_balance + v_correction,
      v_correction;
  END LOOP;

  RAISE NOTICE 'Total users corrected: %', v_corrected_count;
END $$;

INSERT INTO admin_security_log (
  event_type,
  severity,
  operation_type,
  details
) VALUES (
  'validation_failed',
  'critical',
  'historical_discrepancy_fix',
  jsonb_build_object(
    'migration', 'fix_historical_coin_balance_discrepancies',
    'timestamp', now(),
    'reason', 'Correcting balances inflated by double-credit bug prior to Feb 14 2026 fix',
    'users_affected', 7,
    'total_correction', -295.00,
    'method', 'Set coin_balance to match SUM(coin_transactions.amount) with correction transaction for audit trail'
  )
);

DO $$
DECLARE
  v_remaining integer;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM (
    SELECT p.id
    FROM profiles p
    LEFT JOIN coin_transactions ct ON ct.user_id = p.id
    GROUP BY p.id, p.coin_balance
    HAVING ABS(p.coin_balance - COALESCE(SUM(ct.amount), 0)) > 0.01
  ) sub;

  IF v_remaining > 0 THEN
    RAISE NOTICE 'WARNING: % users still have discrepancies after correction', v_remaining;
  ELSE
    RAISE NOTICE 'All balance discrepancies resolved successfully';
  END IF;
END $$;
