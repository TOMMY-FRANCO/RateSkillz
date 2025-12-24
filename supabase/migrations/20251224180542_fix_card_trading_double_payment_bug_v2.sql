/*
  # Fix Card Trading Double Payment Bug

  ## Problem
  Card sales causing double payments due to duplicate balance updates:
  1. `execute_card_sale` manually updates coins table for seller and royalties
  2. `update_coin_balance_on_transaction` trigger also updates coins table when transaction is inserted
  
  Result: Seller and original owner (royalty) get coins added twice

  ## Solution
  Remove manual balance updates from `execute_card_sale` function.
  Let the trigger `update_coin_balance_on_transaction` handle all balance updates automatically.

  ## Changes Made
  1. Remove manual balance updates for seller payment
  2. Remove manual balance update for royalty payment
  3. Keep transaction inserts which will trigger automatic balance updates
  4. Keep buyer balance deduction (negative transaction will reduce balance)

  ## Transaction Flow After Fix
  Card Sale (e.g., 30 coins):
  - Deduct 30 from buyer manually (before transactions to ensure funds available)
  - Insert buyer transaction (-30) - no trigger effect since already deducted
  - Insert seller transaction (+25) - trigger adds to seller balance
  - Insert royalty transaction (+5) - trigger adds to original owner balance
  - Result: Each party gets exact amounts, once
*/

-- Drop and recreate function to fix double payment bug
DROP FUNCTION IF EXISTS execute_card_sale(uuid, uuid, numeric);

CREATE FUNCTION execute_card_sale(
  p_buyer_id uuid,
  p_card_user_id uuid,
  p_sale_price numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card_ownership_id uuid;
  v_current_owner_id uuid;
  v_current_price numeric;
  v_seller_id uuid;
  v_card_user_id uuid;
  v_last_purchase_price numeric;
  v_new_price numeric;
  v_is_first_sale boolean;
  v_times_traded integer;
  v_transaction_type text;
  v_transaction_id uuid;
  v_seller_payment numeric;
  v_seller_profit numeric;
  v_royalty_payment numeric;
  v_result json;
BEGIN
  -- Get current card ownership details
  SELECT 
    id, 
    owner_id, 
    current_price, 
    card_user_id, 
    times_traded,
    last_purchase_price
  INTO 
    v_card_ownership_id, 
    v_current_owner_id, 
    v_current_price, 
    v_card_user_id, 
    v_times_traded,
    v_last_purchase_price
  FROM card_ownership
  WHERE card_user_id = p_card_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  v_seller_id := v_current_owner_id;
  
  -- Determine if this is first sale (owner selling their own card)
  v_is_first_sale := (v_seller_id = v_card_user_id);
  
  IF v_is_first_sale THEN
    v_transaction_type := 'first_sale';
  ELSE
    v_transaction_type := 'resale';
  END IF;

  -- Verify sale price matches current price
  IF p_sale_price != v_current_price THEN
    RAISE EXCEPTION 'Sale price (%) does not match current card price (%)', p_sale_price, v_current_price;
  END IF;

  -- Check buyer has enough coins
  IF NOT EXISTS (
    SELECT 1 FROM coins 
    WHERE user_id = p_buyer_id 
    AND balance >= p_sale_price
  ) THEN
    RAISE EXCEPTION 'Buyer has insufficient funds';
  END IF;

  -- Calculate payment distribution
  IF v_is_first_sale THEN
    -- First sale: seller gets 100% of sale price
    v_seller_payment := p_sale_price;
    v_seller_profit := p_sale_price;
    v_royalty_payment := 0;
  ELSE
    -- Resale: seller gets (their purchase price + 5), original owner gets 5
    v_seller_payment := v_last_purchase_price + 5.00;
    v_seller_profit := 5.00;
    v_royalty_payment := 5.00;
    
    -- Safety check: ensure payments add up to sale price
    IF (v_seller_payment + v_royalty_payment) != p_sale_price THEN
      RAISE EXCEPTION 'Payment calculation error. Seller payment (%) + royalty (%) does not equal sale price (%)', 
        v_seller_payment, v_royalty_payment, p_sale_price;
    END IF;
  END IF;
  
  -- STEP 1: Deduct full sale price from buyer (do this first to ensure funds)
  UPDATE coins
  SET balance = balance - p_sale_price,
      updated_at = now()
  WHERE user_id = p_buyer_id;
  
  -- STEP 2: REMOVED - Manual balance updates (let trigger handle it)
  -- The trigger will automatically update balances when we insert transactions below
  
  -- STEP 3: Insert transaction records (these will trigger automatic balance updates)
  
  -- Record buyer's purchase (negative amount, but already deducted above)
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    p_buyer_id,
    -p_sale_price,
    'card_purchase',
    'Purchased card for ' || p_sale_price || ' coins'
  );
  
  -- Record seller's payment (trigger will add to balance)
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    v_seller_id,
    v_seller_payment,
    'card_sale',
    CASE 
      WHEN v_is_first_sale THEN 'Sold card for ' || v_seller_payment || ' coins (first sale)'
      ELSE 'Sold card (received ' || v_seller_payment || ' = ' || v_last_purchase_price || ' investment + 5 profit)'
    END
  );
  
  -- If resale, record royalty payment (trigger will add to balance)
  IF NOT v_is_first_sale AND v_seller_id != v_card_user_id THEN
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
    VALUES (
      v_card_user_id,
      v_royalty_payment,
      'card_royalty',
      'Royalty from card resale (5 coins from ' || p_sale_price || ' coin sale)'
    );
  END IF;
  
  -- STEP 4: Calculate new card value (+10 coins)
  v_new_price := v_current_price + 10.00;
  
  -- STEP 5: Transfer ownership and update card value
  UPDATE card_ownership
  SET 
    owner_id = p_buyer_id,
    current_price = v_new_price,
    last_purchase_price = p_sale_price,
    times_traded = times_traded + 1,
    last_sale_price = p_sale_price,
    is_listed_for_sale = false,
    asking_price = null,
    acquired_at = now(),
    updated_at = now()
  WHERE id = v_card_ownership_id;
  
  -- STEP 6: Record sale in card_transactions table
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
    v_card_user_id,
    v_seller_id,
    p_buyer_id,
    p_sale_price,
    v_transaction_type,
    v_current_price,
    v_current_price,
    v_new_price
  )
  RETURNING id INTO v_transaction_id;
  
  -- Return success result with detailed breakdown
  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_value', v_current_price,
    'new_value', v_new_price,
    'sale_price', p_sale_price,
    'seller_payment', v_seller_payment,
    'seller_profit', v_seller_profit,
    'royalty_payment', v_royalty_payment,
    'seller_id', v_seller_id,
    'buyer_id', p_buyer_id,
    'is_first_sale', v_is_first_sale,
    'royalty_paid', NOT v_is_first_sale AND v_seller_id != v_card_user_id,
    'transaction_type', v_transaction_type
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Card sale failed: %', SQLERRM;
END;
$$;

-- Add comment explaining the fix
COMMENT ON FUNCTION execute_card_sale IS 
'Executes card sale with automatic balance updates via triggers. 
Buyer payment deducted manually first, then transactions inserted to trigger balance additions for seller and royalties.
This prevents double-payment bugs.';
