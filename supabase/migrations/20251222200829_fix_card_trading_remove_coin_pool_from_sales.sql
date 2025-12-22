/*
  # Fix Card Trading - Remove Coin Pool from User-to-User Transactions
  
  1. Critical Problem
    - Card purchases incorrectly deduct royalty from coin pool
    - This is completely wrong - coin pool should ONLY distribute for ads/comments/purchases
    - Card trading is purely user-to-user coin circulation
  
  2. Correct Behavior
    **First Sale:**
    - Buyer pays current_price from their balance
    - Seller receives 100% of that payment (current_price)
    - Card value increases by 5 coins
    - Coin pool NOT involved
    
    **Resale:**
    - Buyer pays current_price from their balance
    - Current seller receives (current_price - 5) coins
    - Original owner receives 5 coins as royalty
    - Both payments come from buyer's single payment
    - Card value increases by 5 coins
    - Coin pool NOT involved
  
  3. Coin Pool Usage (ONLY)
    - Watching ads: 10 coins distributed from pool
    - Commenting on profiles: 0.1 coins distributed from pool (once per profile)
    - Stripe purchases: X coins distributed from pool
    - Once distributed, coins circulate between users forever
  
  4. User Economy
    - Coins move from buyer → seller(s) in card trades
    - Coins stay in user economy indefinitely
    - Pool only tracks initial distribution, not circulation
*/

-- Drop and recreate execute_card_sale with correct user-to-user logic
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
  v_new_price numeric;
  v_buyer_balance numeric;
  v_card_ownership_id uuid;
  v_transaction_id uuid;
  v_times_traded integer;
  v_is_first_sale boolean;
  v_transaction_type text;
  v_seller_payment numeric;
  v_royalty_payment numeric;
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
  
  -- Check buyer has enough coins (ONLY check buyer balance, NOT coin pool)
  SELECT balance INTO v_buyer_balance
  FROM coins
  WHERE user_id = p_buyer_id;
  
  IF v_buyer_balance IS NULL THEN
    v_buyer_balance := 0;
  END IF;
  
  IF v_buyer_balance < p_sale_price THEN
    RAISE EXCEPTION 'Insufficient coins. You have % coins but need %', v_buyer_balance, p_sale_price;
  END IF;
  
  -- Calculate payment split
  IF v_is_first_sale THEN
    -- First sale: seller gets 100% of sale price
    v_seller_payment := p_sale_price;
    v_royalty_payment := 0;
  ELSE
    -- Resale: seller gets (sale_price - 5), original owner gets 5
    v_seller_payment := p_sale_price - 5.00;
    v_royalty_payment := 5.00;
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
    -- Add 5 coins to original owner (from buyer's payment, NOT coin pool)
    INSERT INTO coins (user_id, balance)
    VALUES (p_card_user_id, v_royalty_payment)
    ON CONFLICT (user_id)
    DO UPDATE SET 
      balance = coins.balance + v_royalty_payment,
      updated_at = now();
    
    -- Record royalty transaction (clarify it's from buyer's payment)
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
    VALUES (
      p_card_user_id,
      v_royalty_payment,
      'card_royalty',
      'Royalty from card resale (buyer paid ' || p_sale_price || ', you received ' || v_royalty_payment || ')'
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
    'Sold card (received ' || v_seller_payment || ' of ' || p_sale_price || ' paid by buyer)'
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
    'seller_payment', v_seller_payment,
    'royalty_payment', v_royalty_payment,
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

-- Update coin earning function to properly track pool distribution
CREATE OR REPLACE FUNCTION distribute_coins_from_pool(
  p_user_id uuid,
  p_amount numeric,
  p_source text,
  p_description text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pool_remaining numeric;
  v_result json;
BEGIN
  -- Check coin pool has enough coins remaining
  SELECT (total_coins - distributed_coins) INTO v_pool_remaining
  FROM coin_pool
  WHERE id = '00000000-0000-0000-0000-000000000001'
  FOR UPDATE;
  
  IF v_pool_remaining IS NULL THEN
    RAISE EXCEPTION 'Coin pool not initialized';
  END IF;
  
  IF v_pool_remaining < p_amount THEN
    RAISE EXCEPTION 'Insufficient coins in pool. Available: %, Requested: %', v_pool_remaining, p_amount;
  END IF;
  
  -- Mark coins as distributed from pool
  UPDATE coin_pool
  SET distributed_coins = distributed_coins + p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  -- Add coins to user balance
  INSERT INTO coins (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    balance = coins.balance + p_amount,
    updated_at = now();
  
  -- Record the earning
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, p_amount, p_source, p_description);
  
  v_result := json_build_object(
    'success', true,
    'amount', p_amount,
    'pool_remaining', v_pool_remaining - p_amount
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to distribute coins: %', SQLERRM;
END;
$$;

-- Create function to track comment earnings (one per profile)
CREATE TABLE IF NOT EXISTS comment_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount numeric DEFAULT 0.1 NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, profile_id)
);

ALTER TABLE comment_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own comment earnings"
  ON comment_earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to earn coins from commenting (one per profile)
CREATE OR REPLACE FUNCTION earn_coins_from_comment(
  p_user_id uuid,
  p_profile_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_already_earned boolean;
  v_result json;
BEGIN
  -- Check if user already earned from this profile
  SELECT EXISTS(
    SELECT 1 FROM comment_earnings
    WHERE user_id = p_user_id AND profile_id = p_profile_id
  ) INTO v_already_earned;
  
  IF v_already_earned THEN
    RETURN json_build_object(
      'success', false,
      'error', 'already_earned',
      'message', 'You have already earned coins from commenting on this profile'
    );
  END IF;
  
  -- Distribute 0.1 coins from pool
  v_result := distribute_coins_from_pool(
    p_user_id,
    0.1,
    'comment',
    'Earned from commenting on profile'
  );
  
  -- Record that user earned from this profile
  INSERT INTO comment_earnings (user_id, profile_id, amount)
  VALUES (p_user_id, p_profile_id, 0.1);
  
  RETURN json_build_object(
    'success', true,
    'amount', 0.1,
    'message', 'You earned 0.1 coins!'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Function to earn coins from watching ads
CREATE OR REPLACE FUNCTION earn_coins_from_ad(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
BEGIN
  -- Distribute 10 coins from pool
  v_result := distribute_coins_from_pool(
    p_user_id,
    10.0,
    'ad',
    'Earned from watching advertisement'
  );
  
  RETURN json_build_object(
    'success', true,
    'amount', 10.0,
    'message', 'You earned 10 coins!'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Log the critical fix
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CRITICAL FIX APPLIED';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Card Trading (User-to-User):';
  RAISE NOTICE '  - First sale: Buyer pays X → Seller gets X';
  RAISE NOTICE '  - Resale: Buyer pays X → Seller gets (X-5), Original owner gets 5';
  RAISE NOTICE '  - Coin pool NOT involved in trading';
  RAISE NOTICE '';
  RAISE NOTICE 'Coin Pool (Distribution Only):';
  RAISE NOTICE '  - Ads: 10 coins per view';
  RAISE NOTICE '  - Comments: 0.1 coins once per profile';
  RAISE NOTICE '  - Stripe: X coins purchased';
  RAISE NOTICE '';
  RAISE NOTICE 'Once distributed, coins circulate between users forever';
  RAISE NOTICE '========================================';
END $$;
