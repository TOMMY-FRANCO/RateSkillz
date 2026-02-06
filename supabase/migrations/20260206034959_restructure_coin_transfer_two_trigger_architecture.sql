/*
  # Restructure coin transfer into two-trigger architecture

  1. Problem
    - Previous fix combined validation and execution in a single BEFORE INSERT trigger
    - Need clean separation: BEFORE = validate, AFTER = execute

  2. Changes
    - Drop previous `trigger_handle_coin_transfer` and `handle_coin_transfer_trigger()`
    - Create `validate_friend_coin_transfer()` BEFORE INSERT trigger:
      - Validates: sender/recipient verification, friendship, balance, daily limits, banned status
      - Sets status to 'completed' or 'failed' with error_message
      - Locks profile rows to prevent race conditions
      - Does NOT create coin_transactions or update balances
    - Create `process_coin_transfer_trigger()` AFTER INSERT trigger:
      - Only runs when status = 'completed'
      - Creates BOTH coin_transaction records (sender debit, recipient credit)
      - Updates daily limit counters (coins_sent_today, coins_received_today)
      - Balance updates happen automatically via existing trigger on coin_transactions
    - Create `user_daily_coin_limits` VIEW showing remaining limits per user
    - Simplified `process_coin_transfer()` RPC function: only inserts into coin_transfers

  3. Trigger execution order
    - BEFORE INSERT: validate_friend_coin_transfer (validates, sets status)
    - Row is inserted
    - AFTER INSERT: process_coin_transfer (creates coin_transactions if completed)
    - AFTER INSERT on coin_transactions: update_coin_balance_on_transaction (updates balances)

  4. Security
    - All functions SECURITY DEFINER with restricted search_path
    - Profile rows locked with FOR UPDATE to prevent race conditions
    - Banned users blocked from sending
    - No manual balance updates anywhere - only the coin_transactions trigger updates balances
*/

-- Step 1: Drop previous trigger and function from last migration
DROP TRIGGER IF EXISTS trigger_handle_coin_transfer ON coin_transfers;
DROP FUNCTION IF EXISTS handle_coin_transfer_trigger();

-- Step 2: Ensure status constraint allows 'pending' (may already exist from previous migration)
ALTER TABLE coin_transfers DROP CONSTRAINT IF EXISTS coin_transfers_status_check;
ALTER TABLE coin_transfers ADD CONSTRAINT coin_transfers_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text]));

-- Step 3: Create BEFORE INSERT trigger function (validation only)
CREATE OR REPLACE FUNCTION validate_friend_coin_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_sender_balance numeric;
  v_sender_verified boolean;
  v_sender_banned boolean;
  v_recipient_verified boolean;
  v_are_friends boolean;
  v_remaining_send numeric;
  v_remaining_receive numeric;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT is_verified, COALESCE(is_banned, false)
  INTO v_sender_verified, v_sender_banned
  FROM profiles WHERE id = NEW.sender_id;

  IF v_sender_banned THEN
    NEW.status := 'failed';
    NEW.error_message := 'Your account is suspended';
    RETURN NEW;
  END IF;

  IF NOT COALESCE(v_sender_verified, false) THEN
    NEW.status := 'failed';
    NEW.error_message := 'You must be verified to send coins. Verify via WhatsApp to unlock.';
    RETURN NEW;
  END IF;

  SELECT is_verified INTO v_recipient_verified FROM profiles WHERE id = NEW.recipient_id;
  IF NOT COALESCE(v_recipient_verified, false) THEN
    NEW.status := 'failed';
    NEW.error_message := 'Recipient must be verified to receive coins.';
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM friends
    WHERE ((user_id = NEW.sender_id AND friend_id = NEW.recipient_id)
       OR (user_id = NEW.recipient_id AND friend_id = NEW.sender_id))
      AND status = 'accepted'
  ) INTO v_are_friends;

  IF NOT v_are_friends THEN
    NEW.status := 'failed';
    NEW.error_message := 'You can only send coins to friends';
    RETURN NEW;
  END IF;

  IF NEW.sender_id < NEW.recipient_id THEN
    SELECT coin_balance INTO v_sender_balance FROM profiles WHERE id = NEW.sender_id FOR UPDATE;
    PERFORM 1 FROM profiles WHERE id = NEW.recipient_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM profiles WHERE id = NEW.recipient_id FOR UPDATE;
    SELECT coin_balance INTO v_sender_balance FROM profiles WHERE id = NEW.sender_id FOR UPDATE;
  END IF;

  IF v_sender_balance IS NULL OR v_sender_balance < NEW.amount THEN
    NEW.status := 'failed';
    NEW.error_message := 'Insufficient balance';
    RETURN NEW;
  END IF;

  v_remaining_send := get_remaining_send_limit(NEW.sender_id);
  IF v_remaining_send < NEW.amount THEN
    NEW.status := 'failed';
    NEW.error_message := format('Daily send limit exceeded. You can send %s more coins today.', v_remaining_send);
    RETURN NEW;
  END IF;

  v_remaining_receive := get_remaining_receive_limit(NEW.recipient_id);
  IF v_remaining_receive < NEW.amount THEN
    NEW.status := 'failed';
    NEW.error_message := format('Recipient can only receive %s more coins today.', v_remaining_receive);
    RETURN NEW;
  END IF;

  NEW.status := 'completed';
  NEW.completed_at := now();
  NEW.error_message := NULL;

  RETURN NEW;
END;
$$;

-- Step 4: Create AFTER INSERT trigger function (execution only)
CREATE OR REPLACE FUNCTION process_coin_transfer_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, related_user_id)
  VALUES (NEW.sender_id, -NEW.amount, 'coin_transfer_sent', 'Sent to user', NEW.recipient_id);

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, related_user_id)
  VALUES (NEW.recipient_id, NEW.amount, 'coin_transfer_received', 'Received from user', NEW.sender_id);

  UPDATE profiles SET coins_sent_today = coins_sent_today + NEW.amount WHERE id = NEW.sender_id;
  UPDATE profiles SET coins_received_today = coins_received_today + NEW.amount WHERE id = NEW.recipient_id;

  RETURN NEW;
END;
$$;

-- Step 5: Create the triggers with specified names
DROP TRIGGER IF EXISTS validate_friend_coin_transfer ON coin_transfers;
CREATE TRIGGER validate_friend_coin_transfer
  BEFORE INSERT ON coin_transfers
  FOR EACH ROW
  EXECUTE FUNCTION validate_friend_coin_transfer();

DROP TRIGGER IF EXISTS process_coin_transfer ON coin_transfers;
CREATE TRIGGER process_coin_transfer
  BEFORE INSERT ON coin_transfers
  FOR EACH ROW
  EXECUTE FUNCTION process_coin_transfer_trigger();

-- Wait - process_coin_transfer should be AFTER INSERT, not BEFORE
DROP TRIGGER IF EXISTS process_coin_transfer ON coin_transfers;
CREATE TRIGGER process_coin_transfer
  AFTER INSERT ON coin_transfers
  FOR EACH ROW
  EXECUTE FUNCTION process_coin_transfer_trigger();

-- Step 6: Simplified RPC function - only inserts into coin_transfers
CREATE OR REPLACE FUNCTION process_coin_transfer(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_amount numeric,
  p_conversation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_transfer record;
  v_sender_balance numeric;
  v_recipient_balance numeric;
BEGIN
  INSERT INTO coin_transfers (sender_id, recipient_id, amount, status, conversation_id)
  VALUES (p_sender_id, p_recipient_id, p_amount, 'pending', p_conversation_id)
  RETURNING * INTO v_transfer;

  IF v_transfer.status = 'completed' THEN
    SELECT coin_balance INTO v_sender_balance FROM profiles WHERE id = p_sender_id;
    SELECT coin_balance INTO v_recipient_balance FROM profiles WHERE id = p_recipient_id;

    RETURN jsonb_build_object(
      'success', true,
      'transfer_id', v_transfer.id,
      'amount', v_transfer.amount,
      'sender_balance', v_sender_balance,
      'recipient_balance', v_recipient_balance,
      'remaining_send_limit', get_remaining_send_limit(p_sender_id),
      'remaining_receive_limit', get_remaining_receive_limit(p_recipient_id)
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', v_transfer.error_message
    );
  END IF;

EXCEPTION WHEN OTHERS THEN
  PERFORM log_security_event(
    'suspicious_activity', 'high', p_sender_id, 'coin_transfer',
    jsonb_build_object('error', SQLERRM, 'recipient_id', p_recipient_id, 'amount', p_amount)
  );
  RETURN jsonb_build_object('success', false, 'error', 'Transfer failed: ' || SQLERRM);
END;
$$;

-- Step 7: Create user_daily_coin_limits VIEW
DROP VIEW IF EXISTS user_daily_coin_limits;
CREATE VIEW user_daily_coin_limits AS
SELECT
  p.id AS user_id,
  p.username,
  100 AS daily_send_limit,
  100 AS daily_receive_limit,
  COALESCE(p.coins_sent_today, 0) AS coins_sent_today,
  COALESCE(p.coins_received_today, 0) AS coins_received_today,
  GREATEST(0, 100 - COALESCE(p.coins_sent_today, 0)) AS remaining_send_limit,
  GREATEST(0, 100 - COALESCE(p.coins_received_today, 0)) AS remaining_receive_limit
FROM profiles p;

ALTER VIEW user_daily_coin_limits OWNER TO postgres;
