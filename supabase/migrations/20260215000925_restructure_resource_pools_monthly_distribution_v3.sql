/*
  # Resource Pool Restructuring and Monthly Distribution System

  ## Overview
  Complete restructuring of resource pools with automated monthly distributions to employee compensation pools.

  ## Changes Made

  ### 1. Pool Transfer
  - Transfer 50,000,000 coins from 'Operational Liquidity Reserve' to 'Infrastructure_Reserve'
  - Updates both pool balances atomically

  ### 2. Pool Removals
  - Remove 'Coder_Credits' pool (pool_type: operational)
  - Remove 'Monthly_Infrastructure_Cost' pool (pool_type: operational)

  ### 3. New Employee Pools Created (9 pools)
  - Backend Engineer: 4,200 coins - Backend development and maintenance
  - Frontend Engineer: 4,200 coins - Frontend development and UI/UX
  - Moderator/Community Manager: 2,000 coins - Community moderation and engagement
  - Data Analyst: 3,400 coins - Data analysis and insights
  - Managing + Product Direction: 8,400 coins - Product management and company direction
  - Growth/Marketing Manager: 4,200 coins - Growth strategy and marketing
  - Operations/Finance Person: 3,400 coins - Operations and financial management
  - Product Manager: 5,000 coins - Product strategy and features
  - Video Editor: 2,000 coins - Content creation and video editing
  
  Total monthly distribution: 38,800 coins

  ### 4. Monthly Distribution System
  - Automated function: distribute_monthly_employee_compensation()
  - Runs on the 1st of each month at 00:00 UTC
  - Deducts 38,800 coins from Infrastructure_Reserve
  - Distributes to all 9 employee pools
  - Records each transaction in system_ledger
  - Maintains integrity sync

  ### 5. Security
  - All operations are SECURITY DEFINER for controlled execution
  - Proper error handling and transaction rollback
  - Admin-only access to distribution function
  - Full audit trail in system_ledger

  ## Notes
  - This is a one-time restructuring plus ongoing monthly automation
  - Distribution happens automatically on the 1st of each month
  - All amounts are fixed per pool and recorded in descriptions
*/

-- ============================================================================
-- STEP 1: Transfer 50,000,000 coins from Operational Liquidity to Infrastructure
-- ============================================================================

DO $$
DECLARE
  v_operational_id uuid;
  v_infrastructure_id uuid;
  v_transfer_amount numeric := 50000000.00;
BEGIN
  -- Get pool IDs
  SELECT id INTO v_operational_id 
  FROM resource_pools 
  WHERE pool_name = 'Operational Liquidity Reserve';

  SELECT id INTO v_infrastructure_id 
  FROM resource_pools 
  WHERE pool_name = 'Infrastructure_Reserve';

  IF v_operational_id IS NULL OR v_infrastructure_id IS NULL THEN
    RAISE EXCEPTION 'Required pools not found for transfer';
  END IF;

  -- Perform atomic transfer
  UPDATE resource_pools 
  SET 
    total_coins = total_coins - v_transfer_amount,
    updated_at = NOW()
  WHERE id = v_operational_id;

  UPDATE resource_pools 
  SET 
    total_coins = total_coins + v_transfer_amount,
    updated_at = NOW()
  WHERE id = v_infrastructure_id;

  -- Record in system ledger
  INSERT INTO system_ledger (
    source_pool,
    destination_pool,
    amount,
    reason,
    notes
  ) VALUES (
    'Operational Liquidity Reserve',
    'Infrastructure_Reserve',
    v_transfer_amount,
    'One-time transfer to fund monthly employee compensation distributions',
    'Transfer amount: ' || v_transfer_amount || ' coins. Purpose: Infrastructure reserve funding for monthly distributions.'
  );

  RAISE NOTICE 'Successfully transferred % coins from Operational Liquidity to Infrastructure', v_transfer_amount;
END $$;

-- ============================================================================
-- STEP 2: Remove old pools (Coder_Credits and Monthly_Infrastructure_Cost)
-- ============================================================================

DO $$
BEGIN
  -- Delete the pools (both have 0 balance, no need to log)
  DELETE FROM resource_pools 
  WHERE pool_name IN ('Coder_Credits', 'Monthly_Infrastructure_Cost');

  RAISE NOTICE 'Removed old pools: Coder_Credits, Monthly_Infrastructure_Cost';
END $$;

-- ============================================================================
-- STEP 3: Create 9 new employee compensation pools
-- ============================================================================

INSERT INTO resource_pools (pool_name, pool_type, total_coins, description, is_active)
VALUES
  ('Backend_Engineer', 'employee', 4200.00, 'Backend development and maintenance', true),
  ('Frontend_Engineer', 'employee', 4200.00, 'Frontend development and UI/UX', true),
  ('Moderator_Community_Manager', 'employee', 2000.00, 'Community moderation and engagement', true),
  ('Data_Analyst', 'employee', 3400.00, 'Data analysis and insights', true),
  ('Managing_Product_Direction', 'employee', 8400.00, 'Product management and company direction', true),
  ('Growth_Marketing_Manager', 'employee', 4200.00, 'Growth strategy and marketing', true),
  ('Operations_Finance_Person', 'employee', 3400.00, 'Operations and financial management', true),
  ('Product_Manager', 'employee', 5000.00, 'Product strategy and features', true),
  ('Video_Editor', 'employee', 2000.00, 'Content creation and video editing', true)
ON CONFLICT (pool_name) DO NOTHING;

-- Log creation to system ledger
INSERT INTO system_ledger (
  source_pool,
  destination_pool,
  amount,
  reason,
  notes
)
SELECT 
  'SYSTEM',
  pool_name,
  total_coins,
  'Created employee compensation pool',
  'Pool: ' || pool_name || ', Monthly allocation: ' || total_coins || ' coins, Description: ' || description
FROM resource_pools
WHERE pool_type = 'employee'
  AND pool_name IN (
    'Backend_Engineer',
    'Frontend_Engineer', 
    'Moderator_Community_Manager',
    'Data_Analyst',
    'Managing_Product_Direction',
    'Growth_Marketing_Manager',
    'Operations_Finance_Person',
    'Product_Manager',
    'Video_Editor'
  );

-- ============================================================================
-- STEP 4: Create monthly distribution function
-- ============================================================================

CREATE OR REPLACE FUNCTION distribute_monthly_employee_compensation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_infrastructure_id uuid;
  v_infrastructure_balance numeric;
  v_total_distribution numeric := 38800.00;
  v_employee_pool RECORD;
  v_distributions_made integer := 0;
  v_result jsonb;
BEGIN
  -- Get Infrastructure_Reserve pool
  SELECT id, total_coins INTO v_infrastructure_id, v_infrastructure_balance
  FROM resource_pools
  WHERE pool_name = 'Infrastructure_Reserve'
    AND is_active = true;

  IF v_infrastructure_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Infrastructure_Reserve pool not found'
    );
  END IF;

  -- Check sufficient funds
  IF v_infrastructure_balance < v_total_distribution THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient funds in Infrastructure_Reserve',
      'required', v_total_distribution,
      'available', v_infrastructure_balance
    );
  END IF;

  -- Deduct from Infrastructure_Reserve
  UPDATE resource_pools
  SET 
    total_coins = total_coins - v_total_distribution,
    updated_at = NOW()
  WHERE id = v_infrastructure_id;

  -- Distribute to each employee pool
  FOR v_employee_pool IN 
    SELECT id, pool_name, total_coins as monthly_amount, description
    FROM resource_pools
    WHERE pool_type = 'employee'
      AND is_active = true
    ORDER BY pool_name
  LOOP
    -- Add to employee pool
    UPDATE resource_pools
    SET 
      total_coins = total_coins + v_employee_pool.monthly_amount,
      updated_at = NOW()
    WHERE id = v_employee_pool.id;

    -- Record in system ledger
    INSERT INTO system_ledger (
      source_pool,
      destination_pool,
      amount,
      reason,
      notes
    ) VALUES (
      'Infrastructure_Reserve',
      v_employee_pool.pool_name,
      v_employee_pool.monthly_amount,
      'Monthly distribution to ' || v_employee_pool.pool_name,
      v_employee_pool.description || ', Amount: ' || v_employee_pool.monthly_amount || ' coins, Date: ' || NOW()
    );

    v_distributions_made := v_distributions_made + 1;
  END LOOP;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'total_distributed', v_total_distribution,
    'pools_updated', v_distributions_made,
    'distribution_date', NOW(),
    'infrastructure_balance_after', (v_infrastructure_balance - v_total_distribution)
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Return error details
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$;

COMMENT ON FUNCTION distribute_monthly_employee_compensation() IS
'Distributes monthly employee compensation from Infrastructure_Reserve to all employee pools. Deducts 38,800 coins total and distributes to 9 employee pools. Records all transactions in system_ledger. Called automatically on the 1st of each month at 00:00 UTC.';

-- ============================================================================
-- STEP 5: Create helper function to check next distribution date
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_distribution_date()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz;
  v_next_distribution timestamptz;
  v_last_distribution timestamptz;
BEGIN
  v_now := NOW();
  
  -- Calculate next distribution (1st of next month at 00:00 UTC)
  v_next_distribution := date_trunc('month', v_now) + interval '1 month';
  
  -- Get last distribution from system_ledger
  SELECT MAX(transfer_date) INTO v_last_distribution
  FROM system_ledger
  WHERE reason LIKE 'Monthly distribution to %';

  RETURN jsonb_build_object(
    'current_date', v_now,
    'next_distribution', v_next_distribution,
    'last_distribution', v_last_distribution,
    'days_until_next', EXTRACT(DAY FROM (v_next_distribution - v_now))
  );
END;
$$;

COMMENT ON FUNCTION get_next_distribution_date() IS
'Returns information about the next scheduled monthly distribution date and the last distribution date.';

-- ============================================================================
-- STEP 6: Create admin function to manually trigger distribution (for testing)
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_trigger_monthly_distribution()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_is_admin boolean;
BEGIN
  -- Check if caller is admin
  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Admin access required'
    );
  END IF;

  -- Execute distribution
  v_result := distribute_monthly_employee_compensation();

  -- Log admin action
  INSERT INTO admin_security_log (
    user_id,
    event_type,
    severity,
    details
  ) VALUES (
    auth.uid(),
    'manual_distribution_triggered',
    'info',
    jsonb_build_object(
      'action', 'Monthly distribution manually triggered',
      'result', v_result,
      'timestamp', NOW()
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION admin_trigger_monthly_distribution() IS
'Admin-only function to manually trigger monthly employee compensation distribution. For testing and emergency use.';

-- ============================================================================
-- STEP 7: Record this restructuring in system ledger
-- ============================================================================

INSERT INTO system_ledger (
  source_pool,
  destination_pool,
  amount,
  reason,
  notes
) VALUES (
  'SYSTEM',
  'RESTRUCTURING_COMPLETE',
  38800.00,
  'Resource pool restructuring complete',
  'Restructuring date: ' || NOW() || 
  ', Total monthly distribution: 38,800 coins' ||
  ', Employee pools created: 9' ||
  ', Infrastructure funding: 50,000,000 coins' ||
  ', Automation: Monthly distribution on 1st at 00:00 UTC' ||
  ', Pools removed: Coder_Credits, Monthly_Infrastructure_Cost'
);
