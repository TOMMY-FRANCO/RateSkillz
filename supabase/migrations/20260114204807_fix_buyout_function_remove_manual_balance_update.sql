/*
  # Fix Buyout Function - Remove Manual Balance Update

  ## Problem
  The buy_myself_out function has the same duplicate coin issue:
  1. It manually increases the holder's balance by 100 coins (line 94-97)
  2. Then inserts a positive transaction for that payment (line 99-107)
  3. The trigger sees positive amount and adds ANOTHER 100 coins
  4. Result: Holder gets 200 coins instead of 100!

  ## Solution
  Remove the manual balance increase for the holder.
  Let the trigger handle the balance update automatically.
  
  Flow:
  1. Manually deduct from buyer (negative amount, trigger ignores)
  2. Insert negative buyer transaction (trigger ignores)
  3. Insert positive holder transaction (trigger updates balance)

  ## Result
  - Single atomic transaction per payment
  - No duplicate coin crediting
  - Holder gets correct 100 coins
  - Balance matches transaction sum exactly
*/

-- Fix buyout function - remove manual balance increase for holder
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

  -- STEP 1: Manually deduct total cost from original owner (negative, trigger ignores)
  UPDATE profiles
  SET coin_balance = coin_balance - v_total_cost
  WHERE id = p_original_owner_id;

  -- STEP 2: Record buyout cost transaction for original owner (negative, trigger ignores)
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    p_original_owner_id,
    -v_total_cost,
    'card_buyout',
    'Bought back own card (' || v_current_price || ' coins burned + ' || v_payment_to_holder || ' coins to holder)',
    p_card_user_id::text
  );

  -- STEP 3: Record payment to holder transaction (positive, trigger updates balance)
  -- DO NOT manually update holder balance - let trigger handle it
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    v_current_holder_id,
    v_payment_to_holder,
    'card_buyout_payment',
    'Received 100 coins from card buyout',
    p_card_user_id::text
  );

  -- STEP 4: Transfer ownership back to original owner
  UPDATE card_ownership
  SET
    owner_id = p_original_owner_id,
    times_traded = times_traded + 1,
    last_purchase_price = v_total_cost,
    acquired_at = now(),
    updated_at = now()
  WHERE card_user_id = p_card_user_id;

  -- STEP 5: Record buyout transaction in card_transactions
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

-- Update transaction type constraint to include card_buyout and card_buyout_payment
DO $$
BEGIN
  ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;
  
  ALTER TABLE coin_transactions ADD CONSTRAINT coin_transactions_transaction_type_check 
    CHECK (transaction_type IN (
      'comment_reward',
      'ad_view',
      'ad_reward',
      'purchase',
      'card_sale',
      'card_purchase',
      'coin_purchase',
      'card_royalty',
      'balance_correction',
      'battle_wager',
      'battle_win',
      'coin_transfer_sent',
      'coin_transfer_received',
      'card_swap',
      'card_discard',
      'reward_whatsapp',
      'reward_social_share',
      'reward_friend_milestone',
      'whatsapp_share',
      'whatsapp_share_retroactive_credit',
      'purchase_request_sale',
      'tutorial_completion',
      'card_buyout',
      'card_buyout_payment'
    ));
END $$;
