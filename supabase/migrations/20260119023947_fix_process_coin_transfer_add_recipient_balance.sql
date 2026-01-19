/*
  # Fix Coin Transfer - Add Missing Recipient Balance Update

  ## Issue
  The process_coin_transfer() function was deducting coins from sender but NOT adding
  coins to recipient's coin_balance. This caused transfers to fail or lose coins.

  ## Fix
  Add missing UPDATE statement to increase recipient's coin_balance by transfer amount.

  ## Changes
  1. Recreate process_coin_transfer() function
  2. Add UPDATE statement: UPDATE profiles SET coin_balance = coin_balance + p_amount WHERE id = p_recipient_id
  3. Ensure proper transaction order:
     - Deduct from sender balance
     - ADD to recipient balance (MISSING - NOW ADDED)
     - Update sender coins_sent_today
     - Update recipient coins_received_today
     - Create transfer record
     - Create transaction records

  ## Security
  - All UPDATE statements have WHERE clauses specifying exact user IDs
  - Row locking prevents race conditions
  - Atomic transaction ensures all-or-nothing updates
*/

CREATE OR REPLACE FUNCTION process_coin_transfer(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_amount numeric,
  p_conversation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  -- PROTECTION #2: Input Validation
  -- Validate sender amount (10-100 in increments of 10)
  IF p_amount <= 0 OR p_amount > 100 OR MOD(p_amount, 10) != 0 THEN
    PERFORM log_security_event(
      'validation_failed',
      'medium',
      p_sender_id,
      'coin_transfer',
      jsonb_build_object(
        'amount', p_amount,
        'recipient_id', p_recipient_id,
        'reason', 'Invalid transfer amount'
      )
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be in 10 coin increments (10, 20, 30... 100)'
    );
  END IF;

  -- Prevent self-transfer
  IF p_sender_id = p_recipient_id THEN
    PERFORM log_security_event(
      'validation_failed',
      'low',
      p_sender_id,
      'coin_transfer',
      jsonb_build_object(
        'reason', 'Attempted self-transfer'
      )
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot send coins to yourself'
    );
  END IF;

  -- Validate both users exist
  PERFORM validate_coin_amount(p_amount, p_sender_id, 'coin_transfer', 100);
  PERFORM validate_coin_amount(p_amount, p_recipient_id, 'coin_transfer', 100);

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

  -- PROTECTION #1: Row Locking - Lock both sender and recipient (in consistent order to prevent deadlocks)
  IF p_sender_id < p_recipient_id THEN
    SELECT coin_balance INTO v_sender_balance
    FROM profiles
    WHERE id = p_sender_id
    FOR UPDATE;  -- LOCK SENDER

    PERFORM 1
    FROM profiles
    WHERE id = p_recipient_id
    FOR UPDATE;  -- LOCK RECIPIENT
  ELSE
    PERFORM 1
    FROM profiles
    WHERE id = p_recipient_id
    FOR UPDATE;  -- LOCK RECIPIENT

    SELECT coin_balance INTO v_sender_balance
    FROM profiles
    WHERE id = p_sender_id
    FOR UPDATE;  -- LOCK SENDER
  END IF;

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

  -- CRITICAL FIX: Deduct from sender AND add to recipient
  -- Step 1: Deduct from sender's balance
  UPDATE profiles
  SET coin_balance = coin_balance - p_amount
  WHERE id = p_sender_id;

  -- Step 2: ADD to recipient's balance (THIS WAS MISSING!)
  UPDATE profiles
  SET coin_balance = coin_balance + p_amount
  WHERE id = p_recipient_id;

  -- Step 3: Update daily limits
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

  -- Record sender transaction (negative, trigger ignores)
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

  -- Record recipient transaction (positive, trigger updates balance)
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
    PERFORM log_security_event(
      'suspicious_activity',
      'high',
      p_sender_id,
      'coin_transfer',
      jsonb_build_object(
        'error', SQLERRM,
        'recipient_id', p_recipient_id,
        'amount', p_amount
      )
    );

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
$$;
