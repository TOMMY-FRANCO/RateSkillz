/*
  # Coin Transfer System for Verified Friends

  1. New Tables
    - `coin_transfers`
      - `id` (uuid, primary key)
      - `sender_id` (uuid, references profiles)
      - `recipient_id` (uuid, references profiles)
      - `amount` (numeric, transfer amount)
      - `status` (text, enum: completed/failed)
      - `conversation_id` (uuid, references conversations, optional)
      - `created_at` (timestamptz, when transfer initiated)
      - `completed_at` (timestamptz, when transfer completed)
      - `error_message` (text, error details if failed)

  2. New Columns for profiles
    - `coins_sent_today` (numeric, tracks daily send limit)
    - `coins_received_today` (numeric, tracks daily receive limit)
    - `last_coin_send_reset` (timestamptz, last daily limit reset)
    - `last_coin_receive_reset` (timestamptz, last daily limit reset)

  3. Security
    - Enable RLS on coin_transfers table
    - Users can view their own sent/received transfers
    - Only verified users can send coins
    - Validate daily limits before processing
    - Prevent self-transfers
    - Validate friendship status

  4. Functions
    - `process_coin_transfer` - Main transfer function with validations
    - `reset_daily_coin_limits` - Reset limits at GMT 00:00
    - `get_remaining_send_limit` - Check how many coins user can still send
    - `get_remaining_receive_limit` - Check how many coins recipient can still receive
*/

-- Add daily limit tracking columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'coins_sent_today'
  ) THEN
    ALTER TABLE profiles ADD COLUMN coins_sent_today numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'coins_received_today'
  ) THEN
    ALTER TABLE profiles ADD COLUMN coins_received_today numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_coin_send_reset'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_coin_send_reset timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_coin_receive_reset'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_coin_receive_reset timestamptz DEFAULT now();
  END IF;
END $$;

-- Create coin_transfers table
CREATE TABLE IF NOT EXISTS coin_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0 AND amount <= 100 AND amount % 10 = 0),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  CONSTRAINT no_self_transfer CHECK (sender_id != recipient_id)
);

ALTER TABLE coin_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coin_transfers
CREATE POLICY "Users can view own sent transfers"
  ON coin_transfers FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id);

CREATE POLICY "Users can view own received transfers"
  ON coin_transfers FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_id);

-- Function to check if daily limits need reset (GMT 00:00)
CREATE OR REPLACE FUNCTION should_reset_daily_limit(last_reset timestamptz)
RETURNS boolean AS $$
DECLARE
  v_now timestamptz;
  v_today_midnight timestamptz;
  v_last_reset_midnight timestamptz;
BEGIN
  v_now := now() AT TIME ZONE 'UTC';
  v_today_midnight := date_trunc('day', v_now);
  v_last_reset_midnight := date_trunc('day', last_reset AT TIME ZONE 'UTC');
  
  RETURN v_today_midnight > v_last_reset_midnight;
END;
$$ LANGUAGE plpgsql;

-- Function to get remaining send limit for user
CREATE OR REPLACE FUNCTION get_remaining_send_limit(p_user_id uuid)
RETURNS numeric AS $$
DECLARE
  v_coins_sent_today numeric;
  v_last_reset timestamptz;
  v_daily_limit numeric := 100;
BEGIN
  -- Get current send tracking
  SELECT coins_sent_today, last_coin_send_reset
  INTO v_coins_sent_today, v_last_reset
  FROM profiles
  WHERE id = p_user_id;

  -- Reset if needed
  IF should_reset_daily_limit(v_last_reset) THEN
    UPDATE profiles
    SET coins_sent_today = 0,
        last_coin_send_reset = now()
    WHERE id = p_user_id;
    
    RETURN v_daily_limit;
  END IF;

  RETURN v_daily_limit - COALESCE(v_coins_sent_today, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get remaining receive limit for user
CREATE OR REPLACE FUNCTION get_remaining_receive_limit(p_user_id uuid)
RETURNS numeric AS $$
DECLARE
  v_coins_received_today numeric;
  v_last_reset timestamptz;
  v_daily_limit numeric := 100;
BEGIN
  -- Get current receive tracking
  SELECT coins_received_today, last_coin_receive_reset
  INTO v_coins_received_today, v_last_reset
  FROM profiles
  WHERE id = p_user_id;

  -- Reset if needed
  IF should_reset_daily_limit(v_last_reset) THEN
    UPDATE profiles
    SET coins_received_today = 0,
        last_coin_receive_reset = now()
    WHERE id = p_user_id;
    
    RETURN v_daily_limit;
  END IF;

  RETURN v_daily_limit - COALESCE(v_coins_received_today, 0);
END;
$$ LANGUAGE plpgsql;

-- Main function to process coin transfer with all validations
CREATE OR REPLACE FUNCTION process_coin_transfer(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_amount numeric,
  p_conversation_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_sender_balance numeric;
  v_sender_verified boolean;
  v_recipient_verified boolean;
  v_remaining_send_limit numeric;
  v_remaining_receive_limit numeric;
  v_are_friends boolean;
  v_transfer_id uuid;
  v_transaction_id uuid;
BEGIN
  -- Validate amount (10, 20, 30... 100)
  IF p_amount <= 0 OR p_amount > 100 OR MOD(p_amount, 10) != 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be in 10 coin increments (10, 20, 30... 100)'
    );
  END IF;

  -- Prevent self-transfer
  IF p_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot send coins to yourself'
    );
  END IF;

  -- Check if both users are verified
  SELECT is_verified INTO v_sender_verified
  FROM profiles WHERE id = p_sender_id;

  SELECT is_verified INTO v_recipient_verified
  FROM profiles WHERE id = p_recipient_id;

  IF NOT v_sender_verified THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You must be verified to send coins. Verify via WhatsApp to unlock.'
    );
  END IF;

  IF NOT v_recipient_verified THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Recipient must be verified to receive coins.'
    );
  END IF;

  -- Check if users are friends
  SELECT EXISTS (
    SELECT 1 FROM friends
    WHERE ((user_id = p_sender_id AND friend_id = p_recipient_id)
       OR (user_id = p_recipient_id AND friend_id = p_sender_id))
    AND status = 'accepted'
  ) INTO v_are_friends;

  IF NOT v_are_friends THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only send coins to friends'
    );
  END IF;

  -- Check sender's balance
  SELECT balance INTO v_sender_balance
  FROM coins WHERE user_id = p_sender_id;

  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance'
    );
  END IF;

  -- Check daily send limit
  v_remaining_send_limit := get_remaining_send_limit(p_sender_id);
  IF v_remaining_send_limit < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Daily send limit exceeded. You can send %s more coins today.', v_remaining_send_limit)
    );
  END IF;

  -- Check daily receive limit
  v_remaining_receive_limit := get_remaining_receive_limit(p_recipient_id);
  IF v_remaining_receive_limit < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Recipient can only receive %s more coins today.', v_remaining_receive_limit)
    );
  END IF;

  -- All validations passed, process the transfer
  
  -- Deduct from sender
  UPDATE coins
  SET balance = balance - p_amount
  WHERE user_id = p_sender_id;

  -- Add to recipient
  UPDATE coins
  SET balance = balance + p_amount
  WHERE user_id = p_recipient_id;

  -- Update daily limits
  UPDATE profiles
  SET coins_sent_today = coins_sent_today + p_amount
  WHERE id = p_sender_id;

  UPDATE profiles
  SET coins_received_today = coins_received_today + p_amount
  WHERE id = p_recipient_id;

  -- Create transfer record
  INSERT INTO coin_transfers (
    sender_id,
    recipient_id,
    amount,
    status,
    conversation_id,
    completed_at
  ) VALUES (
    p_sender_id,
    p_recipient_id,
    p_amount,
    'completed',
    p_conversation_id,
    now()
  ) RETURNING id INTO v_transfer_id;

  -- Record transactions for both users
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    related_user_id
  ) VALUES (
    p_sender_id,
    -p_amount,
    'transfer_sent',
    format('Sent to user'),
    p_recipient_id
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    related_user_id
  ) VALUES (
    p_recipient_id,
    p_amount,
    'transfer_received',
    format('Received from user'),
    p_sender_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', v_transfer_id,
    'amount', p_amount,
    'remaining_send_limit', get_remaining_send_limit(p_sender_id),
    'remaining_receive_limit', get_remaining_receive_limit(p_recipient_id)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log failed transfer
    INSERT INTO coin_transfers (
      sender_id,
      recipient_id,
      amount,
      status,
      conversation_id,
      error_message
    ) VALUES (
      p_sender_id,
      p_recipient_id,
      p_amount,
      'failed',
      p_conversation_id,
      SQLERRM
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transfer failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update transaction type constraint to include new types
DO $$
BEGIN
  -- Drop the existing constraint
  ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;
  
  -- Add new constraint with all existing types plus transfer types
  ALTER TABLE coin_transactions ADD CONSTRAINT coin_transactions_transaction_type_check
    CHECK (transaction_type IN (
      'purchase',
      'ad_reward',
      'comment_reward',
      'card_sale',
      'card_purchase',
      'initial_card_creation',
      'card_sale_royalty',
      'balance_correction',
      'manager_bonus',
      'battle_win',
      'battle_loss',
      'battle_royalty',
      'transfer_sent',
      'transfer_received'
    ));
END $$;

-- Add related_user_id column to coin_transactions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coin_transactions' AND column_name = 'related_user_id'
  ) THEN
    ALTER TABLE coin_transactions ADD COLUMN related_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coin_transfers_sender ON coin_transfers(sender_id);
CREATE INDEX IF NOT EXISTS idx_coin_transfers_recipient ON coin_transfers(recipient_id);
CREATE INDEX IF NOT EXISTS idx_coin_transfers_conversation ON coin_transfers(conversation_id);
CREATE INDEX IF NOT EXISTS idx_coin_transfers_created ON coin_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_coins_sent_today ON profiles(coins_sent_today);
CREATE INDEX IF NOT EXISTS idx_profiles_coins_received_today ON profiles(coins_received_today);
