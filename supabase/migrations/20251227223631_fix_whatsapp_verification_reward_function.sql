/*
  # Fix WhatsApp Verification Reward Function

  ## Problem
  The claim_whatsapp_verification_reward function has multiple issues:
  1. Uses wrong column names (amount instead of remaining_coins, last_updated instead of updated_at)
  2. Uses integer ID (1) instead of UUID for coin_pool
  3. Uses running_balance instead of balance_after
  4. Not properly deducting from pool's remaining_coins

  ## Solution
  Update all WhatsApp reward functions to:
  - Use correct coin_pool columns (remaining_coins, distributed_coins, updated_at)
  - Query coin_pool dynamically by creation date (no hardcoded UUIDs)
  - Use balance_after for transaction records
  - Ensure proper flow: pool → user balance → transaction ledger

  ## Changes
  - Fix claim_whatsapp_verification_reward function
  - Fix claim_social_sharing_reward function  
  - Fix claim_friend_milestone_reward function
  - All rewards now properly transfer from 1 billion coin pool
*/

-- Fix WhatsApp verification reward function
CREATE OR REPLACE FUNCTION claim_whatsapp_verification_reward(p_user_id uuid)
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
  SELECT EXISTS (
    SELECT 1 FROM reward_logs 
    WHERE user_id = p_user_id 
    AND reward_type = 'whatsapp_verify' 
    AND status = 'claimed'
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward already claimed');
  END IF;

  -- Get the primary coin pool (first one ordered by creation)
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;
  
  IF v_pool_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coin pool not found');
  END IF;

  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in pool');
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
    'reward_whatsapp',
    'WhatsApp Verification Reward',
    v_user_balance,
    now()
  ) RETURNING id INTO v_transaction_id;

  -- Log reward
  INSERT INTO reward_logs (
    user_id,
    reward_type,
    amount,
    status,
    transaction_id
  ) VALUES (
    p_user_id,
    'whatsapp_verify',
    v_reward_amount::integer,
    'claimed',
    v_transaction_id
  );

  -- Update profile verification status
  UPDATE profiles 
  SET 
    is_verified = true,
    verification_date = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'amount', v_reward_amount,
    'new_balance', v_user_balance,
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Fix social sharing reward function
CREATE OR REPLACE FUNCTION claim_social_sharing_reward(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_claimed boolean;
  v_has_shared_x boolean;
  v_has_shared_facebook boolean;
  v_pool_balance numeric;
  v_reward_amount numeric := 20.00;
  v_transaction_id uuid;
  v_user_balance numeric;
  v_pool_id uuid;
BEGIN
  -- Check if already claimed
  SELECT shared_reward_claimed INTO v_already_claimed 
  FROM profiles 
  WHERE id = p_user_id;

  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward already claimed');
  END IF;

  -- Check if both platforms shared
  SELECT has_shared_x, has_shared_facebook 
  INTO v_has_shared_x, v_has_shared_facebook
  FROM profiles 
  WHERE id = p_user_id;

  IF NOT (v_has_shared_x AND v_has_shared_facebook) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must share to both X and Facebook');
  END IF;

  -- Get the primary coin pool
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;
  
  IF v_pool_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coin pool not found');
  END IF;

  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in pool');
  END IF;

  -- Deduct from pool
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

  -- Calculate new balance
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
    'reward_social_share',
    'Social Media Sharing Reward',
    v_user_balance,
    now()
  ) RETURNING id INTO v_transaction_id;

  -- Log reward
  INSERT INTO reward_logs (
    user_id,
    reward_type,
    amount,
    status,
    transaction_id
  ) VALUES (
    p_user_id,
    'social_share',
    v_reward_amount::integer,
    'claimed',
    v_transaction_id
  );

  -- Mark reward as claimed
  UPDATE profiles 
  SET shared_reward_claimed = true
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'amount', v_reward_amount,
    'new_balance', v_user_balance,
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Fix friend milestone reward function
CREATE OR REPLACE FUNCTION claim_friend_milestone_reward(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_claimed boolean;
  v_friend_count integer;
  v_pool_balance numeric;
  v_reward_amount numeric := 10.00;
  v_transaction_id uuid;
  v_user_balance numeric;
  v_pool_id uuid;
BEGIN
  -- Check if already claimed
  SELECT social_badge_reward_claimed, friend_count 
  INTO v_already_claimed, v_friend_count
  FROM profiles 
  WHERE id = p_user_id;

  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward already claimed');
  END IF;

  -- Check if user has 5 or more friends
  IF v_friend_count < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Need 5 friends to claim reward');
  END IF;

  -- Get the primary coin pool
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;
  
  IF v_pool_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coin pool not found');
  END IF;

  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in pool');
  END IF;

  -- Deduct from pool
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

  -- Calculate new balance
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
    'reward_friend_milestone',
    '5 Friends Milestone Reward',
    v_user_balance,
    now()
  ) RETURNING id INTO v_transaction_id;

  -- Log reward
  INSERT INTO reward_logs (
    user_id,
    reward_type,
    amount,
    status,
    transaction_id
  ) VALUES (
    p_user_id,
    'friend_milestone',
    v_reward_amount::integer,
    'claimed',
    v_transaction_id
  );

  -- Mark reward as claimed
  UPDATE profiles 
  SET social_badge_reward_claimed = true
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'amount', v_reward_amount,
    'new_balance', v_user_balance,
    'transaction_id', v_transaction_id
  );
END;
$$;
