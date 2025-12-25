/*
  # Create Reward System for Verification and Social Milestones

  ## Overview
  Implements one-time coin rewards for profile verification and social milestones.
  Users earn coins from the 1 billion master coin pool when completing specific actions.

  ## Reward Structure
  - **WhatsApp Verification**: 10 coins (one-time only)
  - **Social Sharing**: 20 coins when user shares to BOTH X and Facebook (one-time only)
  - **Friend Milestone**: 10 coins when user reaches exactly 5 confirmed friends (one-time only)

  ## Changes Made

  ### 1. Profile Enhancements
  Add tracking columns to profiles table:
  - `is_verified`: Boolean flag for WhatsApp verification status
  - `verification_date`: Timestamp when verification completed
  - `has_shared_x`: Boolean flag tracking if shared to X (Twitter)
  - `has_shared_facebook`: Boolean flag tracking if shared to Facebook
  - `shared_reward_claimed`: Boolean flag to prevent duplicate social sharing rewards
  - `social_badge_reward_claimed`: Boolean flag to prevent duplicate friend milestone rewards
  - `friend_count`: Integer tracking number of confirmed friends

  ### 2. Reward Logs Table
  Create comprehensive audit log for all reward claims:
  - Tracks reward type (whatsapp_verify, social_share, friend_milestone)
  - Records amount awarded (10 or 20 coins)
  - Timestamps when claimed
  - Status tracking (claimed, pending)
  - Links to user and transaction IDs

  ### 3. New Transaction Types
  Add to coin_transactions allowed types:
  - `reward_whatsapp`: WhatsApp verification reward
  - `reward_social_share`: Social media sharing reward
  - `reward_friend_milestone`: Five friends milestone reward

  ### 4. Reward Claiming Function
  Atomic function to claim rewards with:
  - Eligibility checking (not already claimed)
  - Pool sufficiency validation
  - Balance updates
  - Transaction logging
  - Duplicate prevention

  ### 5. Security
  - RLS policies for reward_logs table
  - Prevents users from manually claiming rewards
  - Server-side validation only
*/

-- Add reward tracking columns to profiles table
DO $$
BEGIN
  -- WhatsApp verification tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'verification_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verification_date timestamptz;
  END IF;

  -- Social sharing tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'has_shared_x'
  ) THEN
    ALTER TABLE profiles ADD COLUMN has_shared_x boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'has_shared_facebook'
  ) THEN
    ALTER TABLE profiles ADD COLUMN has_shared_facebook boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'shared_reward_claimed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN shared_reward_claimed boolean DEFAULT false;
  END IF;

  -- Friend milestone tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'social_badge_reward_claimed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN social_badge_reward_claimed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'friend_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN friend_count integer DEFAULT 0;
  END IF;
END $$;

-- Create reward_logs table for audit trail
CREATE TABLE IF NOT EXISTS reward_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('whatsapp_verify', 'social_share', 'friend_milestone')),
  amount integer NOT NULL CHECK (amount > 0),
  claimed_date timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'pending')),
  transaction_id uuid REFERENCES coin_transactions(id),
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reward_logs_user_id ON reward_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_logs_reward_type ON reward_logs(reward_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_logs_user_reward_type ON reward_logs(user_id, reward_type) WHERE status = 'claimed';

-- Enable RLS
ALTER TABLE reward_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reward_logs
DROP POLICY IF EXISTS "Users can view own reward logs" ON reward_logs;
CREATE POLICY "Users can view own reward logs"
  ON reward_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only the system can insert rewards (no direct user inserts)
DROP POLICY IF EXISTS "System can insert reward logs" ON reward_logs;
CREATE POLICY "System can insert reward logs"
  ON reward_logs FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Update transaction type constraint to include new reward types
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
      'reward_friend_milestone'
    ));
END $$;

-- Function to claim WhatsApp verification reward
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
  SELECT amount INTO v_pool_balance FROM coin_pool WHERE id = 1 FOR UPDATE;
  
  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in pool');
  END IF;

  -- Deduct from pool
  UPDATE coin_pool SET amount = amount - v_reward_amount WHERE id = 1;

  -- Get current user balance
  SELECT balance INTO v_user_balance FROM coins WHERE user_id = p_user_id FOR UPDATE;
  IF v_user_balance IS NULL THEN
    v_user_balance := 0;
  END IF;

  -- Add to user balance
  INSERT INTO coins (user_id, balance, last_updated)
  VALUES (p_user_id, v_reward_amount, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = coins.balance + v_reward_amount,
    last_updated = now();

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

-- Function to claim social sharing reward
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
  SELECT amount INTO v_pool_balance FROM coin_pool WHERE id = 1 FOR UPDATE;
  
  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in pool');
  END IF;

  -- Deduct from pool
  UPDATE coin_pool SET amount = amount - v_reward_amount WHERE id = 1;

  -- Get current user balance
  SELECT balance INTO v_user_balance FROM coins WHERE user_id = p_user_id FOR UPDATE;
  IF v_user_balance IS NULL THEN
    v_user_balance := 0;
  END IF;

  -- Add to user balance
  INSERT INTO coins (user_id, balance, last_updated)
  VALUES (p_user_id, v_reward_amount, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = coins.balance + v_reward_amount,
    last_updated = now();

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

-- Function to claim friend milestone reward
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
  SELECT amount INTO v_pool_balance FROM coin_pool WHERE id = 1 FOR UPDATE;
  
  IF v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins in pool');
  END IF;

  -- Deduct from pool
  UPDATE coin_pool SET amount = amount - v_reward_amount WHERE id = 1;

  -- Get current user balance
  SELECT balance INTO v_user_balance FROM coins WHERE user_id = p_user_id FOR UPDATE;
  IF v_user_balance IS NULL THEN
    v_user_balance := 0;
  END IF;

  -- Add to user balance
  INSERT INTO coins (user_id, balance, last_updated)
  VALUES (p_user_id, v_reward_amount, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = coins.balance + v_reward_amount,
    last_updated = now();

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

-- Trigger to automatically update friend_count and award reward
CREATE OR REPLACE FUNCTION update_friend_count_and_check_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user1_count integer;
  v_user2_count integer;
  v_user1_claimed boolean;
  v_user2_claimed boolean;
  v_reward_result jsonb;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Update friend counts for both users
    SELECT COUNT(*) INTO v_user1_count
    FROM friend_requests
    WHERE (sender_id = NEW.sender_id OR receiver_id = NEW.sender_id)
    AND status = 'accepted';

    SELECT COUNT(*) INTO v_user2_count
    FROM friend_requests
    WHERE (sender_id = NEW.receiver_id OR receiver_id = NEW.receiver_id)
    AND status = 'accepted';

    UPDATE profiles SET friend_count = v_user1_count WHERE id = NEW.sender_id;
    UPDATE profiles SET friend_count = v_user2_count WHERE id = NEW.receiver_id;

    -- Check if user1 reached milestone and hasn't claimed
    IF v_user1_count >= 5 THEN
      SELECT social_badge_reward_claimed INTO v_user1_claimed
      FROM profiles WHERE id = NEW.sender_id;
      
      IF NOT v_user1_claimed THEN
        SELECT claim_friend_milestone_reward(NEW.sender_id) INTO v_reward_result;
      END IF;
    END IF;

    -- Check if user2 reached milestone and hasn't claimed
    IF v_user2_count >= 5 THEN
      SELECT social_badge_reward_claimed INTO v_user2_claimed
      FROM profiles WHERE id = NEW.receiver_id;
      
      IF NOT v_user2_claimed THEN
        SELECT claim_friend_milestone_reward(NEW.receiver_id) INTO v_reward_result;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for friend milestone
DROP TRIGGER IF EXISTS trigger_friend_milestone_reward ON friend_requests;
CREATE TRIGGER trigger_friend_milestone_reward
  AFTER INSERT OR UPDATE ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_friend_count_and_check_milestone();