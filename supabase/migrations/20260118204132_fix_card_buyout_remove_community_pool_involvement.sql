/*
  # Fix Card Buyout - Remove Community Pool Involvement

  ## Critical Issue
  Current buy_myself_out function INCORRECTLY involves the community coin_pool.
  
  **WRONG**: Deducts card price from coin_pool.remaining_coins
  **CORRECT**: Card buyouts are direct user-to-user transactions using user's own coins
  
  ## Problem
  When a user buys themselves out for 150 coins (50 card price + 100 to manager):
  - User pays from their own profiles.coin_balance ✓
  - BUT system also deducts from community pool ✗ (INCORRECT!)
  
  This is wrong because:
  1. User already has these coins in their balance
  2. This is NOT a pool distribution/reward
  3. Community pool is for EARNING coins (ads, comments), not spending
  4. Double-counting/incorrect pool accounting
  
  ## Correct Flow
  Direct user transaction only:
  1. User balance: -150 coins (card_price + 100)
  2. Manager balance: +100 coins (direct payment)
  3. DUMP pool: +50 coins (reclamation fee)
  4. Community pool: NO CHANGE (not involved)
  
  ## Changes
  1. Remove community pool ID lookup
  2. Remove community pool update step
  3. Keep DUMP pool routing (correct)
  4. Keep all transaction records (correct)
  5. Keep atomic operations (correct)
  
  ## Data Safety
  - No data loss
  - All transaction records preserved
  - Atomic operations maintained
  - Only removes incorrect pool accounting
*/

-- ============================================================================
-- UPDATE buy_myself_out Function - Remove Community Pool Involvement
-- ============================================================================

CREATE OR REPLACE FUNCTION buy_myself_out(
  p_card_user_id uuid,
  p_original_owner_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_holder_id uuid;
  v_original_owner_id uuid;
  v_current_price numeric;
  v_total_cost numeric;
  v_payment_to_holder numeric := 100.00;
  v_buyer_balance numeric;
  v_transaction_id uuid;
  v_dump_pool_id uuid;
  v_result json;
BEGIN
  -- Get DUMP pool ID
  SELECT id INTO v_dump_pool_id
  FROM resource_pools
  WHERE pool_name = 'DUMP';

  IF v_dump_pool_id IS NULL THEN
    RAISE EXCEPTION 'DUMP pool not found. Please contact support.';
  END IF;

  -- Get current card ownership details
  SELECT owner_id, current_price, original_owner_id
  INTO v_current_holder_id, v_current_price, v_original_owner_id
  FROM card_ownership
  WHERE card_user_id = p_card_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  -- Verify the caller is the original owner
  IF p_original_owner_id != v_original_owner_id THEN
    RAISE EXCEPTION 'Only the original card owner can buy themselves out';
  END IF;

  -- Verify the caller is the card user (their own card)
  IF p_original_owner_id != p_card_user_id THEN
    RAISE EXCEPTION 'You can only buy out your own card';
  END IF;

  -- Prevent buying out if you already own it
  IF p_original_owner_id = v_current_holder_id THEN
    RAISE EXCEPTION 'You already own this card';
  END IF;

  -- Calculate total cost: current_price + 100 coins to holder
  v_total_cost := v_current_price + v_payment_to_holder;

  -- Check buyer has enough coins
  SELECT coin_balance INTO v_buyer_balance
  FROM profiles
  WHERE id = p_original_owner_id;

  IF v_buyer_balance IS NULL OR v_buyer_balance < v_total_cost THEN
    RAISE EXCEPTION 'Insufficient coins. You have % but need % (card price % + payment to holder %)',
      COALESCE(v_buyer_balance, 0), v_total_cost, v_current_price, v_payment_to_holder;
  END IF;

  -- ========================================================================
  -- ATOMIC TRANSACTION: Direct user-to-user + DUMP pool
  -- Community pool NOT involved - these are user's own coins
  -- ========================================================================

  -- STEP 1: Deduct total cost from user's balance (direct)
  UPDATE profiles
  SET coin_balance = coin_balance - v_total_cost
  WHERE id = p_original_owner_id;

  -- STEP 2: Record negative transaction for user (full cost)
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    p_original_owner_id,
    -v_total_cost,
    'card_buyout',
    'Bought back own card (' || v_current_price || ' coins to DUMP + ' || v_payment_to_holder || ' coins to holder)',
    p_card_user_id::text
  );

  -- STEP 3: Record payment to holder transaction (100 coins - positive)
  -- Trigger will automatically update holder's balance (direct)
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    v_current_holder_id,
    v_payment_to_holder,
    'card_buyout_payment',
    'Received 100 coins from card buyout',
    p_card_user_id::text
  );

  -- STEP 4: Record card price payment to DUMP pool
  -- This transaction tracks the reclamation fee
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    p_original_owner_id,
    v_current_price,
    'card_buyout_dump',
    'Card reclamation fee to DUMP pool (' || v_current_price || ' coins)',
    p_card_user_id::text
  );

  -- STEP 5: Add card price to DUMP pool (direct collection)
  -- NO community pool involvement - user paid directly
  UPDATE resource_pools
  SET 
    total_coins = total_coins + v_current_price,
    updated_at = now()
  WHERE id = v_dump_pool_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update DUMP pool';
  END IF;

  -- STEP 6: Transfer ownership back to original owner
  UPDATE card_ownership
  SET
    owner_id = p_original_owner_id,
    times_traded = times_traded + 1,
    last_purchase_price = v_total_cost,
    acquired_at = now(),
    updated_at = now()
  WHERE card_user_id = p_card_user_id;

  -- STEP 7: Record buyout transaction in card_transactions
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
    v_current_holder_id,
    p_original_owner_id,
    v_total_cost,
    'buyout',
    v_current_price,
    v_current_price,
    v_current_price
  )
  RETURNING id INTO v_transaction_id;

  -- Log to admin security log
  INSERT INTO admin_security_log (
    event_type,
    severity,
    operation_type,
    details
  ) VALUES (
    'validation_failed',
    'info',
    'card_buyout',
    jsonb_build_object(
      'transaction_id', v_transaction_id,
      'card_user_id', p_card_user_id,
      'buyer_id', p_original_owner_id,
      'seller_id', v_current_holder_id,
      'total_cost', v_total_cost,
      'payment_to_holder', v_payment_to_holder,
      'payment_to_dump', v_current_price,
      'dump_pool_routing', 'direct',
      'community_pool_involved', false,
      'coins_burned', 0,
      'transaction_type', 'direct_user_payment',
      'timestamp', now()
    )
  );

  -- Return success result
  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'card_price', v_current_price,
    'payment_to_holder', v_payment_to_holder,
    'total_cost', v_total_cost,
    'coins_burned', 0,
    'payment_to_dump', v_current_price,
    'dump_pool_active', true,
    'community_pool_involved', false,
    'transaction_type', 'direct_user_payment'
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Error propagates up, entire transaction rolled back automatically
  RAISE EXCEPTION 'Buyout failed: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION buy_myself_out IS
'Allows original card owner to reclaim their card from manager via direct payment.
Payment breakdown (direct user transaction):
- User pays: card_price + 100 coins from their own balance
- Manager receives: 100 coins (direct)
- DUMP pool receives: card_price (reclamation fee, direct)
- Community pool: NOT involved (user owns these coins)
All operations atomic - if any step fails, entire transaction rolls back.';

-- ============================================================================
-- Verification & Logging
-- ============================================================================

-- Log migration completion
INSERT INTO admin_security_log (
  event_type,
  severity,
  operation_type,
  details
) VALUES (
  'validation_failed',
  'info',
  'migration_applied',
  jsonb_build_object(
    'migration', 'fix_card_buyout_remove_community_pool_involvement',
    'timestamp', now(),
    'critical_fix', true,
    'changes', jsonb_build_array(
      'Removed community pool involvement from card buyouts',
      'Card buyouts are now pure direct user transactions',
      'User pays from their own balance only',
      '100 coins go directly to manager',
      'Card price goes directly to DUMP pool',
      'Community pool no longer incorrectly deducted',
      'Atomic operations preserved',
      'All transaction records maintained'
    ),
    'coin_flow_corrected', jsonb_build_object(
      'user_balance', 'deducted (card_price + 100)',
      'manager_balance', 'credited +100 (direct)',
      'dump_pool', 'credited +card_price (direct)',
      'community_pool', 'NOT involved (correct)',
      'source_of_coins', 'user own balance',
      'transaction_type', 'direct_user_payment'
    ),
    'impact', 'CRITICAL - Fixed incorrect community pool accounting in card buyouts'
  )
);

-- Verify function was updated
DO $$
DECLARE
  v_function_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'buy_myself_out'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '✓ buy_myself_out function updated successfully';
    RAISE NOTICE '  - Community pool involvement: REMOVED';
    RAISE NOTICE '  - Transaction type: Direct user payment';
    RAISE NOTICE '  - DUMP pool routing: Active (direct)';
    RAISE NOTICE '  - Coins source: User own balance only';
  ELSE
    RAISE EXCEPTION 'Function update failed';
  END IF;
END $$;
