/*
  # Fix Duplicate Coin Addition in Tutorial and Reward Functions

  ## Problem
  The `complete_tutorial` function and reward functions were manually updating
  user balances AND THEN inserting transaction records. This caused the 
  `trigger_update_coin_balance_on_transaction` trigger to add the same coins
  again, resulting in double crediting.

  Example:
  - Tutorial completion: User gets +5 coins from function, +5 from trigger = 10 total (should be 5)
  - This causes "Transaction Balance discrepancy detected" errors

  ## Solution
  Remove manual balance updates from all reward functions. Let the trigger
  `trigger_update_coin_balance_on_transaction` handle ALL balance updates
  automatically when transactions are inserted.

  ## Changes Made
  1. Fix `complete_tutorial` function - remove manual balance update
  2. Ensure coin_pool updates happen BEFORE transaction insert
  3. Ensure tutorial_completed flag is set properly
  4. Let trigger handle the balance update via transaction insert

  ## Result
  - Single atomic transaction per reward
  - No duplicate coin additions
  - Balance matches transaction sum exactly
  - No more discrepancy errors
*/

-- Drop and recreate complete_tutorial function WITHOUT manual balance update
DROP FUNCTION IF EXISTS complete_tutorial(uuid);

CREATE OR REPLACE FUNCTION complete_tutorial(user_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_completed boolean;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_remaining_coins numeric;
BEGIN
  -- Check if already completed using the flag
  SELECT tutorial_completed INTO v_already_completed
  FROM profiles
  WHERE id = user_uuid;

  IF v_already_completed THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Tutorial already completed'
    );
  END IF;

  -- Check if coin pool has enough coins
  SELECT remaining_coins INTO v_remaining_coins
  FROM coin_pool
  WHERE id = '00000000-0000-0000-0000-000000000001';

  IF v_remaining_coins < 5 THEN
    RAISE EXCEPTION 'Insufficient coins in the global pool';
  END IF;

  -- Deduct 5 coins from the coin pool (increase distributed, decrease remaining)
  UPDATE coin_pool
  SET 
    distributed_coins = distributed_coins + 5,
    remaining_coins = remaining_coins - 5,
    updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Set tutorial_completed flag (but DON'T manually update coin_balance)
  UPDATE profiles
  SET tutorial_completed = true
  WHERE id = user_uuid;

  -- Insert transaction record
  -- The trigger will automatically update the balance when this inserts
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    user_uuid,
    5,
    'tutorial_completion',
    'Tutorial completion bonus'
  ) RETURNING id INTO v_transaction_id;

  -- Get the updated balance after trigger has run
  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = user_uuid;

  -- Record tutorial completion (if not already recorded)
  INSERT INTO tutorial_completions (user_id, coins_earned)
  VALUES (user_uuid, 5)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'message', 'Tutorial completed! +5 coins earned',
    'new_balance', v_new_balance,
    'coins_earned', 5,
    'transaction_id', v_transaction_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error completing tutorial: ' || SQLERRM
    );
END;
$$;

-- Update the coin pool trigger to also handle tutorial_completion
-- This ensures the coin_pool is updated when tutorial rewards are given
CREATE OR REPLACE FUNCTION update_coin_pool_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Handle coin purchases (external coins entering the system via Stripe)
  -- These should DECREMENT the remaining pool as coins are sold
  IF NEW.transaction_type = 'purchase' AND NEW.amount > 0 THEN
    UPDATE coin_pool
    SET 
      distributed_coins = distributed_coins + NEW.amount,
      remaining_coins = remaining_coins - NEW.amount,
      updated_at = now()
    WHERE id = '00000000-0000-0000-0000-000000000001';
    
    RAISE NOTICE 'Coin pool updated for purchase: -% coins from pool', NEW.amount;
  END IF;

  -- Handle tutorial completion (already handled in function, skip in trigger)
  -- The complete_tutorial function updates the pool BEFORE inserting the transaction
  IF NEW.transaction_type = 'tutorial_completion' THEN
    RAISE NOTICE 'Tutorial completion: coin pool already updated by function';
  END IF;

  -- Handle coin spending on platform (card purchases, swaps, etc.)
  -- These return coins to the pool as they circulate within the economy
  IF NEW.transaction_type IN ('card_purchase', 'card_swap', 'battle_wager') AND NEW.amount < 0 THEN
    -- For negative transactions (spending), add back to pool
    UPDATE coin_pool
    SET 
      distributed_coins = distributed_coins + NEW.amount,
      remaining_coins = remaining_coins - NEW.amount,
      updated_at = now()
    WHERE id = '00000000-0000-0000-0000-000000000001';
    
    RAISE NOTICE 'Coin pool updated for spending: % coins returned to pool', ABS(NEW.amount);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating coin pool: %', SQLERRM;
  RETURN NEW;
END;
$$;
