/*
  # Add Pull-Based Balance Integrity Check

  ## Purpose
  Creates an on-demand balance integrity check that users can trigger manually
  via pull-to-refresh on Dashboard or Transaction History pages.

  ## Changes
  1. Creates check_balance_integrity() RPC function
     - Returns current user's balance status
     - Compares profile balance with transaction sum
     - NO automatic corrections
     - NO real-time monitoring
     - Pull-based only

  ## Security
  - Function uses auth.uid() to check only the current user
  - SECURITY DEFINER for accessing balance data
  - Returns boolean and numeric values only

  ## Usage
  Called from frontend on manual refresh:
  - Dashboard pull-to-refresh
  - Transaction History pull-to-refresh
  - Manual "Check Balance" button
*/

-- ============================================================================
-- Create Pull-Based Balance Integrity Check Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_balance_integrity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_profile_balance numeric;
  v_calculated_balance numeric;
  v_discrepancy numeric;
  v_has_discrepancy boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Get profile balance
  SELECT coin_balance INTO v_profile_balance
  FROM profiles
  WHERE id = v_user_id;

  IF v_profile_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile not found'
    );
  END IF;

  -- Calculate balance from transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_calculated_balance
  FROM coin_transactions
  WHERE user_id = v_user_id;

  -- Calculate discrepancy
  v_discrepancy := v_profile_balance - v_calculated_balance;
  v_has_discrepancy := ABS(v_discrepancy) > 0.01;

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'has_discrepancy', v_has_discrepancy,
    'profile_balance', v_profile_balance,
    'calculated_balance', v_calculated_balance,
    'discrepancy', v_discrepancy,
    'checked_at', now()
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION check_balance_integrity IS
'Pull-based balance integrity check for current user.
Called manually via pull-to-refresh or refresh button.
Returns balance comparison without making any corrections.
NO real-time monitoring or automatic triggers.';

-- ============================================================================
-- Grant Permission
-- ============================================================================

GRANT EXECUTE ON FUNCTION check_balance_integrity() TO authenticated;

-- ============================================================================
-- Log Migration
-- ============================================================================

INSERT INTO admin_security_log (
  event_type,
  severity,
  operation_type,
  details
) VALUES (
  'validation_failed',
  'info',
  'balance_check_system',
  jsonb_build_object(
    'migration', 'add_pull_based_balance_integrity_check',
    'timestamp', now(),
    'changes', jsonb_build_array(
      'Created check_balance_integrity() RPC function',
      'Pull-based only - NO real-time monitoring',
      'Users can manually check via pull-to-refresh',
      'Returns discrepancy info without corrections',
      'Scoped to current authenticated user only'
    ),
    'usage', 'Called from Dashboard and Transaction History on manual refresh'
  )
);
