/*
  # Prevent Original Owner Buying From Manager With Their Card

  1. Changes
    - Add validation to `execute_card_sale()` to prevent original owners from buying cards from managers who own their original cards
    - Create helper function `check_manager_owns_buyer_original_card()` to verify restriction
    - Update card sale validation logic

  2. Restriction Logic
    - When user (buyer) attempts to purchase a card
    - Check if seller (manager) owns any cards where original_owner_id = buyer_id
    - If YES: Block purchase with clear error message
    - If NO: Allow purchase to proceed

  3. Security
    - Server-side validation in database function
    - Clear error messages for blocked purchases
    - Audit trail maintained

  4. Notes
    - Prevents circular ownership issues
    - Maintains fairness in card trading system
    - Original owner cannot buy cards from managers holding their original cards
*/

-- Helper function to check if manager owns any of buyer's original cards
CREATE OR REPLACE FUNCTION check_manager_owns_buyer_original_card(
  p_manager_id uuid,
  p_buyer_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_count integer;
BEGIN
  -- Check if manager (seller) owns any cards originally created by buyer
  SELECT COUNT(*)
  INTO v_count
  FROM card_ownership
  WHERE owner_id = p_manager_id
  AND original_owner_id = p_buyer_id;

  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update execute_card_sale function to include restriction
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
  v_royalty_payment numeric;
  v_original_owner_id uuid;
  v_result json;
BEGIN
  -- Get current card ownership details
  SELECT 
    id, 
    owner_id, 
    current_price, 
    card_user_id, 
    times_traded,
    last_purchase_price,
    original_owner_id
  INTO 
    v_card_ownership_id, 
    v_current_owner_id, 
    v_current_price, 
    v_card_user_id, 
    v_times_traded,
    v_last_purchase_price,
    v_original_owner_id
  FROM card_ownership
  WHERE card_user_id = p_card_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  v_seller_id := v_current_owner_id;
  
  -- NEW RESTRICTION: Prevent original owner from buying from manager who owns their cards
  -- Check if buyer is an original owner AND seller owns any of buyer's original cards
  IF check_manager_owns_buyer_original_card(v_seller_id, p_buyer_id) THEN
    RAISE EXCEPTION 'RESTRICTION: You cannot purchase cards from managers who own your original cards. This manager currently owns one or more of your original cards.';
  END IF;
  
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

  -- Validate seller exists
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_seller_id
  ) THEN
    RAISE EXCEPTION 'Seller profile not found';
  END IF;

  -- Validate original owner exists
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_card_user_id
  ) THEN
    RAISE EXCEPTION 'Original card owner profile not found';
  END IF;

  -- Payment structure: Every sale splits the buyer's payment
  -- Seller gets (sale_price - 5), Original owner gets 5 royalty
  v_seller_payment := p_sale_price - 5.00;
  v_royalty_payment := 5.00;
  
  -- Safety check: ensure payments add up to sale price
  IF (v_seller_payment + v_royalty_payment) != p_sale_price THEN
    RAISE EXCEPTION 'Payment calculation error. Seller payment (%) + royalty (%) does not equal sale price (%)', 
      v_seller_payment, v_royalty_payment, p_sale_price;
  END IF;
  
  -- STEP 1: Deduct full sale price from buyer
  UPDATE coins
  SET balance = balance - p_sale_price,
      updated_at = now()
  WHERE user_id = p_buyer_id;
  
  -- STEP 2: Insert transaction records
  
  -- Record buyer's purchase
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    p_buyer_id,
    -p_sale_price,
    'card_purchase',
    'Purchased card for ' || p_sale_price || ' coins'
  );
  
  -- Record seller's payment
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    v_seller_id,
    v_seller_payment,
    'card_sale',
    'Sold card for ' || p_sale_price || ' coins (received ' || v_seller_payment || ', royalty: 5)'
  );
  
  -- Record royalty payment to original owner
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    v_card_user_id,
    v_royalty_payment,
    'card_royalty',
    'Card increase royalty (5 coins from ' || p_sale_price || ' coin sale)'
  );
  
  -- STEP 3: Calculate new card value (+10 coins)
  v_new_price := v_current_price + 10.00;
  
  -- STEP 4: Transfer ownership and update card value
  UPDATE card_ownership
  SET 
    owner_id = p_buyer_id,
    current_price = v_new_price,
    last_purchase_price = p_sale_price,
    times_traded = times_traded + 1,
    last_sale_price = p_sale_price,
    is_listed_for_sale = false,
    asking_price = NULL,
    updated_at = now()
  WHERE id = v_card_ownership_id;
  
  -- STEP 5: Record in card_transactions table
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
    p_sale_price,
    v_transaction_type,
    v_current_price,
    v_current_price,
    v_new_price
  )
  RETURNING id INTO v_transaction_id;
  
  -- Return success with details
  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_value', v_current_price,
    'new_value', v_new_price,
    'price_increase', 10.00,
    'sale_price', p_sale_price,
    'seller_payment', v_seller_payment,
    'seller_profit', CASE 
      WHEN v_is_first_sale THEN v_seller_payment
      ELSE (v_seller_payment - COALESCE(v_last_purchase_price, v_current_price))
    END,
    'seller_purchase_price', v_last_purchase_price,
    'royalty_payment', v_royalty_payment,
    'seller_id', v_seller_id,
    'buyer_id', p_buyer_id,
    'original_owner_id', v_card_user_id,
    'is_first_sale', v_is_first_sale,
    'royalty_paid', true,
    'transaction_type', v_transaction_type
  );
  
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;
