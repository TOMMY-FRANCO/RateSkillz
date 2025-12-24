/*
  # Add Running Balance Column to Transaction History

  ## Summary
  Adds `balance_after` column to track cumulative balance after each transaction.
  Creates trigger to automatically calculate running balance on each transaction insert.
  Adds validation to ensure transaction history sum matches current user balance.

  ## Changes Made
  1. Add `balance_after` column to `coin_transactions` table
  2. Create function to calculate and set balance_after for new transactions
  3. Create trigger to automatically update balance_after on insert
  4. Backfill existing transactions with calculated balance_after values
  5. Add validation function to check balance consistency

  ## Database Impact
  - Schema: Add balance_after numeric column
  - Triggers: Auto-calculate running balance on transaction insert
  - Data: Backfill existing transactions with running balances
  - Validation: Function to verify transaction sum matches current balance

  ## How It Works
  When a transaction is inserted:
  1. Get user's previous transaction balance_after (or 0 if first transaction)
  2. Add current transaction amount to previous balance
  3. Store result in balance_after column
  4. This creates running balance visible in transaction history

  ## Example
  User starts with 0 coins:
  - Transaction 1: +10 coins → balance_after: 10
  - Transaction 2: +0.1 coins → balance_after: 10.1
  - Transaction 3: -20 coins → balance_after: -9.9 (negative if spent more)
  - Transaction 4: +30 coins → balance_after: 20.1

  ## Validation
  Sum of all transactions should equal current balance in coins table.
  Discrepancies indicate data integrity issues requiring investigation.
*/

-- Step 1: Add balance_after column to coin_transactions table
ALTER TABLE coin_transactions 
ADD COLUMN IF NOT EXISTS balance_after numeric(10,2);

-- Step 2: Create function to calculate running balance for new transactions
CREATE OR REPLACE FUNCTION calculate_transaction_running_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_previous_balance numeric;
BEGIN
  -- Get the balance_after from the most recent transaction for this user
  SELECT COALESCE(balance_after, 0)
  INTO v_previous_balance
  FROM coin_transactions
  WHERE user_id = NEW.user_id
    AND created_at < NEW.created_at
  ORDER BY created_at DESC, id DESC
  LIMIT 1;
  
  -- If no previous transaction found, start from 0
  IF v_previous_balance IS NULL THEN
    v_previous_balance := 0;
  END IF;
  
  -- Calculate new balance after this transaction
  NEW.balance_after := v_previous_balance + NEW.amount;
  
  RETURN NEW;
END;
$$;

-- Step 3: Create trigger to automatically calculate balance_after on insert
DROP TRIGGER IF EXISTS set_transaction_running_balance ON coin_transactions;

CREATE TRIGGER set_transaction_running_balance
  BEFORE INSERT ON coin_transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_transaction_running_balance();

-- Step 4: Backfill existing transactions with running balances
-- This calculates balance_after for all existing transactions
DO $$
DECLARE
  v_user_id uuid;
  v_running_balance numeric;
  v_transaction record;
BEGIN
  -- Process each user's transactions
  FOR v_user_id IN 
    SELECT DISTINCT user_id FROM coin_transactions WHERE balance_after IS NULL
  LOOP
    v_running_balance := 0;
    
    -- Process transactions in chronological order
    FOR v_transaction IN
      SELECT id, amount, created_at
      FROM coin_transactions
      WHERE user_id = v_user_id AND balance_after IS NULL
      ORDER BY created_at ASC, id ASC
    LOOP
      v_running_balance := v_running_balance + v_transaction.amount;
      
      UPDATE coin_transactions
      SET balance_after = v_running_balance
      WHERE id = v_transaction.id;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Backfilled running balances for all existing transactions';
END $$;

-- Step 5: Create validation function to check balance consistency
CREATE OR REPLACE FUNCTION validate_user_balance_consistency(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transaction_sum numeric;
  v_current_balance numeric;
  v_latest_balance_after numeric;
  v_discrepancy numeric;
  v_result json;
BEGIN
  -- Get sum of all transactions
  SELECT COALESCE(SUM(amount), 0)
  INTO v_transaction_sum
  FROM coin_transactions
  WHERE user_id = p_user_id;
  
  -- Get current balance from coins table
  SELECT COALESCE(balance, 0)
  INTO v_current_balance
  FROM coins
  WHERE user_id = p_user_id;
  
  -- Get latest balance_after from transactions
  SELECT COALESCE(balance_after, 0)
  INTO v_latest_balance_after
  FROM coin_transactions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;
  
  -- Calculate discrepancy
  v_discrepancy := v_current_balance - v_transaction_sum;
  
  -- Build result
  v_result := json_build_object(
    'user_id', p_user_id,
    'transaction_sum', v_transaction_sum,
    'current_balance', v_current_balance,
    'latest_balance_after', v_latest_balance_after,
    'discrepancy', v_discrepancy,
    'is_consistent', ABS(v_discrepancy) < 0.01,
    'balance_after_matches_sum', ABS(v_latest_balance_after - v_transaction_sum) < 0.01,
    'balance_matches_sum', ABS(v_current_balance - v_transaction_sum) < 0.01
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION validate_user_balance_consistency IS 
'Validates that user''s transaction history sum matches their current balance.
Returns JSON with transaction_sum, current_balance, discrepancy, and consistency flags.';

-- Step 6: Add index for faster balance_after queries
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_created_for_balance 
  ON coin_transactions(user_id, created_at DESC, id DESC);

-- Verification
DO $$
DECLARE
  v_total_transactions bigint;
  v_transactions_with_balance bigint;
BEGIN
  SELECT COUNT(*) INTO v_total_transactions FROM coin_transactions;
  SELECT COUNT(*) INTO v_transactions_with_balance FROM coin_transactions WHERE balance_after IS NOT NULL;
  
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'RUNNING BALANCE SYSTEM IMPLEMENTED';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Total Transactions: %', v_total_transactions;
  RAISE NOTICE 'Transactions with balance_after: %', v_transactions_with_balance;
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  ✓ balance_after column added';
  RAISE NOTICE '  ✓ Auto-calculation trigger active';
  RAISE NOTICE '  ✓ Existing transactions backfilled';
  RAISE NOTICE '  ✓ Validation function available';
  RAISE NOTICE '  ✓ Performance index created';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  SELECT * FROM coin_transactions ORDER BY created_at;';
  RAISE NOTICE '  SELECT validate_user_balance_consistency(user_id);';
  RAISE NOTICE '=================================================';
END $$;
