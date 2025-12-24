/*
  # Implement First Sale Royalties

  ## Summary
  Updates card sale system so original card owners receive 5 coin royalty on EVERY sale, including first sales.

  ## Current Behavior
  - First sale: Seller gets 100% of sale price (e.g., 20 coins), no royalty
  - Resale: Seller gets (purchase_price + 5), original owner gets 5 royalty
  
  ## New Behavior
  - EVERY sale: Seller gets (sale_price - 5), original owner gets 5 royalty
  - The 10 coin card increase is effectively split: 5 to seller, 5 to original owner
  - On first sale where seller = original owner, they receive both payments (total = sale_price)

  ## Examples
  Card starts at 20 coins, Alice is original owner
  
  **First Sale:**
  - Bob buys from Alice for 20 coins
  - Alice gets 15 coins (as seller) + 5 coins (as original owner) = 20 total
  - Card increases to 30 coins
  
  **Second Sale:**
  - Charlie buys from Bob for 30 coins
  - Bob gets 25 coins (as seller)
  - Alice gets 5 coins (as original owner royalty)
  - Card increases to 40 coins
  
  **Third Sale:**
  - Diana buys from Charlie for 40 coins
  - Charlie gets 35 coins (as seller)
  - Alice gets 5 coins (as original owner royalty)
  - Card increases to 50 coins

  ## Changes Made
  1. Updated payment calculation logic for all sales (not just resales)
  2. Seller always gets (sale_price - 5)
  3. Original owner always gets 5 coins royalty
  4. Royalty transaction inserted on every sale, including first sale
  5. Added validation that seller and original owner exist
  6. Enhanced transaction descriptions for clarity

  ## Database Impact
  - No schema changes required
  - Only function logic updated
  - All existing transactions remain valid
  - Future sales will use new royalty structure
*/

-- Drop and recreate function with first-sale royalty support
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

  -- NEW PAYMENT STRUCTURE: Every sale splits the buyer's payment
  -- Seller gets (sale_price - 5), Original owner gets 5 royalty
  -- This effectively distributes the 10 coin increase: 5 to seller, 5 to original owner
  v_seller_payment := p_sale_price - 5.00;
  v_royalty_payment := 5.00;
  
  -- Safety check: ensure payments add up to sale price
  IF (v_seller_payment + v_royalty_payment) != p_sale_price THEN
    RAISE EXCEPTION 'Payment calculation error. Seller payment (%) + royalty (%) does not equal sale price (%)', 
      v_seller_payment, v_royalty_payment, p_sale_price;
  END IF;
  
  -- STEP 1: Deduct full sale price from buyer (do this first to ensure funds)
  UPDATE coins
  SET balance = balance - p_sale_price,
      updated_at = now()
  WHERE user_id = p_buyer_id;
  
  -- STEP 2: Insert transaction records (trigger will automatically update balances)
  
  -- Record buyer's purchase (negative amount, already deducted above)
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
    'Sold card for ' || p_sale_price || ' coins (received ' || v_seller_payment || ', royalty: 5)'
  );
  
  -- ALWAYS record royalty payment to original owner (even on first sale)
  -- On first sale, seller = original owner, so they get both payments
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
    asking_price = null,
    acquired_at = now(),
    updated_at = now()
  WHERE id = v_card_ownership_id;
  
  -- STEP 5: Record sale in card_transactions table
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
    'royalty_payment', v_royalty_payment,
    'seller_id', v_seller_id,
    'buyer_id', p_buyer_id,
    'original_owner_id', v_card_user_id,
    'is_first_sale', v_is_first_sale,
    'distribution', 'Card Increase Distributed - Seller: ' || v_seller_payment || ' coins, Original Owner Royalty: ' || v_royalty_payment || ' coins',
    'transaction_type', v_transaction_type
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Card sale failed: %', SQLERRM;
END;
$$;

-- Add comment explaining the new royalty structure
COMMENT ON FUNCTION execute_card_sale IS 
'Executes card sale with first-sale royalties. 
Every sale distributes: (sale_price - 5) to seller, 5 coins royalty to original owner.
The 10 coin card increase is split between seller and original owner.
On first sale, seller = original owner, so they receive both payments.';

-- Verification
DO $$
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'FIRST SALE ROYALTY SYSTEM IMPLEMENTED';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Payment Structure (Every Sale):';
  RAISE NOTICE '  - Seller: (sale_price - 5) coins';
  RAISE NOTICE '  - Original Owner: 5 coins royalty';
  RAISE NOTICE '  - Card Price: +10 coins';
  RAISE NOTICE '';
  RAISE NOTICE 'Example: Card at 20 coins';
  RAISE NOTICE '  First Sale: Alice → Bob for 20';
  RAISE NOTICE '    Alice gets: 15 (seller) + 5 (royalty) = 20';
  RAISE NOTICE '    Card → 30 coins';
  RAISE NOTICE '';
  RAISE NOTICE '  Second Sale: Bob → Charlie for 30';
  RAISE NOTICE '    Bob gets: 25 (seller)';
  RAISE NOTICE '    Alice gets: 5 (royalty)';
  RAISE NOTICE '    Card → 40 coins';
  RAISE NOTICE '=================================================';
END $$;
