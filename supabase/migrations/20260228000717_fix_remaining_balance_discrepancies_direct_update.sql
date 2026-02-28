/*
  # Fix Remaining Balance Discrepancies (Direct UPDATE Only)

  ## Problem
  The previous correction migration (20260227234307) inserted `balance_correction`
  transactions which inadvertently triggered `update_coin_balance_on_transaction`,
  causing double-application of corrections. This left 2 users with inflated balances.

  ## Approach
  - Direct UPDATE of profiles.coin_balance to match SUM(coin_transactions.amount)
  - NO INSERT into coin_transactions (avoids triggering balance update triggers)
  - Audit trail via admin_security_log only

  ## Affected Users
  - tommy_franco: 440.10 -> 310.10 (correction: -130.00)
  - test123: 8330.00 -> 8225.00 (correction: -105.00)

  ## Security
  - No RLS changes
  - No new tables
  - No trigger modifications
*/

DO $$
DECLARE
  v_user RECORD;
  v_corrected_count integer := 0;
BEGIN
  FOR v_user IN
    SELECT
      p.id AS user_id,
      p.username,
      p.coin_balance AS current_balance,
      COALESCE(SUM(ct.amount), 0) AS correct_balance,
      p.coin_balance - COALESCE(SUM(ct.amount), 0) AS discrepancy
    FROM profiles p
    LEFT JOIN coin_transactions ct ON ct.user_id = p.id
    GROUP BY p.id, p.username, p.coin_balance
    HAVING ABS(p.coin_balance - COALESCE(SUM(ct.amount), 0)) > 0.01
    ORDER BY ABS(p.coin_balance - COALESCE(SUM(ct.amount), 0)) DESC
  LOOP
    UPDATE profiles
    SET
      coin_balance = v_user.correct_balance,
      updated_at = now()
    WHERE id = v_user.user_id;

    v_corrected_count := v_corrected_count + 1;

    RAISE NOTICE 'Corrected %: % -> % (removed excess: %)',
      v_user.username,
      v_user.current_balance,
      v_user.correct_balance,
      v_user.discrepancy;
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
  'direct_balance_correction',
  jsonb_build_object(
    'migration', 'fix_remaining_balance_discrepancies_direct_update',
    'timestamp', now(),
    'reason', 'Previous correction migration double-applied due to balance_correction type triggering update_coin_balance_on_transaction. This migration uses direct UPDATE only.',
    'users_affected', 2,
    'total_correction', -235.00,
    'method', 'Direct UPDATE profiles SET coin_balance = SUM(coin_transactions.amount) with no INSERT into coin_transactions'
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
    RAISE EXCEPTION 'FAILED: % users still have discrepancies after correction', v_remaining;
  ELSE
    RAISE NOTICE 'All balance discrepancies resolved successfully - 0 remaining';
  END IF;
END $$;
