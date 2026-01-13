/*
  # Fix Tutorial Completion System

  1. Changes
    - Add `tutorial_completed` boolean flag to profiles table (default: false)
    - Update `complete_tutorial` function to:
      - Check the new flag instead of just the completions table
      - Deduct 5 coins from the coin pool (1 billion pool)
      - Set the `tutorial_completed` flag to true
      - Award 5 coins to the user
      - Create a transaction record
      - Record in tutorial_completions table
    
  2. Important Notes
    - This ensures tutorial rewards only happen ONCE per user
    - Coins come from the global coin pool as requested
    - The flag makes it easier to check completion status
    - Tutorial will never appear again once completed
*/

-- Add tutorial_completed column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'tutorial_completed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN tutorial_completed boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Update existing users who have completed the tutorial
UPDATE profiles
SET tutorial_completed = true
WHERE id IN (
  SELECT user_id FROM tutorial_completions
);

-- Drop the old function
DROP FUNCTION IF EXISTS complete_tutorial(uuid);

-- Create updated function that deducts from coin pool and sets flag
CREATE OR REPLACE FUNCTION complete_tutorial(user_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_completed boolean;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_coin_pool_balance numeric;
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

  -- Deduct 5 coins from the coin pool
  UPDATE coin_pool
  SET 
    total_coins_in_circulation = total_coins_in_circulation + 5,
    updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001'
  RETURNING (1000000000 - total_coins_in_circulation) INTO v_coin_pool_balance;

  -- Check if coin pool has enough coins
  IF v_coin_pool_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient coins in the global pool';
  END IF;

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
    'coins_earned', 5
  );
END;
$$;
