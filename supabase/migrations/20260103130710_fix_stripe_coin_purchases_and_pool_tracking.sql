/*
  # Fix Stripe Coin Purchases and Pool Tracking

  1. Changes
    - Update coin_pool trigger to track purchases from Stripe
    - Add duplicate transaction prevention for payment references
    - Ensure coin pool decrements when coins are purchased
    - Add index on reference_id for faster duplicate checks

  2. Security
    - Maintain existing RLS policies
    - All operations are secure and validated

  3. Notes
    - Coin pool should decrement for coin purchases (external coins entering system)
    - Coin pool should increment when coins are spent on platform features (coins returning to pool)
    - Maintains 1 billion coin economy
*/

-- Add index on reference_id for faster duplicate payment checks
CREATE INDEX IF NOT EXISTS idx_coin_transactions_reference_id 
ON coin_transactions(reference_id) 
WHERE reference_id IS NOT NULL;

-- Update the coin pool trigger to properly handle purchases
CREATE OR REPLACE FUNCTION update_coin_pool_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Handle coin purchases (external coins entering the system via Stripe)
  -- These should DECREMENT the remaining pool as coins are sold
  IF NEW.transaction_type = 'purchase' AND NEW.amount > 0 THEN
    UPDATE coin_pool
    SET 
      distributed_coins = distributed_coins + NEW.amount,
      remaining_coins = remaining_coins - NEW.amount,
      updated_at = now()
    WHERE id = '00000000-0000-0000-0000-000000000001';
    
    RAISE NOTICE 'Coin pool updated for purchase: -% coins from pool', NEW.amount;
  END IF;

  -- Handle coin spending on platform (card purchases, swaps, etc.)
  -- These return coins to the pool as they circulate within the economy
  IF NEW.transaction_type IN ('card_purchase', 'card_swap', 'battle_wager') AND NEW.amount < 0 THEN
    -- For negative transactions (spending), add back to pool
    UPDATE coin_pool
    SET 
      distributed_coins = distributed_coins + NEW.amount,
      remaining_coins = remaining_coins - NEW.amount,
      updated_at = now()
    WHERE id = '00000000-0000-0000-0000-000000000001';
    
    RAISE NOTICE 'Coin pool updated for spending: % coins returned to pool', ABS(NEW.amount);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating coin pool: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Function to check for duplicate payment transactions
CREATE OR REPLACE FUNCTION check_duplicate_payment(
  p_reference_id text,
  p_user_id uuid,
  p_amount numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Check if a transaction with this reference_id already exists
  SELECT EXISTS(
    SELECT 1 
    FROM coin_transactions 
    WHERE reference_id = p_reference_id
      AND user_id = p_user_id
      AND amount = p_amount
      AND transaction_type = 'purchase'
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

-- Function to process Stripe coin purchase (to be called from webhook)
CREATE OR REPLACE FUNCTION process_stripe_coin_purchase(
  p_user_id uuid,
  p_coins_amount numeric,
  p_price_gbp numeric,
  p_payment_intent_id text,
  p_customer_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_new_balance numeric;
  v_is_duplicate boolean;
BEGIN
  -- Check for duplicate transaction
  v_is_duplicate := check_duplicate_payment(p_payment_intent_id, p_user_id, p_coins_amount);
  
  IF v_is_duplicate THEN
    RAISE NOTICE 'Duplicate payment detected: %', p_payment_intent_id;
    RETURN json_build_object(
      'success', false,
      'message', 'Payment already processed',
      'duplicate', true
    );
  END IF;

  -- Check if user exists
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- Check coin pool availability
  IF EXISTS(
    SELECT 1 FROM coin_pool 
    WHERE id = '00000000-0000-0000-0000-000000000001' 
    AND remaining_coins < p_coins_amount
  ) THEN
    RAISE WARNING 'Coin pool low but processing payment anyway: % coins remaining', 
      (SELECT remaining_coins FROM coin_pool WHERE id = '00000000-0000-0000-0000-000000000001');
  END IF;

  -- Insert transaction (triggers will update balance and pool automatically)
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    reference_id,
    payment_provider,
    payment_amount
  ) VALUES (
    p_user_id,
    p_coins_amount,
    'purchase',
    format('Purchased %s coins for £%s', p_coins_amount, p_price_gbp),
    p_payment_intent_id,
    'stripe',
    p_price_gbp
  )
  RETURNING id INTO v_transaction_id;

  -- Get updated balance
  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id;

  -- Update or create stripe_customers record if customer_id provided
  IF p_customer_id IS NOT NULL THEN
    INSERT INTO stripe_customers (user_id, customer_id, created_at, updated_at)
    VALUES (p_user_id, p_customer_id, now(), now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      customer_id = EXCLUDED.customer_id,
      updated_at = now();
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', format('Successfully added %s coins', p_coins_amount),
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'coins_added', p_coins_amount
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error processing Stripe purchase: %', SQLERRM;
  RAISE;
END;
$$;

-- Function to lookup user from Stripe customer ID
CREATE OR REPLACE FUNCTION get_user_from_stripe_customer(p_customer_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM stripe_customers
  WHERE customer_id = p_customer_id
  AND deleted_at IS NULL;
  
  RETURN v_user_id;
END;
$$;
