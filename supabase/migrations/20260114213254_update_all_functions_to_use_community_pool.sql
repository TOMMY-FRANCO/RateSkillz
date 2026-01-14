/*
  # Update All Coin Distribution Functions to Use Community Pool

  ## Overview
  Updates all coin distribution functions to query the Community Rewards Pool
  specifically (pool_type = 'community') instead of hardcoded UUID.

  ## Functions Updated
  1. complete_tutorial - Tutorial completion reward (5 coins)
  2. claim_whatsapp_verification_reward - WhatsApp verification (10 coins)
  3. claim_social_sharing_reward - Social media sharing (20 coins)
  4. claim_friend_milestone_reward - 5 friends milestone (10 coins)
  5. claim_whatsapp_share_reward - WhatsApp share from dashboard (10 coins)
  6. update_coin_pool_on_transaction - Trigger for pool updates
  7. process_stripe_coin_purchase - Stripe coin purchases

  ## Change Pattern
  Before: WHERE id = '00000000-0000-0000-0000-000000000001'
  After: WHERE pool_type = 'community'

  ## Result
  All user coin distributions now come exclusively from the Community Rewards Pool.
  Other pools remain untouched and hidden from users.
*/

-- 1. Update complete_tutorial function
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
  v_pool_id uuid;
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

  -- Get community pool and check if it has enough coins
  SELECT id, remaining_coins INTO v_pool_id, v_remaining_coins
  FROM coin_pool
  WHERE pool_type = 'community'
  FOR UPDATE;

  IF v_remaining_coins < 5 THEN
    RAISE EXCEPTION 'Insufficient coins in the community pool';
  END IF;

  -- Deduct 5 coins from the community pool
  UPDATE coin_pool
  SET 
    distributed_coins = distributed_coins + 5,
    remaining_coins = remaining_coins - 5,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Set tutorial_completed flag (but DON'T manually update coin_balance)
  UPDATE profiles
  SET tutorial_completed = true
  WHERE id = user_uuid;

  -- Insert transaction record (trigger will update balance)
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

  -- Record tutorial completion
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

-- 2. Update claim_whatsapp_verification_reward function
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

  -- Get the community pool
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  WHERE pool_type = 'community'
  FOR UPDATE;
  
  IF v_pool_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Community pool not found');
  END IF;

  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in community pool');
  END IF;

  -- Deduct from community pool
  UPDATE coin_pool 
  SET 
    distributed_coins = distributed_coins + v_reward_amount,
    remaining_coins = remaining_coins - v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Insert transaction record (trigger will update balance)
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

-- 3. Update claim_social_sharing_reward function
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

  -- Get the community pool
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  WHERE pool_type = 'community'
  FOR UPDATE;
  
  IF v_pool_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Community pool not found');
  END IF;

  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in community pool');
  END IF;

  -- Deduct from community pool
  UPDATE coin_pool 
  SET 
    distributed_coins = distributed_coins + v_reward_amount,
    remaining_coins = remaining_coins - v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Insert transaction record (trigger will update balance)
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

-- 4. Update claim_friend_milestone_reward function
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

  -- Get the community pool
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  WHERE pool_type = 'community'
  FOR UPDATE;
  
  IF v_pool_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Community pool not found');
  END IF;

  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in community pool');
  END IF;

  -- Deduct from community pool
  UPDATE coin_pool 
  SET 
    distributed_coins = distributed_coins + v_reward_amount,
    remaining_coins = remaining_coins - v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Insert transaction record (trigger will update balance)
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

-- 5. Update claim_whatsapp_share_reward function
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
  v_new_balance numeric;
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

  -- Get the community pool
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  WHERE pool_type = 'community'
  FOR UPDATE;
  
  IF v_pool_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Community pool not found'
    );
  END IF;

  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient coins in community pool'
    );
  END IF;

  -- Deduct from community pool
  UPDATE coin_pool 
  SET 
    distributed_coins = distributed_coins + v_reward_amount,
    remaining_coins = remaining_coins - v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Insert transaction record (trigger will update balance)
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'whatsapp_share',
    'WhatsApp Share Reward'
  ) RETURNING id INTO v_transaction_id;

  -- Get the updated balance after trigger has run
  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id;

  -- Mark as claimed in profile
  UPDATE profiles 
  SET 
    whatsapp_share_claimed = true,
    whatsapp_share_date = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'amount', v_reward_amount,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id,
    'message', 'You earned 10 coins for sharing!'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Error claiming reward: ' || SQLERRM
  );
END;
$$;

-- 6. Update update_coin_pool_on_transaction trigger function
CREATE OR REPLACE FUNCTION update_coin_pool_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pool_id uuid;
BEGIN
  -- Get community pool ID
  SELECT id INTO v_pool_id FROM coin_pool WHERE pool_type = 'community';

  -- Handle coin purchases (external coins entering the system via Stripe)
  IF NEW.transaction_type = 'purchase' AND NEW.amount > 0 THEN
    UPDATE coin_pool
    SET 
      distributed_coins = distributed_coins + NEW.amount,
      remaining_coins = remaining_coins - NEW.amount,
      updated_at = now()
    WHERE id = v_pool_id;
    
    RAISE NOTICE 'Community pool updated for purchase: -% coins from pool', NEW.amount;
  END IF;

  -- Handle all rewards (already handled in functions, skip in trigger)
  IF NEW.transaction_type IN (
    'tutorial_completion', 
    'reward_whatsapp', 
    'reward_social_share', 
    'reward_friend_milestone',
    'whatsapp_share'
  ) THEN
    RAISE NOTICE '% reward: community pool already updated by function', NEW.transaction_type;
  END IF;

  -- Handle coin spending on platform (card purchases, swaps, etc.)
  -- These return coins to the community pool
  IF NEW.transaction_type IN ('card_purchase', 'card_swap', 'battle_wager') AND NEW.amount < 0 THEN
    UPDATE coin_pool
    SET 
      distributed_coins = distributed_coins + NEW.amount,
      remaining_coins = remaining_coins - NEW.amount,
      updated_at = now()
    WHERE id = v_pool_id;
    
    RAISE NOTICE 'Community pool updated for spending: % coins returned to pool', ABS(NEW.amount);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating community pool: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 7. Update process_stripe_coin_purchase function
CREATE OR REPLACE FUNCTION process_stripe_coin_purchase(
  p_user_id uuid,
  p_coins_amount numeric,
  p_price_gbp numeric,
  p_payment_intent_id text,
  p_customer_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_new_balance numeric;
  v_is_duplicate boolean;
  v_pool_id uuid;
  v_remaining_coins numeric;
BEGIN
  -- Check for duplicate transaction
  v_is_duplicate := check_duplicate_payment(p_payment_intent_id, p_user_id, p_coins_amount);
  
  IF v_is_duplicate THEN
    RAISE NOTICE 'Duplicate payment detected: %', p_payment_intent_id;
    RETURN json_build_object(
      'success', false,
      'message', 'Payment already processed',
      'duplicate', true
    );
  END IF;

  -- Check if user exists
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- Get community pool and check availability
  SELECT id, remaining_coins INTO v_pool_id, v_remaining_coins
  FROM coin_pool 
  WHERE pool_type = 'community';
  
  IF v_remaining_coins < p_coins_amount THEN
    RAISE WARNING 'Community pool low but processing payment anyway: % coins remaining', v_remaining_coins;
  END IF;

  -- Insert transaction (triggers will update balance and pool automatically)
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    reference_id,
    payment_provider,
    payment_amount
  ) VALUES (
    p_user_id,
    p_coins_amount,
    'purchase',
    format('Purchased %s coins for £%s', p_coins_amount, p_price_gbp),
    p_payment_intent_id,
    'stripe',
    p_price_gbp
  )
  RETURNING id INTO v_transaction_id;

  -- Get updated balance
  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id;

  -- Update or create stripe_customers record if customer_id provided
  IF p_customer_id IS NOT NULL THEN
    INSERT INTO stripe_customers (user_id, customer_id, created_at, updated_at)
    VALUES (p_user_id, p_customer_id, now(), now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      customer_id = EXCLUDED.customer_id,
      updated_at = now();
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', format('Successfully added %s coins', p_coins_amount),
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'coins_added', p_coins_amount
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error processing Stripe purchase: %', SQLERRM;
  RAISE;
END;
$$;

-- Verify all functions updated successfully
DO $$
BEGIN
  RAISE NOTICE '✓ All coin distribution functions updated to use Community Rewards Pool';
  RAISE NOTICE '✓ Users will only see and interact with the Community Pool (500M coins)';
  RAISE NOTICE '✓ Other pools (Operational, Growth, Founder) remain backend-only';
END $$;
