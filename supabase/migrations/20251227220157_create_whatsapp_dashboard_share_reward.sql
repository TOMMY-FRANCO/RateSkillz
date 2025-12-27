/*
  # Create WhatsApp Dashboard Share Reward System

  ## Overview
  Implements instant 10 coin reward when users share their profile link via WhatsApp from the dashboard.
  All coins come from the 1 billion master coin pool. Users can only claim this reward once.

  ## Features
  - Instant 10 coin reward when clicking WhatsApp share button on dashboard
  - One-time reward (no duplicates allowed)
  - Deducts from master coin pool
  - Creates transaction record immediately
  - Tracks in profiles table with `whatsapp_share_claimed` column

  ## Tables Modified
  - `profiles`: Add `whatsapp_share_claimed` tracking column
  - `coin_transactions`: Add `whatsapp_share` transaction type

  ## Security
  - Server-side validation prevents duplicate claims
  - Checks pool balance before distributing coins
  - Creates audit trail in coin_transactions
*/

-- Add WhatsApp share tracking column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'whatsapp_share_claimed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN whatsapp_share_claimed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'whatsapp_share_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN whatsapp_share_date timestamptz;
  END IF;
END $$;

-- Update coin_transactions constraint to include whatsapp_share
DO $$
BEGIN
  ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;
  
  ALTER TABLE coin_transactions ADD CONSTRAINT coin_transactions_transaction_type_check 
    CHECK (transaction_type IN (
      'comment_reward',
      'ad_view',
      'ad_reward',
      'purchase',
      'card_sale',
      'card_purchase',
      'coin_purchase',
      'card_royalty',
      'balance_correction',
      'battle_wager',
      'battle_win',
      'coin_transfer_sent',
      'coin_transfer_received',
      'card_swap',
      'card_discard',
      'reward_whatsapp',
      'reward_social_share',
      'reward_friend_milestone',
      'whatsapp_share',
      'whatsapp_share_retroactive_credit',
      'purchase_request_sale'
    ));
END $$;

-- Function to claim WhatsApp share reward (instant, one-time only)
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

  -- Get coin pool ID and balance
  SELECT id, amount INTO v_pool_id, v_pool_balance 
  FROM coin_pool 
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
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
    amount = amount - v_reward_amount,
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

-- Function to retroactively credit users who shared but got errors (if any exist)
-- Note: Since there's no historical tracking of WhatsApp shares from public profile,
-- this function is a placeholder for future use if manual entries are needed
CREATE OR REPLACE FUNCTION retroactive_credit_whatsapp_shares()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credited_count integer := 0;
  v_total_coins_distributed numeric := 0;
  v_user_record record;
  v_result jsonb;
BEGIN
  -- This function would retroactively credit users IF there was historical data
  -- Since the public profile WhatsApp share was not tracked, there's no data to process
  -- Function exists for audit trail purposes
  
  RETURN jsonb_build_object(
    'success', true,
    'users_credited', v_credited_count,
    'total_coins_distributed', v_total_coins_distributed,
    'message', 'No historical WhatsApp share data found to retroactively credit'
  );
END;
$$;
