/*
  # Fix Coin Pool Trigger - Add Missing WHERE Clause

  ## Problem
  The update_coin_pool_on_balance_change() trigger function has an UPDATE statement
  without a WHERE clause on line 174-177:
  
  ```sql
  UPDATE coin_pool
  SET 
    distributed_coins = distributed_coins + balance_delta,
    updated_at = now();
  ```

  This causes "UPDATE requires a WHERE clause" errors when coin transfers are executed,
  as the trigger fires when profiles.coin_balance is updated.

  ## Root Cause
  PostgreSQL/Supabase requires WHERE clauses on all UPDATE statements for safety.
  The trigger was updating all rows in coin_pool without specifying which row.

  ## Solution
  Add WHERE clause to UPDATE statement in the trigger function.
  Since there's only one row in coin_pool (community pool), we add:
  `WHERE pool_type = 'community'` or `WHERE id IS NOT NULL`

  ## Testing
  - Verified error appears in admin_security_log with message "UPDATE requires a WHERE clause"
  - Verified process_coin_transfer() contains correct WHERE clauses
  - Verified trigger function is the source of the error
  - Fix will allow coin transfers to work properly

  ## Changes
  1. Recreate update_coin_pool_on_balance_change() trigger function with WHERE clause
  2. Test coin transfer to ensure it works
*/

-- ============================================================================
-- FIX TRIGGER FUNCTION - ADD WHERE CLAUSE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_coin_pool_on_balance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  balance_delta numeric;
BEGIN
  -- Calculate change in balance
  IF TG_OP = 'INSERT' THEN
    balance_delta := NEW.coin_balance;
  ELSIF TG_OP = 'UPDATE' THEN
    balance_delta := NEW.coin_balance - OLD.coin_balance;
  ELSIF TG_OP = 'DELETE' THEN
    balance_delta := -OLD.coin_balance;
  END IF;
  
  -- Update coin_pool.distributed_coins atomically
  -- CRITICAL FIX: Added WHERE clause to prevent "UPDATE requires a WHERE clause" error
  IF balance_delta != 0 THEN
    UPDATE coin_pool
    SET 
      distributed_coins = distributed_coins + balance_delta,
      updated_at = now()
    WHERE pool_type = 'community';  -- FIXED: Added WHERE clause
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Log the fix
INSERT INTO admin_security_log (
  event_type,
  severity,
  operation_type,
  details
) VALUES (
  'validation_failed',
  'info',
  'migration_complete',
  jsonb_build_object(
    'migration', 'fix_coin_pool_trigger_add_where_clause',
    'timestamp', NOW() AT TIME ZONE 'GMT',
    'fix', 'Added WHERE clause to UPDATE statement in update_coin_pool_on_balance_change() trigger',
    'issue', 'UPDATE requires a WHERE clause error was blocking all coin transfers',
    'solution', 'Added WHERE pool_type = ''community'' to UPDATE coin_pool statement'
  )
);
