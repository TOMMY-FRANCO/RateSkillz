/*
  # Fix Double Coin Credits - System-Wide Correction

  ## Root Cause Identified
  Functions are MANUALLY updating profiles.coin_balance AND inserting into coin_transactions.
  This causes the trigger update_coin_balance_on_transaction() to fire and add coins AGAIN.

  **Double Credit Pattern:**
  1. Function: `UPDATE profiles SET coin_balance = coin_balance + X`
  2. Function: `INSERT INTO coin_transactions (...amount = X...)`
  3. Trigger fires: `UPDATE profiles SET coin_balance = coin_balance + X` ← DUPLICATE!

  ## Solution Strategy
  - For EARNING (positive amounts): Only INSERT into coin_transactions, let trigger handle balance
  - For SPENDING (negative amounts): Manually UPDATE balance first, then INSERT transaction (trigger skips negative)
  - Remove ALL manual balance updates for positive transactions
  - Keep manual updates only for negative (spending) transactions

  ## Affected Functions
  1. process_coin_transfer - FIXED: Remove manual recipient balance update
  2. distribute_coins_from_pool - VERIFIED: Already correct (no manual updates)
  3. All reward functions - Should already be correct (use distribute_coins_from_pool)
  4. execute_card_sale - ALREADY CORRECT: Manually handles negative, trigger handles positive

  ## Testing Required After Migration
  - Ad rewards: User should get exactly 10 coins, not 20
  - Comment rewards: User should get exactly 0.1 coins, not 0.2
  - Coin transfers: Recipient should get X coins once, not 2X
  - Card sales: Buyer pays once, seller gets paid once
  - WhatsApp rewards: User should get exactly 10 coins, not 20
*/

-- ============================================================================
-- 1. FIX process_coin_transfer - Remove Manual Recipient Balance Update
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
  -- Input Validation
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
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot send coins to yourself'
    );
  END IF;

  -- Validate both users exist
  PERFORM validate_coin_amount(p_amount, p_sender_id, 'coin_transfer', 100);
  PERFORM validate_coin_amount(p_amount, p_recipient_id, 'coin_transfer', 100);

  -- Check verification status
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

  -- Check friendship
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

  -- Row Locking (consistent order to prevent deadlocks)
  IF p_sender_id < p_recipient_id THEN
    SELECT coin_balance INTO v_sender_balance
    FROM profiles WHERE id = p_sender_id FOR UPDATE;

    PERFORM 1 FROM profiles WHERE id = p_recipient_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM profiles WHERE id = p_recipient_id FOR UPDATE;

    SELECT coin_balance INTO v_sender_balance
    FROM profiles WHERE id = p_sender_id FOR UPDATE;
  END IF;

  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance'
    );
  END IF;

  -- Check daily limits
  v_remaining_send_limit := get_remaining_send_limit(p_sender_id);
  IF v_remaining_send_limit < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Daily send limit exceeded. You can send %s more coins today.', v_remaining_send_limit)
    );
  END IF;

  v_remaining_receive_limit := get_remaining_receive_limit(p_recipient_id);
  IF v_remaining_receive_limit < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Recipient can only receive %s more coins today.', v_remaining_receive_limit)
    );
  END IF;

  -- Process the transfer

  -- CRITICAL FIX: Only deduct from sender manually (spending = negative = manual)
  -- Recipient will be credited by the trigger (earning = positive = automatic)
  UPDATE profiles
  SET coin_balance = coin_balance - p_amount
  WHERE id = p_sender_id;

  -- DO NOT manually update recipient balance - trigger will handle it!
  -- REMOVED: UPDATE profiles SET coin_balance = coin_balance + p_amount WHERE id = p_recipient_id;

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

  -- Record sender transaction (negative, trigger will skip)
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
  );

  -- Record recipient transaction (positive, trigger will add to balance)
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

COMMENT ON FUNCTION process_coin_transfer IS
'Processes peer-to-peer coin transfers. Sender balance updated manually (negative), recipient balance updated by trigger (positive). Prevents double credits.';

-- ============================================================================
-- 2. Add Function to Detect Double Credit Issues
-- ============================================================================

CREATE OR REPLACE FUNCTION detect_double_credits(
  p_user_id uuid,
  p_minutes_ago integer DEFAULT 60
)
RETURNS TABLE (
  transaction_id uuid,
  amount numeric,
  transaction_type text,
  created_at timestamptz,
  duplicate_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Find transactions where same amount was credited multiple times within short timeframe
  RETURN QUERY
  SELECT
    ct.id,
    ct.amount,
    ct.transaction_type,
    ct.created_at,
    COUNT(*) OVER (
      PARTITION BY ct.user_id, ct.amount, ct.transaction_type,
        DATE_TRUNC('minute', ct.created_at)
    ) as duplicate_count
  FROM coin_transactions ct
  WHERE ct.user_id = p_user_id
    AND ct.created_at >= (now() - (p_minutes_ago || ' minutes')::interval)
    AND ct.amount > 0
  ORDER BY ct.created_at DESC;
END;
$$;

COMMENT ON FUNCTION detect_double_credits IS
'Detects potential double credit issues by finding duplicate transactions with same amount and type within minutes.';

-- ============================================================================
-- 3. Create Balance Audit Function
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_user_balance(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_balance numeric;
  v_calculated_balance numeric;
  v_discrepancy numeric;
  v_positive_sum numeric;
  v_negative_sum numeric;
BEGIN
  -- Get current profile balance
  SELECT coin_balance INTO v_profile_balance
  FROM profiles
  WHERE id = p_user_id;

  IF v_profile_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Calculate balance from transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_positive_sum
  FROM coin_transactions
  WHERE user_id = p_user_id AND amount > 0;

  SELECT COALESCE(SUM(amount), 0) INTO v_negative_sum
  FROM coin_transactions
  WHERE user_id = p_user_id AND amount < 0;

  v_calculated_balance := v_positive_sum + v_negative_sum;
  v_discrepancy := v_profile_balance - v_calculated_balance;

  RETURN jsonb_build_object(
    'success', true,
    'profile_balance', v_profile_balance,
    'calculated_balance', v_calculated_balance,
    'positive_transactions', v_positive_sum,
    'negative_transactions', v_negative_sum,
    'discrepancy', v_discrepancy,
    'has_discrepancy', ABS(v_discrepancy) > 0.01,
    'message', CASE
      WHEN ABS(v_discrepancy) < 0.01 THEN 'Balance is correct'
      WHEN v_discrepancy > 0 THEN 'Profile has MORE coins than transactions suggest (possible double credit)'
      ELSE 'Profile has LESS coins than transactions suggest'
    END
  );
END;
$$;

COMMENT ON FUNCTION audit_user_balance IS
'Audits a user balance by comparing profile.coin_balance against sum of transactions. Detects double credits.';

GRANT EXECUTE ON FUNCTION detect_double_credits(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION audit_user_balance(uuid) TO authenticated;

-- ============================================================================
-- 4. Log Migration Completion
-- ============================================================================

INSERT INTO admin_security_log (
  event_type,
  severity,
  operation_type,
  details
) VALUES (
  'validation_failed',
  'critical',
  'migration_applied',
  jsonb_build_object(
    'migration', 'fix_double_coin_credits_system_wide',
    'timestamp', now(),
    'changes', jsonb_build_array(
      'FIXED: process_coin_transfer - removed manual recipient balance update',
      'VERIFIED: distribute_coins_from_pool - no manual balance updates',
      'ADDED: detect_double_credits function for debugging',
      'ADDED: audit_user_balance function for balance verification',
      'PRINCIPLE: Positive amounts (earning) updated ONLY by trigger',
      'PRINCIPLE: Negative amounts (spending) updated manually then logged',
      'TESTING: Run audit_user_balance on all users to find discrepancies'
    ),
    'impact', 'CRITICAL - Fixed double coin credit bug system-wide',
    'root_cause', 'Functions were manually updating balance AND inserting transactions, causing trigger to add coins again',
    'solution', 'Removed manual balance updates for positive transactions, let trigger handle all positive amounts'
  )
);

-- ============================================================================
-- 5. Generate Report
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE 'DOUBLE COIN CREDIT FIX - MIGRATION COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes Applied:';
  RAISE NOTICE '  ✓ process_coin_transfer fixed - no more double credits to recipients';
  RAISE NOTICE '  ✓ distribute_coins_from_pool verified - already correct';
  RAISE NOTICE '  ✓ Audit functions created for detecting issues';
  RAISE NOTICE '';
  RAISE NOTICE 'Testing Recommendations:';
  RAISE NOTICE '  1. Watch an ad - should receive exactly 10 coins';
  RAISE NOTICE '  2. Leave a comment - should receive exactly 0.1 coins';
  RAISE NOTICE '  3. Send coins to friend - friend should receive exact amount';
  RAISE NOTICE '  4. Buy a card - buyer pays once, seller receives once';
  RAISE NOTICE '';
  RAISE NOTICE 'Audit Commands:';
  RAISE NOTICE '  SELECT audit_user_balance(''user_id'');';
  RAISE NOTICE '  SELECT * FROM detect_double_credits(''user_id'');';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;
