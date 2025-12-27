/*
  # Fix WhatsApp Share Reward Coin Pool Reference

  ## Problem
  The claim_whatsapp_share_reward function was using a hardcoded UUID that doesn't match
  the actual coin pool in the database. This causes the function to fail.

  ## Solution
  Update the function to use the first/primary coin pool dynamically instead of a hardcoded UUID.

  ## Changes
  - Modified claim_whatsapp_share_reward to query coin_pool without UUID restriction
  - Function now works with the actual coin pool in the database
*/

-- Drop and recreate the function with correct coin pool reference
CREATE OR REPLACE FUNCTION claim_whatsapp_share_reward(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_claimed boolean;
  v_pool_balance numeric;
  v_reward_amount numeric := 10.00;
  v_transaction_id uuid;
  v_user_balance numeric;
  v_pool_id uuid;
BEGIN
  -- Check if already claimed
  SELECT whatsapp_share_claimed INTO v_already_claimed 
  FROM profiles 
  WHERE id = p_user_id;

  IF v_already_claimed THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'You have already claimed your WhatsApp share reward'
    );
  END IF;

  -- Get the primary coin pool (first one ordered by creation)
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;
  
  IF v_pool_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Coin pool not found'
    );
  END IF;

  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient coins in master pool'
    );
  END IF;

  -- Deduct from master pool
  UPDATE coin_pool 
  SET 
    distributed_coins = distributed_coins + v_reward_amount,
    remaining_coins = remaining_coins - v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Get current user balance
  SELECT balance INTO v_user_balance 
  FROM coins 
  WHERE user_id = p_user_id 
  FOR UPDATE;
  
  IF v_user_balance IS NULL THEN
    v_user_balance := 0;
  END IF;

  -- Add to user balance
  INSERT INTO coins (user_id, balance, updated_at)
  VALUES (p_user_id, v_reward_amount, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = coins.balance + v_reward_amount,
    updated_at = now();

  -- Calculate new balance after transaction
  v_user_balance := v_user_balance + v_reward_amount;

  -- Create transaction record with balance_after
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    balance_after,
    created_at
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'whatsapp_share',
    'WhatsApp Share Reward',
    v_user_balance,
    now()
  ) RETURNING id INTO v_transaction_id;

  -- Mark as claimed in profile
  UPDATE profiles 
  SET 
    whatsapp_share_claimed = true,
    whatsapp_share_date = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'amount', v_reward_amount,
    'new_balance', v_user_balance,
    'transaction_id', v_transaction_id,
    'message', 'You earned 10 coins for sharing!'
  );
END;
$$;
