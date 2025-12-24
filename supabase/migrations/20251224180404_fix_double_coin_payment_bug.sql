/*
  # Fix Double Coin Payment Bug

  ## Problem
  Users receiving double coins (20 instead of 10) when watching ads due to duplicate balance updates:
  1. `distribute_coins_from_pool` manually updates the coins table
  2. `update_coin_balance_on_transaction` trigger also updates coins table when transaction is inserted
  
  Result: Balance is incremented twice for the same transaction

  ## Solution
  Remove manual balance update from `distribute_coins_from_pool` function.
  Let the trigger `update_coin_balance_on_transaction` handle all balance updates automatically.
  Also remove coin pool update from trigger since `distribute_coins_from_pool` already handles it.

  ## Changes Made
  1. Modified `distribute_coins_from_pool` to NOT manually update coins table
  2. Modified `update_coin_pool_on_transaction` trigger to only track distributed coins (remove the update since distribute_coins_from_pool handles it)
  3. Transaction insert will trigger automatic balance update via existing trigger

  ## Transaction Flow After Fix
  Ad Watch (10 coins):
  - Check coin pool has 10 coins available
  - Update pool: distributed_coins += 10
  - Insert transaction record (type: ad_reward, amount: 10)
  - Trigger automatically updates user balance += 10
  - Result: User gets exactly 10 coins, once
*/

-- Fix distribute_coins_from_pool to NOT manually update balance
-- Let the trigger handle it automatically
CREATE OR REPLACE FUNCTION distribute_coins_from_pool(
  p_user_id uuid,
  p_amount numeric,
  p_source text,
  p_description text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pool_remaining numeric;
  v_result json;
BEGIN
  -- Check coin pool has enough coins remaining
  SELECT (total_coins - distributed_coins) INTO v_pool_remaining
  FROM coin_pool
  WHERE id = '00000000-0000-0000-0000-000000000001'
  FOR UPDATE;
  
  IF v_pool_remaining IS NULL THEN
    RAISE EXCEPTION 'Coin pool not initialized';
  END IF;
  
  IF v_pool_remaining < p_amount THEN
    RAISE EXCEPTION 'Insufficient coins in pool. Available: %, Requested: %', v_pool_remaining, p_amount;
  END IF;
  
  -- Mark coins as distributed from pool
  UPDATE coin_pool
  SET distributed_coins = distributed_coins + p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  -- REMOVED: Manual balance update (let trigger handle it)
  -- The trigger update_coin_balance_on_transaction will handle balance updates
  
  -- Record the transaction (this will trigger automatic balance update)
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, p_amount, p_source, p_description);
  
  v_result := json_build_object(
    'success', true,
    'amount', p_amount,
    'pool_remaining', v_pool_remaining - p_amount
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to distribute coins: %', SQLERRM;
END;
$$;

-- Fix update_coin_pool_on_transaction to NOT update the pool
-- (distribute_coins_from_pool already handles pool updates)
-- This trigger now does nothing, but we keep it for potential future use
CREATE OR REPLACE FUNCTION update_coin_pool_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Pool updates are now handled by distribute_coins_from_pool function
  -- This trigger is kept for backward compatibility but does nothing
  -- In the future, this could be used for purchase transactions or other sources
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in coin pool transaction trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Verify: Check that balance update trigger is still active
-- This trigger should remain and handle all balance updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_update_coin_balance_on_transaction'
  ) THEN
    RAISE EXCEPTION 'Critical: Balance update trigger is missing!';
  END IF;
  
  RAISE NOTICE 'Double payment fix applied successfully';
  RAISE NOTICE 'Balance updates now handled by trigger only';
  RAISE NOTICE 'Pool updates handled by distribute_coins_from_pool only';
END $$;
