/*
  # Update Card Price Increment to 10 Coins with 5+5 Distribution
  
  1. Changes
    - Cards now increase by 10 coins per sale (was 5)
    - Add last_purchase_price field to track what current owner paid
    - New resale distribution: seller gets (purchase_price + 5), original owner gets 5
    
  2. First Sale Distribution
    - Buyer pays current price (starts at 20)
    - Seller receives 100% (they are the original owner)
    - Card price increases by 10 (becomes 30)
    - last_purchase_price set to what buyer paid (20)
    
  3. Resale Distribution (Every Sale After First)
    - Buyer pays current price (e.g., 30)
    - Current seller receives: last_purchase_price + 5 (e.g., 20 + 5 = 25)
    - Original owner receives: 5 coins as royalty
    - Total distributed: 25 + 5 = 30 (equals buyer payment)
    - Card price increases by 10 (becomes 40)
    - last_purchase_price updated to what buyer just paid (30)
    
  4. Example Flow
    - Card starts at 20 coins
    - Alice sells to Bob for 20: Alice gets 20, price → 30
    - Bob sells to Charlie for 30: Bob gets 25 (20+5 profit), Alice gets 5 (royalty), price → 40
    - Charlie sells to Diana for 40: Charlie gets 35 (30+5 profit), Alice gets 5 (royalty), price → 50
    - Pattern: Every seller makes 5 coin profit, Alice gets 5 coin royalty forever
    
  5. Schema Updates
    - Add last_purchase_price to card_ownership
    - Update execute_card_sale function with new math
    - Ensure atomic transactions with proper rollback
*/

-- Add last_purchase_price field to track what current owner paid
ALTER TABLE card_ownership
ADD COLUMN IF NOT EXISTS last_purchase_price numeric DEFAULT 20.00;

-- Update existing cards to set last_purchase_price
-- For cards never traded, set to initial value of 20
-- For traded cards, use last_sale_price if available, otherwise current_price - 10
UPDATE card_ownership
SET last_purchase_price = CASE
  WHEN times_traded = 0 THEN 20.00
  WHEN last_sale_price IS NOT NULL THEN last_sale_price
  ELSE GREATEST(20.00, current_price - 10.00)
END
WHERE last_purchase_price IS NULL;

-- Drop and recreate execute_card_sale with new 10 coin increment system
DROP FUNCTION IF EXISTS execute_card_sale(uuid, uuid, numeric);

CREATE OR REPLACE FUNCTION execute_card_sale(
  p_card_user_id uuid,
  p_buyer_id uuid,
  p_sale_price numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seller_id uuid;
  v_current_owner_id uuid;
  v_current_price numeric;
  v_last_purchase_price numeric;
  v_new_price numeric;
  v_buyer_balance numeric;
  v_card_ownership_id uuid;
  v_transaction_id uuid;
  v_times_traded integer;
  v_is_first_sale boolean;
  v_transaction_type text;
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
    COALESCE(last_purchase_price, 20.00) as purchase_price
  INTO 
    v_card_ownership_id, 
    v_current_owner_id, 
    v_current_price, 
    p_card_user_id, 
    v_times_traded,
    v_last_purchase_price
  FROM card_ownership
  WHERE card_user_id = p_card_user_id
    AND is_listed_for_sale = true
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found or not listed for sale';
  END IF;
  
  v_seller_id := v_current_owner_id;
  v_is_first_sale := (v_times_traded = 0);
  v_transaction_type := CASE WHEN v_is_first_sale THEN 'first_sale' ELSE 'resale' END;
  
  -- Prevent buying own card
  IF p_buyer_id = v_seller_id THEN
    RAISE EXCEPTION 'Cannot buy your own card';
  END IF;
  
  -- Validate sale price matches asking price
  IF p_sale_price < v_current_price THEN
    RAISE EXCEPTION 'Sale price must be at least current card value: %', v_current_price;
  END IF;
  
  -- Check buyer has enough coins
  SELECT balance INTO v_buyer_balance
  FROM coins
  WHERE user_id = p_buyer_id;
  
  IF v_buyer_balance IS NULL THEN
    v_buyer_balance := 0;
  END IF;
  
  IF v_buyer_balance < p_sale_price THEN
    RAISE EXCEPTION 'Insufficient coins. You have % coins but need %', v_buyer_balance, p_sale_price;
  END IF;
  
  -- Calculate payment split based on sale type
  IF v_is_first_sale THEN
    -- First sale: seller gets 100% (they are the original owner)
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
  
  -- STEP 1: Deduct full sale price from buyer
  UPDATE coins
  SET balance = balance - p_sale_price,
      updated_at = now()
  WHERE user_id = p_buyer_id;
  
  -- STEP 2: Add seller's portion to current seller
  INSERT INTO coins (user_id, balance)
  VALUES (v_seller_id, v_seller_payment)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    balance = coins.balance + v_seller_payment,
    updated_at = now();
  
  -- STEP 3: If resale, pay royalty to original owner from buyer's payment
  IF NOT v_is_first_sale AND v_seller_id != p_card_user_id THEN
    -- Add 5 coins to original owner
    INSERT INTO coins (user_id, balance)
    VALUES (p_card_user_id, v_royalty_payment)
    ON CONFLICT (user_id)
    DO UPDATE SET 
      balance = coins.balance + v_royalty_payment,
      updated_at = now();
    
    -- Record royalty transaction
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
    VALUES (
      p_card_user_id,
      v_royalty_payment,
      'card_royalty',
      'Royalty from card resale (5 coins from ' || p_sale_price || ' coin sale)'
    );
  END IF;
  
  -- STEP 4: Create coin transaction records
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    p_buyer_id,
    -p_sale_price,
    'card_purchase',
    'Purchased card for ' || p_sale_price || ' coins'
  );
  
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
  
  -- STEP 5: Calculate new card value (now +10 coins instead of +5)
  v_new_price := v_current_price + 10.00;
  
  -- STEP 6: Transfer ownership and update card value
  UPDATE card_ownership
  SET 
    owner_id = p_buyer_id,
    current_price = v_new_price,
    last_purchase_price = p_sale_price,  -- Store what buyer paid for future profit calculation
    times_traded = times_traded + 1,
    last_sale_price = p_sale_price,
    is_listed_for_sale = false,
    asking_price = null,
    acquired_at = now(),
    updated_at = now()
  WHERE id = v_card_ownership_id;
  
  -- STEP 7: Record sale transaction with detailed breakdown
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
  
  -- Return success result with detailed breakdown
  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_value', v_current_price,
    'new_value', v_new_price,
    'price_increase', 10.00,
    'sale_price', p_sale_price,
    'seller_payment', v_seller_payment,
    'seller_profit', v_seller_profit,
    'seller_purchase_price', v_last_purchase_price,
    'royalty_payment', v_royalty_payment,
    'seller_id', v_seller_id,
    'buyer_id', p_buyer_id,
    'original_owner_id', p_card_user_id,
    'is_first_sale', v_is_first_sale,
    'royalty_paid', NOT v_is_first_sale AND v_seller_id != p_card_user_id,
    'transaction_type', v_transaction_type
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Sale failed: %', SQLERRM;
END;
$$;

-- Update validation trigger to work with new pricing
CREATE OR REPLACE FUNCTION validate_asking_price()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_price numeric;
BEGIN
  -- Only validate when listing for sale
  IF NEW.is_listed_for_sale = true AND NEW.asking_price IS NOT NULL THEN
    v_current_price := NEW.current_price;
    
    -- Asking price must be at least the current card value
    IF NEW.asking_price < v_current_price THEN
      RAISE EXCEPTION 'Cannot list card below current value. Minimum price: % coins', v_current_price;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS trigger_validate_asking_price ON card_ownership;
CREATE TRIGGER trigger_validate_asking_price
  BEFORE UPDATE ON card_ownership
  FOR EACH ROW
  WHEN (NEW.is_listed_for_sale = true)
  EXECUTE FUNCTION validate_asking_price();

-- Add helper function to show profit potential for card owners
CREATE OR REPLACE FUNCTION get_card_profit_info(p_card_user_id uuid, p_owner_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_price numeric;
  v_last_purchase_price numeric;
  v_times_traded integer;
  v_is_original_owner boolean;
  v_potential_profit numeric;
  v_result json;
BEGIN
  SELECT 
    current_price,
    COALESCE(last_purchase_price, 20.00),
    times_traded,
    (card_user_id = p_owner_id)
  INTO
    v_current_price,
    v_last_purchase_price,
    v_times_traded,
    v_is_original_owner
  FROM card_ownership
  WHERE card_user_id = p_card_user_id
    AND owner_id = p_owner_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Card not found or you do not own it');
  END IF;
  
  -- Calculate potential profit if sold at current price
  IF v_is_original_owner AND v_times_traded = 0 THEN
    v_potential_profit := v_current_price;  -- First sale, gets full amount
  ELSE
    v_potential_profit := 5.00;  -- Resale, gets 5 coin profit
  END IF;
  
  v_result := json_build_object(
    'current_price', v_current_price,
    'your_purchase_price', v_last_purchase_price,
    'your_potential_earnings', v_last_purchase_price + v_potential_profit,
    'your_profit', v_potential_profit,
    'is_original_owner', v_is_original_owner,
    'times_traded', v_times_traded
  );
  
  RETURN v_result;
END;
$$;

-- Log the update
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CARD INCREMENT SYSTEM UPDATED';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'New System (10 Coin Increment):';
  RAISE NOTICE '  - Cards increase by 10 coins per sale';
  RAISE NOTICE '  - First sale: seller gets 100%% (they are original owner)';
  RAISE NOTICE '  - Resales: seller gets purchase_price + 5, original owner gets 5';
  RAISE NOTICE '  - Example: Buy for 20, sell for 30, earn 25 (20 back + 5 profit)';
  RAISE NOTICE '';
  RAISE NOTICE 'Every resale:';
  RAISE NOTICE '  - Current seller makes 5 coin profit';
  RAISE NOTICE '  - Original owner makes 5 coin royalty';
  RAISE NOTICE '  - Price increases by 10 coins';
  RAISE NOTICE '========================================';
END $$;
