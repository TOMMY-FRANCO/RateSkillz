/*
  # Fix Trigger to Handle Negative Transactions

  ## Summary
  Updates the balance update trigger to properly handle negative transactions (card purchases).

  ## Current Issue
  The trigger updates balance for ALL transactions, including negative ones.
  But card purchases are already manually deducted in execute_card_sale.
  This could cause issues if not handled properly.

  ## Solution
  Update trigger to skip balance updates for negative transactions since they're handled manually.
  Only trigger automatic balance increases for positive transactions.

  ## Changes Made
  Modified `update_coin_balance_on_transaction` to:
  1. Only update balance for positive amounts (earnings)
  2. Skip negative amounts (purchases/spending already handled manually)
  3. This prevents any potential double-deduction issues

  ## Note
  This ensures clean separation:
  - Spending (negative): Handled manually before transactions
  - Earning (positive): Handled automatically by trigger
*/

-- Update trigger to only handle positive transactions
CREATE OR REPLACE FUNCTION update_coin_balance_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE NOTICE 'Transaction inserted: user_id=%, amount=%, type=%', 
    NEW.user_id, NEW.amount, NEW.transaction_type;
  
  -- Only update balance for POSITIVE amounts (earnings)
  -- Negative amounts (spending) are handled manually before transaction insert
  IF NEW.amount > 0 THEN
    -- Insert or update the user's balance
    INSERT INTO coins (user_id, balance, created_at, updated_at)
    VALUES (NEW.user_id, NEW.amount, now(), now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      balance = coins.balance + NEW.amount,
      updated_at = now();
    
    RAISE NOTICE 'Balance updated: +% coins for user %', NEW.amount, NEW.user_id;
  ELSE
    RAISE NOTICE 'Skipping balance update for negative transaction (already handled manually)';
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating coin balance: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Verify trigger exists and is active
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_update_coin_balance_on_transaction'
  ) THEN
    RAISE EXCEPTION 'Balance update trigger is missing!';
  END IF;
  
  RAISE NOTICE 'Balance update trigger fixed successfully';
  RAISE NOTICE 'Now correctly handles: positive amounts (auto-add), negative amounts (skip)';
END $$;
