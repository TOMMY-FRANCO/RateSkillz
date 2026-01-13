/*
  # Lock Cards to Fixed Prices - Remove All Negotiation Features

  ## Critical Changes:
  1. Drop triggers and functions that validate asking_price
  2. Remove `asking_price` column from card_ownership
  3. Set all cards to `is_listed_for_sale = true` (always available at fixed price)
  4. Drop `card_offers` table entirely (no more offers/counter-offers)
  5. Remove all price negotiation functions
  6. Create simple fixed-price purchase function
  
  ## Fixed Price System:
  - Every card has a `current_price` which is the only price
  - Cards are ALWAYS for sale at their `current_price`
  - No price amendments, no offers, no counter-offers
  - When sold:
    - Buyer pays `current_price`
    - Seller receives (current_price - 5) for resales, or full price for first sale
    - Original owner receives 5 coins royalty on resales
    - Card value increases by 10 coins: current_price becomes (current_price + 10)
  
  ## Example Flow:
  - Card starts at 20 coins
  - First sale: Buyer pays 20 → Seller gets 20 → Card now worth 30
  - Second sale: Buyer pays 30 → Previous owner gets 25, Original owner gets 5 → Card now worth 40
  - Third sale: Buyer pays 40 → Previous owner gets 35, Original owner gets 5 → Card now worth 50
*/

-- STEP 1: Drop triggers that reference asking_price
DROP TRIGGER IF EXISTS trigger_validate_asking_price ON card_ownership;
DROP FUNCTION IF EXISTS validate_asking_price();

-- STEP 2: Drop card_offers table and all related functions
DROP TABLE IF EXISTS card_offers CASCADE;

-- STEP 3: Remove price negotiation functions
DROP FUNCTION IF EXISTS create_card_offer(uuid, uuid, numeric, text, text);
DROP FUNCTION IF EXISTS accept_card_offer(uuid);
DROP FUNCTION IF EXISTS deny_card_offer(uuid);
DROP FUNCTION IF EXISTS list_card_for_sale(uuid, uuid, numeric);
DROP FUNCTION IF EXISTS unlist_card_from_sale(uuid, uuid);
DROP FUNCTION IF EXISTS execute_card_sale(uuid, uuid, numeric);

-- STEP 4: Remove asking_price column
ALTER TABLE card_ownership DROP COLUMN IF EXISTS asking_price;

-- STEP 5: Set all cards to always be listed at their current_price
UPDATE card_ownership
SET is_listed_for_sale = true,
    updated_at = now();

-- STEP 6: Add constraint to ensure cards are always listed
ALTER TABLE card_ownership
ALTER COLUMN is_listed_for_sale SET DEFAULT true;

-- STEP 7: Create simplified fixed-price purchase function
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
  
  -- STEP 1: Deduct from buyer
  UPDATE profiles
  SET coin_balance = coin_balance - v_current_price
  WHERE id = p_buyer_id;
  
  -- STEP 2: Pay current seller
  UPDATE profiles
  SET coin_balance = coin_balance + v_seller_payment
  WHERE id = v_seller_id;
  
  -- STEP 3: Pay royalty to original owner (if resale and different from seller)
  IF NOT v_is_first_sale AND v_seller_id != v_original_owner_id THEN
    UPDATE profiles
    SET coin_balance = coin_balance + v_royalty_payment
    WHERE id = v_original_owner_id;
    
    -- Record royalty transaction
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
    VALUES (
      v_original_owner_id,
      v_royalty_payment,
      'card_royalty',
      'Royalty from card resale',
      p_card_user_id::text
    );
  END IF;
  
  -- STEP 4: Record buyer transaction
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    p_buyer_id,
    -v_current_price,
    'card_purchase',
    'Purchased card at fixed price of ' || v_current_price || ' coins',
    p_card_user_id::text
  );
  
  -- STEP 5: Record seller transaction
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    v_seller_id,
    v_seller_payment,
    'card_sale',
    'Sold card at fixed price (received ' || v_seller_payment || ' of ' || v_current_price || ')',
    p_card_user_id::text
  );
  
  -- STEP 6: Transfer ownership and update card value
  UPDATE card_ownership
  SET 
    owner_id = p_buyer_id,
    current_price = v_new_price,
    times_traded = times_traded + 1,
    last_purchase_price = v_current_price,
    acquired_at = now(),
    updated_at = now()
  WHERE card_user_id = p_card_user_id;
  
  -- STEP 7: Record sale transaction in card_transactions
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

-- STEP 8: Create function to check if user can purchase a card
CREATE OR REPLACE FUNCTION can_purchase_card(
  p_card_user_id uuid,
  p_buyer_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_original_owner_id uuid;
  v_current_price numeric;
  v_buyer_balance numeric;
  v_times_traded integer;
  v_can_purchase boolean := true;
  v_reason text := '';
BEGIN
  -- Get card details
  SELECT owner_id, current_price, times_traded, original_owner_id
  INTO v_owner_id, v_current_price, v_times_traded, v_original_owner_id
  FROM card_ownership
  WHERE card_user_id = p_card_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'can_purchase', false,
      'reason', 'Card not found'
    );
  END IF;
  
  -- Check if buyer is current owner
  IF p_buyer_id = v_owner_id THEN
    v_can_purchase := false;
    v_reason := 'You already own this card';
  END IF;
  
  -- Check if original owner trying to buy back from manager
  IF p_buyer_id = v_original_owner_id AND v_times_traded > 0 THEN
    v_can_purchase := false;
    v_reason := 'You cannot buy your own card back from a manager';
  END IF;
  
  -- Check buyer balance
  IF v_can_purchase THEN
    SELECT coin_balance INTO v_buyer_balance
    FROM profiles
    WHERE id = p_buyer_id;
    
    IF v_buyer_balance IS NULL OR v_buyer_balance < v_current_price THEN
      v_can_purchase := false;
      v_reason := 'Insufficient coins. You have ' || COALESCE(v_buyer_balance, 0) || ' but need ' || v_current_price;
    END IF;
  END IF;
  
  RETURN json_build_object(
    'can_purchase', v_can_purchase,
    'reason', v_reason,
    'current_price', v_current_price,
    'buyer_balance', COALESCE(v_buyer_balance, 0)
  );
END;
$$;

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXED PRICE SYSTEM IMPLEMENTED';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'All price negotiation removed:';
  RAISE NOTICE '  - card_offers table dropped';
  RAISE NOTICE '  - asking_price column removed';
  RAISE NOTICE '  - All cards locked to fixed current_price';
  RAISE NOTICE '  - Cards always available at current_price';
  RAISE NOTICE '';
  RAISE NOTICE 'Purchase Flow:';
  RAISE NOTICE '  - Buyer pays current_price';
  RAISE NOTICE '  - Seller receives (current_price - 5) on resales';
  RAISE NOTICE '  - Original owner receives 5 coins royalty on resales';
  RAISE NOTICE '  - Card value increases to (current_price + 10)';
  RAISE NOTICE '';
  RAISE NOTICE 'Example: 20 → 30 → 40 → 50 → 60...';
  RAISE NOTICE '========================================';
END $$;
