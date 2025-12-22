/*
  # Card Value System with 5 Coin Increases Per Sale
  
  1. Problem
    - Cards need to increase by exactly 5 coins per sale (not percentage)
    - Need to track detailed sale history with value changes
    - Need to enforce minimum pricing (can't sell below current_price)
    - Need automatic value increases via triggers
    - Original card owner gets card value increase, seller gets 100% of sale price
  
  2. Solution
    - Enhance card_transactions to track value changes per sale
    - Create trigger to auto-increase current_price by +5 on sale
    - Add validation to prevent listing below current_price
    - Create function for complete sale transaction flow
    - Track previous_value and new_value for each sale
  
  3. Tables Updated
    - card_transactions: Add value tracking columns
    - card_ownership: Ensure current_price starts at 20 and increases by 5
  
  4. Triggers Created
    - increase_card_value_on_sale: Auto-increases card value by 5 coins
    - validate_asking_price_on_listing: Ensures asking_price >= current_price
  
  5. Functions Created
    - execute_card_sale: Complete transaction flow with coin transfers
  
  6. Business Logic
    - Card starts at 20 coins
    - Each sale: current_price = current_price + 5
    - Seller (owner_id) gets 100% of sale_price in coins
    - Original card owner (card_user_id) gets value increase in their card
    - Buyer becomes new owner_id
    - Card value continues increasing with each subsequent sale
*/

-- Add value tracking columns to card_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'card_transactions' AND column_name = 'card_value_at_sale'
  ) THEN
    ALTER TABLE card_transactions ADD COLUMN card_value_at_sale numeric(10,2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'card_transactions' AND column_name = 'previous_value'
  ) THEN
    ALTER TABLE card_transactions ADD COLUMN previous_value numeric(10,2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'card_transactions' AND column_name = 'new_value'
  ) THEN
    ALTER TABLE card_transactions ADD COLUMN new_value numeric(10,2);
  END IF;
END $$;

-- Ensure all existing cards have proper current_price (minimum 20)
UPDATE card_ownership 
SET current_price = GREATEST(current_price, 20.00),
    base_price = 20.00
WHERE current_price < 20.00 OR base_price < 20.00 OR current_price IS NULL;

-- Create function to automatically increase card value by 5 coins on sale
CREATE OR REPLACE FUNCTION increase_card_value_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_price numeric;
  v_new_price numeric;
BEGIN
  -- Only process actual sales (not other transaction types)
  IF NEW.transaction_type = 'sale' THEN
    -- Get current card value
    SELECT current_price INTO v_old_price
    FROM card_ownership
    WHERE card_user_id = NEW.card_user_id
    LIMIT 1;
    
    -- Calculate new value (old value + 5 coins)
    v_new_price := v_old_price + 5.00;
    
    -- Update card value and trade count
    UPDATE card_ownership
    SET 
      current_price = v_new_price,
      times_traded = times_traded + 1,
      last_sale_price = NEW.sale_price,
      updated_at = now()
    WHERE card_user_id = NEW.card_user_id;
    
    -- Update the transaction record with value tracking
    UPDATE card_transactions
    SET 
      card_value_at_sale = v_old_price,
      previous_value = v_old_price,
      new_value = v_new_price
    WHERE id = NEW.id;
    
    RAISE NOTICE 'Card value increased: % -> % (+5 coins) for user %', 
      v_old_price, v_new_price, NEW.card_user_id;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error increasing card value: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger for automatic value increase
DROP TRIGGER IF EXISTS trigger_increase_card_value_on_sale ON card_transactions;
CREATE TRIGGER trigger_increase_card_value_on_sale
  AFTER INSERT ON card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION increase_card_value_on_sale();

-- Create function to validate asking price is not below current value
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
    
    -- Ensure asking price is at least the current card value
    IF NEW.asking_price < v_current_price THEN
      RAISE EXCEPTION 'Cannot list card below current value. Minimum price: % coins', v_current_price;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for asking price validation
DROP TRIGGER IF EXISTS trigger_validate_asking_price ON card_ownership;
CREATE TRIGGER trigger_validate_asking_price
  BEFORE UPDATE ON card_ownership
  FOR EACH ROW
  WHEN (NEW.is_listed_for_sale = true)
  EXECUTE FUNCTION validate_asking_price();

-- Create comprehensive function for executing a card sale
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
  v_result json;
BEGIN
  -- Get current card ownership details
  SELECT id, owner_id, current_price, card_user_id
  INTO v_card_ownership_id, v_current_owner_id, v_current_price, p_card_user_id
  FROM card_ownership
  WHERE card_user_id = p_card_user_id
    AND is_listed_for_sale = true
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found or not listed for sale';
  END IF;
  
  v_seller_id := v_current_owner_id;
  
  -- Prevent buying own card
  IF v_buyer_id = v_seller_id THEN
    RAISE EXCEPTION 'Cannot buy your own card';
  END IF;
  
  -- Check buyer has enough coins
  SELECT balance INTO v_buyer_balance
  FROM coins
  WHERE user_id = p_buyer_id;
  
  IF v_buyer_balance < p_sale_price THEN
    RAISE EXCEPTION 'Insufficient coins. You have % coins but need %', v_buyer_balance, p_sale_price;
  END IF;
  
  -- Deduct coins from buyer
  UPDATE coins
  SET balance = balance - p_sale_price,
      updated_at = now()
  WHERE user_id = p_buyer_id;
  
  -- Add coins to seller (100% of sale price)
  INSERT INTO coins (user_id, balance)
  VALUES (v_seller_id, p_sale_price)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    balance = coins.balance + p_sale_price,
    updated_at = now();
  
  -- Create coin transaction records
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    p_buyer_id,
    -p_sale_price,
    'purchase',
    'Purchased card for ' || p_sale_price || ' coins'
  );
  
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    v_seller_id,
    p_sale_price,
    'purchase',
    'Sold card for ' || p_sale_price || ' coins'
  );
  
  -- Transfer ownership
  UPDATE card_ownership
  SET 
    owner_id = p_buyer_id,
    is_listed_for_sale = false,
    asking_price = null,
    acquired_at = now(),
    updated_at = now()
  WHERE id = v_card_ownership_id;
  
  -- Record sale transaction (trigger will increase card value)
  INSERT INTO card_transactions (
    card_user_id,
    seller_id,
    buyer_id,
    sale_price,
    transaction_type
  )
  VALUES (
    p_card_user_id,
    v_seller_id,
    p_buyer_id,
    p_sale_price,
    'sale'
  )
  RETURNING id INTO v_transaction_id;
  
  -- Get new card value (after trigger executes)
  SELECT current_price INTO v_new_price
  FROM card_ownership
  WHERE id = v_card_ownership_id;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_value', v_current_price,
    'new_value', v_new_price,
    'sale_price', p_sale_price,
    'seller_id', v_seller_id,
    'buyer_id', p_buyer_id
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Sale failed: %', SQLERRM;
END;
$$;

-- Initialize any cards that might have null or invalid values
UPDATE card_ownership
SET 
  current_price = 20.00,
  base_price = 20.00,
  times_traded = COALESCE(times_traded, 0)
WHERE current_price IS NULL OR current_price < 20.00;

-- Create index for faster card lookups by card_user_id
CREATE INDEX IF NOT EXISTS idx_card_ownership_card_user_id ON card_ownership(card_user_id);
CREATE INDEX IF NOT EXISTS idx_card_ownership_owner_id ON card_ownership(owner_id);
CREATE INDEX IF NOT EXISTS idx_card_ownership_listed ON card_ownership(is_listed_for_sale) WHERE is_listed_for_sale = true;

-- Log initialization
DO $$
DECLARE
  v_card_count integer;
BEGIN
  SELECT COUNT(*) INTO v_card_count FROM card_ownership;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CARD VALUE SYSTEM INITIALIZED';
  RAISE NOTICE 'Total cards: %', v_card_count;
  RAISE NOTICE 'All cards set to minimum 20 coins';
  RAISE NOTICE 'Value increases by 5 coins per sale';
  RAISE NOTICE '========================================';
END $$;
