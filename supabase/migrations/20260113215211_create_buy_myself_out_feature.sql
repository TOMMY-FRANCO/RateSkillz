/*
  # Create Buy Myself Out Feature

  ## Overview
  This migration adds a feature allowing original card owners to buy back their own card
  from whoever currently owns it.

  ## How It Works
  1. Original card owner can buy back their card at any time
  2. They pay: current_price + 100 coins
  3. Current holder receives: 100 coins
  4. The current_price amount is removed from circulation (burned)
  5. Card ownership transfers back to original owner
  6. Card price remains the same (doesn't increase like in normal sales)
  7. times_traded counter increases by 1

  ## Example
  - Card is worth 50 coins
  - Manager owns it
  - Original owner wants it back
  - Original owner pays: 50 + 100 = 150 coins total
  - Manager receives: 100 coins
  - Card goes back to original owner at 50 coins value (unchanged)

  ## Security
  - Only the original card owner can use this function
  - Cannot buyout if you already own the card
  - Must have sufficient balance
*/

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
  v_result json;
BEGIN
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

  -- STEP 1: Deduct total cost from original owner
  UPDATE profiles
  SET coin_balance = coin_balance - v_total_cost
  WHERE id = p_original_owner_id;

  -- STEP 2: Pay 100 coins to current holder
  UPDATE profiles
  SET coin_balance = coin_balance + v_payment_to_holder
  WHERE id = v_current_holder_id;

  -- STEP 3: Record payment to holder transaction
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    v_current_holder_id,
    v_payment_to_holder,
    'card_buyout_payment',
    'Received 100 coins from card buyout',
    p_card_user_id::text
  );

  -- STEP 4: Record buyout cost transaction for original owner
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    p_original_owner_id,
    -v_total_cost,
    'card_buyout',
    'Bought back own card (' || v_current_price || ' coins burned + ' || v_payment_to_holder || ' coins to holder)',
    p_card_user_id::text
  );

  -- STEP 5: Transfer ownership back to original owner
  UPDATE card_ownership
  SET
    owner_id = p_original_owner_id,
    times_traded = times_traded + 1,
    last_purchase_price = v_total_cost,
    acquired_at = now(),
    updated_at = now()
  WHERE card_user_id = p_card_user_id;

  -- STEP 6: Record buyout transaction in card_transactions
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

  -- Return success result
  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'card_price', v_current_price,
    'payment_to_holder', v_payment_to_holder,
    'total_cost', v_total_cost,
    'coins_burned', v_current_price
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Buyout failed: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION buy_myself_out TO authenticated;
