/*
  # Fix Tutorial Completion Function - Use Correct Column Names

  1. Problem
    - Previous migration used incorrect column name `total_coins_in_circulation`
    - Actual coin_pool table uses `distributed_coins` and `remaining_coins`
    - This caused the function to fail silently
    
  2. Solution
    - Update complete_tutorial function to use correct columns:
      - `distributed_coins` - tracks coins given out (increases by 5)
      - `remaining_coins` - tracks coins left in pool (decreases by 5)
    - Ensure tutorial_completed flag is set properly
    - Award coins correctly from the 1 billion pool
    
  3. Testing
    - Function should work and set tutorial_completed = true
    - User balance should increase by 5
    - Coin pool distributed_coins should increase by 5
    - Transaction should be logged
*/

-- Drop the broken function
DROP FUNCTION IF EXISTS complete_tutorial(uuid);

-- Create corrected function with proper column names
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

  -- Award 5 coins to user and set tutorial_completed flag
  UPDATE profiles
  SET 
    coin_balance = coin_balance + 5,
    tutorial_completed = true
  WHERE id = user_uuid
  RETURNING coin_balance INTO v_new_balance;

  -- Log transaction
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    balance_after
  ) VALUES (
    user_uuid,
    5,
    'tutorial_completion',
    'Tutorial completion bonus',
    v_new_balance
  ) RETURNING id INTO v_transaction_id;

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
