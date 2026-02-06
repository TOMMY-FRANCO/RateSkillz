/*
  # Fix card sale coin flow - double deduction and royalty bugs

  1. Problem: purchase_card_at_fixed_price
    - Buyer is charged TWICE: once by manual UPDATE in STEP 1, and again by the
      update_coin_balance_on_transaction trigger when coin_transactions row is inserted
    - Fix: Remove the manual buyer deduction (STEP 1), let the trigger handle it

  2. Problem: approve_purchase_request
    - On resales, original card user gets ZERO royalty (v_royalty_amount = 0)
    - On first sale, seller gets a 10-coin bonus from thin air
    - Uses deprecated `coins` table instead of `profiles.coin_balance`
    - Fix: Rewrite to match the same 5/5 split logic as direct purchases,
      use profiles.coin_balance, and let triggers handle balance updates

  3. Expected coin flow (both paths):
    - First sale: buyer pays current_price, seller (= original owner) gets full amount
    - Resale (seller != original owner): buyer pays current_price,
      seller gets current_price - 5, original card user gets 5 royalty
    - Resale (seller = original owner): buyer pays current_price,
      seller gets full amount (royalty would go to self)
    - Card value always increases by 10

  4. Modified Functions
    - `purchase_card_at_fixed_price`: removed manual buyer deduction
    - `approve_purchase_request`: rewrote with proper royalty logic and profiles balance
*/

CREATE OR REPLACE FUNCTION public.purchase_card_at_fixed_price(
  p_card_user_id uuid,
  p_buyer_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  v_royalty_payment numeric := 0;
  v_transaction_id uuid;
  v_result json;
BEGIN
  PERFORM validate_coin_amount(1, p_buyer_id, 'card_purchase', 1000000);
  PERFORM validate_coin_amount(1, p_card_user_id, 'card_purchase', 1000000);

  SELECT owner_id, current_price, times_traded, original_owner_id
  INTO v_seller_id, v_current_price, v_times_traded, v_original_owner_id
  FROM card_ownership
  WHERE card_user_id = p_card_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  IF v_original_owner_id IS NULL THEN
    v_original_owner_id := p_card_user_id;
    UPDATE card_ownership
    SET original_owner_id = p_card_user_id
    WHERE card_user_id = p_card_user_id;
  END IF;

  v_is_first_sale := (v_times_traded = 0);

  IF p_buyer_id = v_seller_id THEN
    RAISE EXCEPTION 'Cannot buy your own card';
  END IF;

  IF p_buyer_id = v_original_owner_id AND NOT v_is_first_sale THEN
    RAISE EXCEPTION 'You cannot buy your own card back from a manager';
  END IF;

  SELECT coin_balance INTO v_buyer_balance
  FROM profiles
  WHERE id = p_buyer_id
  FOR UPDATE;

  PERFORM validate_coin_amount(v_current_price, p_buyer_id, 'card_purchase', 1000000);

  IF v_buyer_balance IS NULL OR v_buyer_balance < v_current_price THEN
    RAISE EXCEPTION 'Insufficient coins. You have % but need %',
      COALESCE(v_buyer_balance, 0), v_current_price;
  END IF;

  IF v_is_first_sale THEN
    v_seller_payment := v_current_price;
    v_royalty_payment := 0;
  ELSE
    IF v_seller_id = v_original_owner_id THEN
      v_seller_payment := v_current_price;
      v_royalty_payment := 0;
    ELSE
      v_seller_payment := v_current_price - 5.00;
      v_royalty_payment := 5.00;
    END IF;
  END IF;

  v_new_price := v_current_price + 10.00;

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    p_buyer_id,
    -v_current_price,
    'card_purchase',
    'Purchased card at fixed price of ' || v_current_price || ' coins',
    p_card_user_id::text
  );

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    v_seller_id,
    v_seller_payment,
    'card_sale',
    'Sold card at fixed price (received ' || v_seller_payment || ' of ' || v_current_price || ')',
    p_card_user_id::text
  );

  IF v_royalty_payment > 0 AND v_seller_id != v_original_owner_id THEN
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
    VALUES (
      v_original_owner_id,
      v_royalty_payment,
      'card_royalty',
      'Royalty from card resale (' || v_royalty_payment || ' coins)',
      p_card_user_id::text
    );
  END IF;

  UPDATE card_ownership
  SET
    owner_id = p_buyer_id,
    current_price = v_new_price,
    times_traded = times_traded + 1,
    last_purchase_price = v_current_price,
    acquired_at = now(),
    updated_at = now()
  WHERE card_user_id = p_card_user_id;

  INSERT INTO card_transactions (
    card_user_id, seller_id, buyer_id, sale_price, transaction_type,
    card_value_at_sale, previous_value, new_value
  ) VALUES (
    p_card_user_id, v_seller_id, p_buyer_id, v_current_price,
    CASE WHEN v_is_first_sale THEN 'initial_purchase' ELSE 'sale' END,
    v_current_price, v_current_price, v_new_price
  ) RETURNING id INTO v_transaction_id;

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
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_purchase_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request record;
  v_ownership record;
  v_buyer_balance numeric;
  v_new_price numeric;
  v_is_first_sale boolean;
  v_seller_payment numeric;
  v_royalty_amount numeric := 0;
  v_original_owner_id uuid;
BEGIN
  SELECT * INTO v_request FROM purchase_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  SELECT * INTO v_ownership FROM card_ownership
  WHERE card_user_id = v_request.card_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Card not found');
  END IF;

  IF v_ownership.owner_id != v_request.seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ownership has changed');
  END IF;

  SELECT coin_balance INTO v_buyer_balance
  FROM profiles
  WHERE id = v_request.buyer_id
  FOR UPDATE;

  IF v_buyer_balance IS NULL OR v_buyer_balance < v_request.requested_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Buyer has insufficient coins');
  END IF;

  v_original_owner_id := COALESCE(v_ownership.original_owner_id, v_request.card_user_id);
  v_is_first_sale := (v_ownership.times_traded = 0 AND v_request.seller_id = v_request.card_user_id);
  v_new_price := v_ownership.current_price + 10.00;

  IF v_is_first_sale THEN
    v_seller_payment := v_request.requested_price;
    v_royalty_amount := 0;
  ELSE
    IF v_request.seller_id = v_original_owner_id THEN
      v_seller_payment := v_request.requested_price;
      v_royalty_amount := 0;
    ELSE
      v_seller_payment := v_request.requested_price - 5.00;
      v_royalty_amount := 5.00;
    END IF;
  END IF;

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    v_request.buyer_id,
    -v_request.requested_price,
    'card_purchase',
    'Purchased card via request at ' || v_request.requested_price || ' coins',
    v_request.card_user_id::text
  );

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    v_request.seller_id,
    v_seller_payment,
    'card_sale',
    'Sold card via request (received ' || v_seller_payment || ' of ' || v_request.requested_price || ')',
    v_request.card_user_id::text
  );

  IF v_royalty_amount > 0 AND v_request.seller_id != v_original_owner_id THEN
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
    VALUES (
      v_original_owner_id,
      v_royalty_amount,
      'card_royalty',
      'Royalty from card resale (' || v_royalty_amount || ' coins)',
      v_request.card_user_id::text
    );
  END IF;

  IF v_ownership.original_owner_id IS NULL THEN
    UPDATE card_ownership
    SET original_owner_id = v_request.card_user_id
    WHERE card_user_id = v_request.card_user_id;
  END IF;

  UPDATE card_ownership
  SET
    owner_id = v_request.buyer_id,
    current_price = v_new_price,
    times_traded = times_traded + 1,
    last_sale_price = v_request.requested_price,
    last_purchase_price = v_request.requested_price,
    is_listed_for_sale = false,
    acquired_at = now(),
    updated_at = now()
  WHERE card_user_id = v_request.card_user_id;

  INSERT INTO card_transactions (
    card_user_id, seller_id, buyer_id, sale_price, transaction_type,
    card_value_at_sale, previous_value, new_value
  ) VALUES (
    v_request.card_user_id, v_request.seller_id, v_request.buyer_id,
    v_request.requested_price,
    CASE WHEN v_is_first_sale THEN 'initial_purchase' ELSE 'purchase_request_sale' END,
    v_request.requested_price, v_ownership.current_price, v_new_price
  );

  UPDATE purchase_requests
  SET status = 'approved', response_date = now()
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, actor_id, type, message, metadata)
  VALUES (
    v_request.buyer_id,
    v_request.seller_id,
    'purchase_approved',
    'approved your purchase request',
    jsonb_build_object(
      'request_id', p_request_id,
      'amount', v_request.requested_price,
      'card_user_id', v_request.card_user_id,
      'new_price', v_new_price,
      'royalty_paid', v_royalty_amount
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_owner', v_request.buyer_id,
    'sale_price', v_request.requested_price,
    'seller_received', v_seller_payment,
    'new_price', v_new_price,
    'is_first_sale', v_is_first_sale,
    'royalty_paid', v_royalty_amount
  );
END;
$$;
