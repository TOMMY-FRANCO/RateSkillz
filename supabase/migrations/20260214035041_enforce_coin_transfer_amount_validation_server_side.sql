/*
  # Enforce Coin Transfer Amount Validation Server-Side

  ## Problem
  The coin transfer amount (min/max/step) was only enforced by the client-side
  slider UI. A user could bypass this via browser console or direct RPC call to
  send negative amounts (stealing coins), fractional amounts, or amounts outside
  the allowed range.

  ## Changes

  1. **`process_coin_transfer()` RPC function**
     - Reject amounts < 1 immediately with clear error
     - Reject amounts > sender's available balance
     - Reject non-integer amounts (must be whole coins in increments of 1)

  2. **`validate_friend_coin_transfer()` BEFORE INSERT trigger**
     - Added defense-in-depth amount validation (>= 1, whole number)
     - This catches any bypass of the RPC function (e.g., direct table insert)

  3. **Table constraint on `coin_transfers.amount`**
     - Added CHECK constraint ensuring amount >= 1
     - Database-level guarantee that no invalid transfer can ever be stored

  ## Security
  - Three layers of defense: RPC function, trigger, and table constraint
  - Negative amounts (theft vector) are now impossible
  - Fractional amounts are rejected
*/

-- ============================================================================
-- STEP 1: Add CHECK constraint on coin_transfers.amount
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'coin_transfers_amount_positive'
  ) THEN
    ALTER TABLE coin_transfers ADD CONSTRAINT coin_transfers_amount_positive
      CHECK (amount >= 1);
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Update validate_friend_coin_transfer() to check amount bounds
-- ============================================================================

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

  IF NEW.amount < 1 OR NEW.amount != TRUNC(NEW.amount) THEN
    NEW.status := 'failed';
    NEW.error_message := 'Invalid amount. Must be a whole number of at least 1 coin.';
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

-- ============================================================================
-- STEP 3: Update process_coin_transfer() RPC to validate amount upfront
-- ============================================================================

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
  IF p_amount IS NULL OR p_amount < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid amount. Minimum transfer is 1 coin.'
    );
  END IF;

  IF p_amount != TRUNC(p_amount) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid amount. Must be a whole number of coins.'
    );
  END IF;

  IF p_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot send coins to yourself'
    );
  END IF;

  SELECT coin_balance INTO v_sender_balance FROM profiles WHERE id = p_sender_id;

  IF v_sender_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Sender profile not found'
    );
  END IF;

  IF p_amount > v_sender_balance THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient balance. You have %s coins.', v_sender_balance)
    );
  END IF;

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
