/*
  # Fix double coin payouts by moving all transfer logic to a trigger

  1. Problem
    - `process_coin_transfer()` manually updates balances AND inserts coin_transactions
    - The `update_coin_balance_on_transaction` trigger on coin_transactions ALSO updates balances
    - This causes double balance changes on every transfer

  2. Solution
    - Add 'pending' to coin_transfers status constraint
    - Create a BEFORE INSERT trigger on coin_transfers that handles ALL logic:
      - Validates friendship, verification, balance, daily limits
      - Creates coin_transaction records (which fire the existing balance trigger)
      - Updates daily limit counters
      - Sets status to 'completed' or 'failed'
    - Simplify `process_coin_transfer()` to ONLY insert into coin_transfers
    - NO manual balance updates anywhere - the existing trigger on coin_transactions handles it

  3. Tables modified
    - `coin_transfers` - added 'pending' to status constraint, added BEFORE INSERT trigger

  4. Functions modified
    - `process_coin_transfer()` - simplified to only insert into coin_transfers and return result
    - `handle_coin_transfer_trigger()` - new trigger function for all transfer logic

  5. Security
    - Both functions remain SECURITY DEFINER with restricted search_path
    - All existing validation checks preserved
    - Security event logging preserved
*/

-- Step 1: Update the status constraint to allow 'pending' (used briefly during trigger processing)
ALTER TABLE coin_transfers DROP CONSTRAINT IF EXISTS coin_transfers_status_check;
ALTER TABLE coin_transfers ADD CONSTRAINT coin_transfers_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text]));

-- Step 2: Create the BEFORE INSERT trigger function
CREATE OR REPLACE FUNCTION handle_coin_transfer_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_sender_balance numeric;
  v_sender_verified boolean;
  v_recipient_verified boolean;
  v_remaining_send_limit numeric;
  v_remaining_receive_limit numeric;
  v_are_friends boolean;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT is_verified INTO v_sender_verified FROM profiles WHERE id = NEW.sender_id;
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

  v_remaining_send_limit := get_remaining_send_limit(NEW.sender_id);
  IF v_remaining_send_limit < NEW.amount THEN
    NEW.status := 'failed';
    NEW.error_message := format('Daily send limit exceeded. You can send %s more coins today.', v_remaining_send_limit);
    RETURN NEW;
  END IF;

  v_remaining_receive_limit := get_remaining_receive_limit(NEW.recipient_id);
  IF v_remaining_receive_limit < NEW.amount THEN
    NEW.status := 'failed';
    NEW.error_message := format('Recipient can only receive %s more coins today.', v_remaining_receive_limit);
    RETURN NEW;
  END IF;

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, related_user_id)
  VALUES (NEW.sender_id, -NEW.amount, 'coin_transfer_sent', 'Sent to user', NEW.recipient_id);

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, related_user_id)
  VALUES (NEW.recipient_id, NEW.amount, 'coin_transfer_received', 'Received from user', NEW.sender_id);

  UPDATE profiles SET coins_sent_today = coins_sent_today + NEW.amount WHERE id = NEW.sender_id;
  UPDATE profiles SET coins_received_today = coins_received_today + NEW.amount WHERE id = NEW.recipient_id;

  NEW.status := 'completed';
  NEW.completed_at := now();
  NEW.error_message := NULL;

  RETURN NEW;
END;
$$;

-- Step 3: Create the trigger (drop if exists first)
DROP TRIGGER IF EXISTS trigger_handle_coin_transfer ON coin_transfers;
CREATE TRIGGER trigger_handle_coin_transfer
  BEFORE INSERT ON coin_transfers
  FOR EACH ROW
  EXECUTE FUNCTION handle_coin_transfer_trigger();

-- Step 4: Replace process_coin_transfer to only insert into coin_transfers
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
BEGIN
  INSERT INTO coin_transfers (sender_id, recipient_id, amount, status, conversation_id)
  VALUES (p_sender_id, p_recipient_id, p_amount, 'pending', p_conversation_id)
  RETURNING * INTO v_transfer;

  IF v_transfer.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'transfer_id', v_transfer.id,
      'amount', v_transfer.amount,
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
