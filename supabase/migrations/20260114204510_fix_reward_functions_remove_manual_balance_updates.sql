/*
  # Fix All Reward Functions - Remove Manual Balance Updates

  ## Problem
  All reward functions (WhatsApp verification, social sharing, friend milestone)
  are still using the deprecated `coins` table and manually updating balances.
  This causes the same duplicate coin addition issue as the tutorial function had.

  When these functions insert a transaction:
  1. They manually update the balance (either in coins table or profiles)
  2. Then the trigger also updates profiles.coin_balance
  3. Result: Double crediting of coins

  ## Solution
  Update all reward functions to:
  1. Use profiles.coin_balance (not the old coins table)
  2. Remove ALL manual balance updates
  3. Let the trigger handle balance updates automatically
  4. Only manage coin_pool and transaction insertion

  ## Functions Fixed
  - claim_whatsapp_verification_reward
  - claim_social_sharing_reward
  - claim_friend_milestone_reward

  ## Result
  - Single atomic transaction per reward
  - No duplicate coin additions
  - Consistent with tutorial completion flow
  - Balance matches transaction sum exactly
*/

-- Fix WhatsApp verification reward - remove manual balance update
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
  v_new_balance numeric;
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

  -- Get the primary coin pool
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  WHERE id = '00000000-0000-0000-0000-000000000001'
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

  -- Insert transaction record (trigger will update balance automatically)
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'reward_whatsapp',
    'WhatsApp Verification Reward'
  ) RETURNING id INTO v_transaction_id;

  -- Get the updated balance after trigger has run
  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id;

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
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Error claiming reward: ' || SQLERRM
  );
END;
$$;

-- Fix social sharing reward - remove manual balance update
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
  v_new_balance numeric;
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
  WHERE id = '00000000-0000-0000-0000-000000000001'
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

  -- Insert transaction record (trigger will update balance automatically)
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'reward_social_share',
    'Social Media Sharing Reward'
  ) RETURNING id INTO v_transaction_id;

  -- Get the updated balance after trigger has run
  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id;

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
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Error claiming reward: ' || SQLERRM
  );
END;
$$;

-- Fix friend milestone reward - remove manual balance update
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
  v_new_balance numeric;
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
  WHERE id = '00000000-0000-0000-0000-000000000001'
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

  -- Insert transaction record (trigger will update balance automatically)
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'reward_friend_milestone',
    '5 Friends Milestone Reward'
  ) RETURNING id INTO v_transaction_id;

  -- Get the updated balance after trigger has run
  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id;

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
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Error claiming reward: ' || SQLERRM
  );
END;
$$;

-- Update the coin pool trigger to handle reward types
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

  -- Handle rewards (already handled in functions, skip in trigger to avoid double-counting)
  -- The reward functions update the pool BEFORE inserting the transaction
  IF NEW.transaction_type IN ('tutorial_completion', 'reward_whatsapp', 'reward_social_share', 'reward_friend_milestone') THEN
    RAISE NOTICE '% reward: coin pool already updated by function', NEW.transaction_type;
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
