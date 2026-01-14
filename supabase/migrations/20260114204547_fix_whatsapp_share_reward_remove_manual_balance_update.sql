/*
  # Fix WhatsApp Share Reward - Remove Manual Balance Update

  ## Problem
  The claim_whatsapp_share_reward function has the same duplicate coin issue:
  1. It manually updates the old `coins` table balance
  2. Then the trigger also updates profiles.coin_balance when transaction is inserted
  3. Result: User gets double coins

  ## Solution
  Update claim_whatsapp_share_reward to:
  1. Use profiles.coin_balance (not the old coins table)
  2. Remove manual balance update
  3. Let the trigger handle the balance update automatically
  4. Only manage coin_pool and transaction insertion

  ## Result
  - Single atomic transaction
  - No duplicate coin additions
  - Consistent with all other reward functions
  - Balance matches transaction sum exactly
*/

-- Fix WhatsApp share reward - remove manual balance update
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

  -- Get the primary coin pool
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  WHERE id = '00000000-0000-0000-0000-000000000001'
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

  -- Insert transaction record (trigger will update balance automatically)
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

-- Update the coin pool trigger to handle whatsapp_share
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

  -- Handle all rewards (already handled in functions, skip in trigger to avoid double-counting)
  -- The reward functions update the pool BEFORE inserting the transaction
  IF NEW.transaction_type IN (
    'tutorial_completion', 
    'reward_whatsapp', 
    'reward_social_share', 
    'reward_friend_milestone',
    'whatsapp_share'
  ) THEN
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
