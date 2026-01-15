/*
  # RatingSkill Coin Economy Security - Core Protections

  ## Purpose
  Implement essential safeguards to prevent coin duplication, double-spend attacks,
  and other major exploits in the coin economy system.

  ## Four Core Protections

  ### Protection #1: Database Transactions with Row Locking
  - Use PostgreSQL FOR UPDATE to lock balance rows during operations
  - Prevents concurrent operations from causing race conditions
  - Ensures atomic operations that fully succeed or fully fail
  - All coin operations wrapped in proper transaction boundaries

  ### Protection #2: Input Validation
  - Reject negative coin amounts (prevent theft via negative purchases)
  - Reject amounts over 1,000,000 coins (prevent overflow attacks)
  - Validate all user IDs exist before processing
  - Validate coin amounts are reasonable for operation type

  ### Protection #3: Server Authority (Already Implemented)
  - All balances stored in database only (never in client localStorage)
  - All operations calculated server-side
  - Client can only display, never modify balances
  - Browser console edits have zero effect on actual balances

  ### Protection #4: Admin Security Logging
  - Log all suspicious activities (negative amounts, huge amounts, etc.)
  - Track failed validation attempts
  - Monitor for potential exploit attempts
  - Enable admin review of security events

  ## Changes Made
  1. Create admin_security_log table for tracking suspicious activities
  2. Add balance check constraint to prevent negative balances
  3. Update process_stripe_coin_purchase with row locking and validation
  4. Update process_coin_transfer with row locking and validation
  5. Update purchase_card_at_fixed_price with enhanced validation
  6. Add security logging to all coin operations
  7. Create admin function to query security logs

  ## Security
  - Enable RLS on admin_security_log (admin access only)
  - All functions use SECURITY DEFINER for controlled access
  - Row-level locking prevents race conditions
  - Comprehensive validation before any balance changes
*/

-- ============================================================================
-- 1. CREATE ADMIN SECURITY LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_security_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'validation_failed',
    'negative_amount_rejected',
    'excessive_amount_rejected',
    'invalid_user_rejected',
    'duplicate_payment_detected',
    'concurrent_operation_detected',
    'suspicious_activity'
  )),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  operation_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_security_log_created ON admin_security_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_security_log_user ON admin_security_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_security_log_event ON admin_security_log(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_security_log_severity ON admin_security_log(severity);

ALTER TABLE admin_security_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view security logs (you'll need to add admin role management)
CREATE POLICY "Service role can view all security logs"
  ON admin_security_log FOR SELECT
  TO service_role
  USING (true);

-- ============================================================================
-- 2. ADD BALANCE CONSTRAINTS TO PREVENT NEGATIVE BALANCES
-- ============================================================================

-- Add check constraint to profiles.coin_balance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_coin_balance_non_negative'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_coin_balance_non_negative
    CHECK (coin_balance >= 0);
  END IF;
END $$;

-- ============================================================================
-- 3. SECURITY LOGGING HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type text,
  p_severity text,
  p_user_id uuid,
  p_operation_type text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_security_log (
    event_type,
    severity,
    user_id,
    operation_type,
    details
  ) VALUES (
    p_event_type,
    p_severity,
    p_user_id,
    p_operation_type,
    p_details
  );
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the main operation if logging fails
  RAISE WARNING 'Failed to log security event: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 4. INPUT VALIDATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_coin_amount(
  p_amount numeric,
  p_user_id uuid,
  p_operation_type text,
  p_max_amount numeric DEFAULT 1000000
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_exists boolean;
BEGIN
  -- Validation #1: Reject negative amounts
  IF p_amount < 0 THEN
    PERFORM log_security_event(
      'negative_amount_rejected',
      'high',
      p_user_id,
      p_operation_type,
      jsonb_build_object(
        'amount', p_amount,
        'reason', 'Negative amount rejected'
      )
    );
    RAISE EXCEPTION 'Invalid amount: cannot be negative';
  END IF;

  -- Validation #2: Reject zero amounts (except for specific operations)
  IF p_amount = 0 AND p_operation_type NOT IN ('balance_correction') THEN
    PERFORM log_security_event(
      'validation_failed',
      'low',
      p_user_id,
      p_operation_type,
      jsonb_build_object(
        'amount', p_amount,
        'reason', 'Zero amount rejected'
      )
    );
    RAISE EXCEPTION 'Invalid amount: cannot be zero';
  END IF;

  -- Validation #3: Reject excessive amounts
  IF p_amount > p_max_amount THEN
    PERFORM log_security_event(
      'excessive_amount_rejected',
      'high',
      p_user_id,
      p_operation_type,
      jsonb_build_object(
        'amount', p_amount,
        'max_allowed', p_max_amount,
        'reason', 'Amount exceeds maximum allowed'
      )
    );
    RAISE EXCEPTION 'Invalid amount: cannot exceed %', p_max_amount;
  END IF;

  -- Validation #4: Verify user exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id)
  INTO v_user_exists;

  IF NOT v_user_exists THEN
    PERFORM log_security_event(
      'invalid_user_rejected',
      'critical',
      p_user_id,
      p_operation_type,
      jsonb_build_object(
        'user_id', p_user_id,
        'reason', 'User does not exist'
      )
    );
    RAISE EXCEPTION 'Invalid user: user does not exist';
  END IF;

  RETURN true;
END;
$$;

-- ============================================================================
-- 5. UPDATE STRIPE PURCHASE FUNCTION WITH SECURITY
-- ============================================================================

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
  v_current_balance numeric;
BEGIN
  -- PROTECTION #2: Input Validation
  -- Validate coin amount (max 10,000 for single purchase)
  PERFORM validate_coin_amount(p_coins_amount, p_user_id, 'stripe_purchase', 10000);

  -- Validate price is positive
  IF p_price_gbp <= 0 THEN
    PERFORM log_security_event(
      'validation_failed',
      'high',
      p_user_id,
      'stripe_purchase',
      jsonb_build_object(
        'price_gbp', p_price_gbp,
        'reason', 'Invalid price'
      )
    );
    RAISE EXCEPTION 'Invalid price: must be positive';
  END IF;

  -- Check for duplicate transaction
  v_is_duplicate := check_duplicate_payment(p_payment_intent_id, p_user_id, p_coins_amount);

  IF v_is_duplicate THEN
    PERFORM log_security_event(
      'duplicate_payment_detected',
      'medium',
      p_user_id,
      'stripe_purchase',
      jsonb_build_object(
        'payment_intent_id', p_payment_intent_id,
        'amount', p_coins_amount
      )
    );

    RAISE NOTICE 'Duplicate payment detected: %', p_payment_intent_id;
    RETURN json_build_object(
      'success', false,
      'message', 'Payment already processed',
      'duplicate', true
    );
  END IF;

  -- PROTECTION #1: Row Locking - Lock the user's profile row
  SELECT coin_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;  -- THIS LOCKS THE ROW UNTIL TRANSACTION COMPLETES

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  -- Check coin pool availability (warning only, don't block)
  IF EXISTS(
    SELECT 1 FROM coin_pool
    WHERE id = '00000000-0000-0000-0000-000000000001'
    AND remaining_coins < p_coins_amount
  ) THEN
    RAISE WARNING 'Coin pool low but processing payment anyway: % coins remaining',
      (SELECT remaining_coins FROM coin_pool WHERE id = '00000000-0000-0000-0000-000000000001');
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

  -- Get updated balance (still holding the lock)
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
  PERFORM log_security_event(
    'suspicious_activity',
    'critical',
    p_user_id,
    'stripe_purchase',
    jsonb_build_object(
      'error', SQLERRM,
      'payment_intent_id', p_payment_intent_id,
      'amount', p_coins_amount
    )
  );
  RAISE;
END;
$$;

-- ============================================================================
-- 6. UPDATE COIN TRANSFER FUNCTION WITH SECURITY
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

  -- Deduct from sender (manual update with negative amount)
  UPDATE profiles
  SET coin_balance = coin_balance - p_amount
  WHERE id = p_sender_id;

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

-- ============================================================================
-- 7. UPDATE CARD PURCHASE FUNCTION WITH ENHANCED VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION purchase_card_at_fixed_price(
  p_card_user_id uuid,
  p_buyer_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seller_id uuid;
  v_original_owner_id uuid;
  v_current_price numeric;
  v_new_price numeric;
  v_buyer_balance numeric;
  v_times_traded integer;
  v_is_first_sale boolean;
  v_seller_payment numeric;
  v_royalty_payment numeric := 5.00;
  v_transaction_id uuid;
  v_result json;
BEGIN
  -- PROTECTION #2: Input Validation
  PERFORM validate_coin_amount(1, p_buyer_id, 'card_purchase', 1000000);
  PERFORM validate_coin_amount(1, p_card_user_id, 'card_purchase', 1000000);

  -- PROTECTION #1: Row Locking - Get card with lock
  SELECT owner_id, current_price, times_traded, original_owner_id
  INTO v_seller_id, v_current_price, v_times_traded, v_original_owner_id
  FROM card_ownership
  WHERE card_user_id = p_card_user_id
  FOR UPDATE;  -- LOCK CARD ROW

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  -- Set original owner if not set (for existing cards)
  IF v_original_owner_id IS NULL THEN
    v_original_owner_id := p_card_user_id;
    UPDATE card_ownership
    SET original_owner_id = p_card_user_id
    WHERE card_user_id = p_card_user_id;
  END IF;

  v_is_first_sale := (v_times_traded = 0);

  -- Prevent buying own card
  IF p_buyer_id = v_seller_id THEN
    PERFORM log_security_event(
      'validation_failed',
      'low',
      p_buyer_id,
      'card_purchase',
      jsonb_build_object(
        'reason', 'Attempted to buy own card',
        'card_user_id', p_card_user_id
      )
    );
    RAISE EXCEPTION 'Cannot buy your own card';
  END IF;

  -- Prevent original owner from buying their card back from a manager
  IF p_buyer_id = v_original_owner_id AND NOT v_is_first_sale THEN
    PERFORM log_security_event(
      'validation_failed',
      'low',
      p_buyer_id,
      'card_purchase',
      jsonb_build_object(
        'reason', 'Attempted to buy own card back',
        'card_user_id', p_card_user_id
      )
    );
    RAISE EXCEPTION 'You cannot buy your own card back from a manager';
  END IF;

  -- PROTECTION #1: Lock buyer's profile row
  SELECT coin_balance INTO v_buyer_balance
  FROM profiles
  WHERE id = p_buyer_id
  FOR UPDATE;  -- LOCK BUYER ROW

  -- Validate purchase amount
  PERFORM validate_coin_amount(v_current_price, p_buyer_id, 'card_purchase', 1000000);

  IF v_buyer_balance IS NULL OR v_buyer_balance < v_current_price THEN
    RAISE EXCEPTION 'Insufficient coins. You have % but need %', COALESCE(v_buyer_balance, 0), v_current_price;
  END IF;

  -- Calculate payment split
  IF v_is_first_sale THEN
    v_seller_payment := v_current_price;
    v_royalty_payment := 0;
  ELSE
    v_seller_payment := v_current_price - 5.00;
    v_royalty_payment := 5.00;
  END IF;

  -- Calculate new price
  v_new_price := v_current_price + 10.00;

  -- STEP 1: Manually deduct from buyer
  UPDATE profiles
  SET coin_balance = coin_balance - v_current_price
  WHERE id = p_buyer_id;

  -- STEP 2: Record buyer transaction (negative)
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    p_buyer_id,
    -v_current_price,
    'card_purchase',
    'Purchased card at fixed price of ' || v_current_price || ' coins',
    p_card_user_id::text
  );

  -- STEP 3: Record seller transaction (positive, trigger updates balance)
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    v_seller_id,
    v_seller_payment,
    'card_sale',
    'Sold card at fixed price (received ' || v_seller_payment || ' of ' || v_current_price || ')',
    p_card_user_id::text
  );

  -- STEP 4: Record royalty transaction if applicable
  IF NOT v_is_first_sale AND v_seller_id != v_original_owner_id THEN
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
    VALUES (
      v_original_owner_id,
      v_royalty_payment,
      'card_royalty',
      'Royalty from card resale',
      p_card_user_id::text
    );
  END IF;

  -- STEP 5: Transfer ownership
  UPDATE card_ownership
  SET
    owner_id = p_buyer_id,
    current_price = v_new_price,
    times_traded = times_traded + 1,
    last_purchase_price = v_current_price,
    acquired_at = now(),
    updated_at = now()
  WHERE card_user_id = p_card_user_id;

  -- STEP 6: Record sale in card_transactions
  INSERT INTO card_transactions (
    card_user_id,
    seller_id,
    buyer_id,
    sale_price,
    transaction_type,
    card_value_at_sale,
    previous_value,
    new_value
  )
  VALUES (
    p_card_user_id,
    v_seller_id,
    p_buyer_id,
    v_current_price,
    CASE WHEN v_is_first_sale THEN 'initial_purchase' ELSE 'sale' END,
    v_current_price,
    v_current_price,
    v_new_price
  )
  RETURNING id INTO v_transaction_id;

  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_value', v_current_price,
    'new_value', v_new_price,
    'paid_amount', v_current_price,
    'seller_received', v_seller_payment,
    'royalty_paid', v_royalty_payment,
    'is_first_sale', v_is_first_sale
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  PERFORM log_security_event(
    'suspicious_activity',
    'high',
    p_buyer_id,
    'card_purchase',
    jsonb_build_object(
      'error', SQLERRM,
      'card_user_id', p_card_user_id,
      'price', v_current_price
    )
  );
  RAISE EXCEPTION 'Purchase failed: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 8. ADMIN FUNCTION TO QUERY SECURITY LOGS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_security_events(
  p_limit integer DEFAULT 100,
  p_severity text DEFAULT NULL,
  p_event_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  event_type text,
  severity text,
  user_id uuid,
  username text,
  operation_type text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.event_type,
    l.severity,
    l.user_id,
    p.username,
    l.operation_type,
    l.details,
    l.created_at
  FROM admin_security_log l
  LEFT JOIN profiles p ON l.user_id = p.id
  WHERE
    (p_severity IS NULL OR l.severity = p_severity)
    AND (p_event_type IS NULL OR l.event_type = p_event_type)
  ORDER BY l.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- DONE - Security Protections Implemented
-- ============================================================================
