/*
  # Fix Card Value System - Remove Percentages and Add Royalty Payments
  
  1. Problem
    - Cards incorrectly increasing by percentages (20% markup bug)
    - Need to implement royalty system: original owner gets 5 coins on resales
    - Cards must ONLY increase by exactly 5 coins per sale (no percentages)
  
  2. Solution
    - Fix execute_card_sale to handle first sale vs resale differently
    - First sale: buyer → seller (100%), value +5
    - Resale: buyer → seller (100%), coin_pool → original_owner (5 coins), value +5
    - Track transaction types: 'first_sale' vs 'resale'
    - Deduct royalty from coin pool
  
  3. Business Logic
    - Card starts at 20 coins
    - First sale: seller gets 100% of sale price, card value increases to 25
    - Subsequent sales: 
      * Seller gets 100% of sale price
      * Original card owner (card_user_id) gets 5 coins from coin pool
      * Card value increases by 5
    - No percentage-based increases anywhere
  
  4. Schema Updates
    - Ensure coin_pool tracks distributions properly
    - Add royalty tracking to coin_transactions
  
  5. Validation
    - Cards can only be sold for current_price or higher
    - No minimum markup calculations
    - Pure fixed increment of 5 coins
*/

-- Drop old function and recreate with royalty system
DROP FUNCTION IF EXISTS execute_card_sale(uuid, uuid, numeric);

-- Create comprehensive card sale function with royalty system
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
  v_new_price numeric;
  v_buyer_balance numeric;
  v_card_ownership_id uuid;
  v_transaction_id uuid;
  v_times_traded integer;
  v_is_first_sale boolean;
  v_pool_balance numeric;
  v_transaction_type text;
  v_result json;
BEGIN
  -- Get current card ownership details
  SELECT id, owner_id, current_price, card_user_id, times_traded
  INTO v_card_ownership_id, v_current_owner_id, v_current_price, p_card_user_id, v_times_traded
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
  
  -- For resales, check coin pool has enough for royalty payment
  IF NOT v_is_first_sale THEN
    SELECT total_coins INTO v_pool_balance
    FROM coin_pool
    WHERE id = '00000000-0000-0000-0000-000000000001'
    FOR UPDATE;
    
    IF v_pool_balance IS NULL THEN
      v_pool_balance := 1000000000;
    END IF;
    
    IF v_pool_balance < 5 THEN
      RAISE NOTICE 'Warning: Coin pool is running low (% coins remaining)', v_pool_balance;
    END IF;
  END IF;
  
  -- STEP 1: Deduct coins from buyer
  UPDATE coins
  SET balance = balance - p_sale_price,
      updated_at = now()
  WHERE user_id = p_buyer_id;
  
  -- STEP 2: Add sale price (100%) to seller
  INSERT INTO coins (user_id, balance)
  VALUES (v_seller_id, p_sale_price)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    balance = coins.balance + p_sale_price,
    updated_at = now();
  
  -- STEP 3: If resale, pay 5 coin royalty to original owner from coin pool
  IF NOT v_is_first_sale AND v_seller_id != p_card_user_id THEN
    -- Add 5 coins to original owner
    INSERT INTO coins (user_id, balance)
    VALUES (p_card_user_id, 5)
    ON CONFLICT (user_id)
    DO UPDATE SET 
      balance = coins.balance + 5,
      updated_at = now();
    
    -- Deduct from coin pool
    UPDATE coin_pool
    SET distributed_coins = distributed_coins + 5,
        updated_at = now()
    WHERE id = '00000000-0000-0000-0000-000000000001';
    
    -- Record royalty transaction
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
    VALUES (
      p_card_user_id,
      5,
      'card_royalty',
      'Royalty from card resale (+5 coins)'
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
    p_sale_price,
    'card_sale',
    'Sold card for ' || p_sale_price || ' coins'
  );
  
  -- STEP 5: Calculate new card value (always +5 coins, no percentages)
  v_new_price := v_current_price + 5.00;
  
  -- STEP 6: Transfer ownership and update card value
  UPDATE card_ownership
  SET 
    owner_id = p_buyer_id,
    current_price = v_new_price,
    times_traded = times_traded + 1,
    last_sale_price = p_sale_price,
    is_listed_for_sale = false,
    asking_price = null,
    acquired_at = now(),
    updated_at = now()
  WHERE id = v_card_ownership_id;
  
  -- STEP 7: Record sale transaction
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
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_value', v_current_price,
    'new_value', v_new_price,
    'sale_price', p_sale_price,
    'seller_id', v_seller_id,
    'buyer_id', p_buyer_id,
    'is_first_sale', v_is_first_sale,
    'royalty_paid', NOT v_is_first_sale AND v_seller_id != p_card_user_id,
    'transaction_type', v_transaction_type
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Sale failed: %', SQLERRM;
END;
$$;

-- Remove the old trigger that was increasing card value (we do it manually now)
DROP TRIGGER IF EXISTS trigger_increase_card_value_on_sale ON card_transactions;
DROP FUNCTION IF EXISTS increase_card_value_on_sale();

-- Update validation trigger to prevent listing below current_price (no percentages)
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
    
    -- Asking price must be at least the current card value (no markup required)
    IF NEW.asking_price < v_current_price THEN
      RAISE EXCEPTION 'Cannot list card below current value. Minimum price: % coins (current card value)', v_current_price;
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

-- Add helper function to get card sale history with royalties
CREATE OR REPLACE FUNCTION get_card_sale_history(p_card_user_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE (
  transaction_id uuid,
  sale_price numeric,
  previous_value numeric,
  new_value numeric,
  transaction_type text,
  seller_username text,
  buyer_username text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.id as transaction_id,
    ct.sale_price,
    ct.previous_value,
    ct.new_value,
    ct.transaction_type,
    seller.username as seller_username,
    buyer.username as buyer_username,
    ct.created_at
  FROM card_transactions ct
  LEFT JOIN profiles seller ON ct.seller_id = seller.id
  LEFT JOIN profiles buyer ON ct.buyer_id = buyer.id
  WHERE ct.card_user_id = p_card_user_id
  ORDER BY ct.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Log the fix
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CARD VALUE SYSTEM FIXED';
  RAISE NOTICE 'Removed all percentage-based increases';
  RAISE NOTICE 'Cards now increase by exactly 5 coins per sale';
  RAISE NOTICE 'Royalty system implemented:';
  RAISE NOTICE '  - First sale: seller gets 100%%';
  RAISE NOTICE '  - Resale: seller gets 100%%, original owner gets 5 coins';
  RAISE NOTICE '========================================';
END $$;
