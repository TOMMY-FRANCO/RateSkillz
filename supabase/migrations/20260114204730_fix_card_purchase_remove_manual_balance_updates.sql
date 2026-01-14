/*
  # Fix Card Purchase - Remove Manual Balance Updates

  ## Critical Problem
  The purchase_card_at_fixed_price function has a severe double-crediting bug:
  1. It manually updates profiles.coin_balance for seller and royalty payments
  2. Then inserts positive transactions for those same payments
  3. The trigger sees positive amounts and adds them AGAIN to balances
  4. Result: Sellers and original owners get DOUBLE coins from every sale!

  Example:
  - Card sells for 30 coins (seller gets 25, original owner gets 5 royalty)
  - Seller manually gets +25 coins (line 138-141)
  - Seller transaction inserted with amount=25 (line 171-178)
  - Trigger fires and adds ANOTHER +25 coins to seller
  - Seller actually received 50 coins instead of 25!
  - Same happens with original owner royalty

  ## Solution
  Remove ALL manual balance updates from purchase_card_at_fixed_price.
  Let the trigger handle all balance updates automatically via transactions.
  
  Flow:
  1. Manually deduct from buyer (negative amount, trigger ignores)
  2. Insert negative buyer transaction (trigger ignores)
  3. Insert positive seller transaction (trigger updates balance)
  4. Insert positive royalty transaction (trigger updates balance)

  ## Result
  - Single atomic transaction per payment
  - No duplicate coin crediting
  - Sellers get correct amount
  - Original owners get correct royalty
  - Balance matches transaction sum exactly
*/

-- Fix card purchase function - remove manual balance increases for seller/royalty
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
  -- Get current card ownership details
  SELECT owner_id, current_price, times_traded, original_owner_id
  INTO v_seller_id, v_current_price, v_times_traded, v_original_owner_id
  FROM card_ownership
  WHERE card_user_id = p_card_user_id
  FOR UPDATE;
  
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
    RAISE EXCEPTION 'Cannot buy your own card';
  END IF;
  
  -- Prevent original owner from buying their card back from a manager
  IF p_buyer_id = v_original_owner_id AND NOT v_is_first_sale THEN
    RAISE EXCEPTION 'You cannot buy your own card back from a manager';
  END IF;
  
  -- Check buyer has enough coins
  SELECT coin_balance INTO v_buyer_balance
  FROM profiles
  WHERE id = p_buyer_id;
  
  IF v_buyer_balance IS NULL OR v_buyer_balance < v_current_price THEN
    RAISE EXCEPTION 'Insufficient coins. You have % but need %', COALESCE(v_buyer_balance, 0), v_current_price;
  END IF;
  
  -- Calculate payment split
  IF v_is_first_sale THEN
    -- First sale: seller gets 100% of current_price
    v_seller_payment := v_current_price;
    v_royalty_payment := 0;
  ELSE
    -- Resale: seller gets (current_price - 5), original owner gets 5
    v_seller_payment := v_current_price - 5.00;
    v_royalty_payment := 5.00;
  END IF;
  
  -- Calculate new price (always +10 coins)
  v_new_price := v_current_price + 10.00;
  
  -- STEP 1: Manually deduct from buyer (negative transaction, trigger will ignore)
  UPDATE profiles
  SET coin_balance = coin_balance - v_current_price
  WHERE id = p_buyer_id;
  
  -- STEP 2: Record buyer transaction (negative amount, trigger ignores)
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    p_buyer_id,
    -v_current_price,
    'card_purchase',
    'Purchased card at fixed price of ' || v_current_price || ' coins',
    p_card_user_id::text
  );
  
  -- STEP 3: Record seller transaction (positive amount, trigger updates balance)
  -- DO NOT manually update seller balance - let trigger handle it
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    v_seller_id,
    v_seller_payment,
    'card_sale',
    'Sold card at fixed price (received ' || v_seller_payment || ' of ' || v_current_price || ')',
    p_card_user_id::text
  );
  
  -- STEP 4: Record royalty transaction if applicable (positive amount, trigger updates balance)
  -- DO NOT manually update original owner balance - let trigger handle it
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
  
  -- STEP 5: Transfer ownership and update card value
  UPDATE card_ownership
  SET 
    owner_id = p_buyer_id,
    current_price = v_new_price,
    times_traded = times_traded + 1,
    last_purchase_price = v_current_price,
    acquired_at = now(),
    updated_at = now()
  WHERE card_user_id = p_card_user_id;
  
  -- STEP 6: Record sale transaction in card_transactions
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
  
  -- Return success result
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
  RAISE EXCEPTION 'Purchase failed: %', SQLERRM;
END;
$$;
