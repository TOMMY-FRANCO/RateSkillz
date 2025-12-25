/*
  # Fix Reward Functions to Use Correct Coins Table Columns

  Updates all reward functions to use `updated_at` instead of `last_updated` for the coins table.
*/

-- Function to claim WhatsApp verification reward (updated)
CREATE OR REPLACE FUNCTION claim_whatsapp_verification_reward(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_claimed boolean;
  v_pool_balance numeric;
  v_reward_amount integer := 10;
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

  -- Check pool has sufficient coins
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  ORDER BY created_at 
  LIMIT 1 
  FOR UPDATE;
  
  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in pool');
  END IF;

  -- Deduct from pool and update distributed coins
  UPDATE coin_pool 
  SET 
    remaining_coins = remaining_coins - v_reward_amount,
    distributed_coins = distributed_coins + v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Get current user balance
  SELECT balance INTO v_user_balance FROM coins WHERE user_id = p_user_id FOR UPDATE;
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

  -- Create transaction record
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    running_balance,
    created_at
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'reward_whatsapp',
    'WhatsApp Verification Reward',
    v_user_balance + v_reward_amount,
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
    v_reward_amount,
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
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Function to claim social sharing reward (updated)
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
  v_reward_amount integer := 20;
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

  -- Check pool has sufficient coins
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  ORDER BY created_at 
  LIMIT 1 
  FOR UPDATE;
  
  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in pool');
  END IF;

  -- Deduct from pool and update distributed coins
  UPDATE coin_pool 
  SET 
    remaining_coins = remaining_coins - v_reward_amount,
    distributed_coins = distributed_coins + v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Get current user balance
  SELECT balance INTO v_user_balance FROM coins WHERE user_id = p_user_id FOR UPDATE;
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

  -- Create transaction record
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    running_balance,
    created_at
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'reward_social_share',
    'Social Media Sharing Reward',
    v_user_balance + v_reward_amount,
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
    v_reward_amount,
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
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Function to claim friend milestone reward (updated)
CREATE OR REPLACE FUNCTION claim_friend_milestone_reward(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_claimed boolean;
  v_friend_count integer;
  v_pool_balance numeric;
  v_reward_amount integer := 10;
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

  -- Check pool has sufficient coins
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  ORDER BY created_at 
  LIMIT 1 
  FOR UPDATE;
  
  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in pool');
  END IF;

  -- Deduct from pool and update distributed coins
  UPDATE coin_pool 
  SET 
    remaining_coins = remaining_coins - v_reward_amount,
    distributed_coins = distributed_coins + v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Get current user balance
  SELECT balance INTO v_user_balance FROM coins WHERE user_id = p_user_id FOR UPDATE;
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

  -- Create transaction record
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    running_balance,
    created_at
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'reward_friend_milestone',
    '5 Friends Milestone Reward',
    v_user_balance + v_reward_amount,
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
    v_reward_amount,
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
    'transaction_id', v_transaction_id
  );
END;
$$;