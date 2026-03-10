/*
  # Fix purchase request notification counts

  1. Problem
    - `create_purchase_request`, `approve_purchase_request`, and `decline_purchase_request`
      insert into the old `notifications` table but do NOT update `notification_counts`
    - The badge system reads from `notification_counts` via `get_notification_counts` RPC
    - This means purchase request badges never show up on the card trading button

  2. Fix
    - Add `notification_counts` UPSERT after each INSERT INTO notifications
    - Maps notification types: purchase_request, card_sold (for approved), purchase_offer (for declined)

  3. Functions Modified
    - `create_purchase_request` - adds notification_counts update for 'purchase_request'
    - `approve_purchase_request` - adds notification_counts update for 'card_sold'
    - `decline_purchase_request` - adds notification_counts update for 'purchase_offer'
*/

-- Fix create_purchase_request to update notification_counts
CREATE OR REPLACE FUNCTION public.create_purchase_request(
  p_card_user_id uuid,
  p_buyer_id uuid,
  p_requested_price numeric,
  p_request_type text DEFAULT 'not_bought'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ownership record;
  v_request_id uuid;
  v_buyer_balance numeric;
BEGIN
  IF p_card_user_id = p_buyer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot purchase your own card');
  END IF;

  SELECT * INTO v_ownership
  FROM card_ownership
  WHERE card_user_id = p_card_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Card not found');
  END IF;

  SELECT coin_balance INTO v_buyer_balance
  FROM profiles
  WHERE id = p_buyer_id;

  IF COALESCE(v_buyer_balance, 0) < p_requested_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
  END IF;

  IF EXISTS (
    SELECT 1 FROM purchase_requests
    WHERE card_user_id = p_card_user_id
    AND buyer_id = p_buyer_id
    AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending request for this card');
  END IF;

  INSERT INTO purchase_requests (
    card_user_id,
    buyer_id,
    seller_id,
    requested_price,
    request_type
  ) VALUES (
    p_card_user_id,
    p_buyer_id,
    v_ownership.owner_id,
    p_requested_price,
    p_request_type
  ) RETURNING id INTO v_request_id;

  INSERT INTO notifications (user_id, actor_id, type, message, metadata)
  VALUES (
    v_ownership.owner_id,
    p_buyer_id,
    'purchase_request',
    'sent you a purchase request for your card',
    jsonb_build_object('request_id', v_request_id, 'amount', p_requested_price, 'card_user_id', p_card_user_id)
  );

  INSERT INTO notification_counts (user_id, notification_type, unread_count)
  VALUES (v_ownership.owner_id, 'purchase_request', 1)
  ON CONFLICT (user_id, notification_type)
  DO UPDATE SET
    unread_count = notification_counts.unread_count + 1,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$function$;

-- Fix approve_purchase_request to update notification_counts
CREATE OR REPLACE FUNCTION public.approve_purchase_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    v_request.buyer_id,
    -v_request.requested_price,
    'card_purchase',
    'Purchased card via request at ' || v_request.requested_price || ' coins'
  );

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (
    v_request.seller_id,
    v_seller_payment,
    'card_sale',
    'Sold card via request (received ' || v_seller_payment || ' of ' || v_request.requested_price || ')'
  );

  IF v_royalty_amount > 0 AND v_request.seller_id != v_original_owner_id THEN
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
    VALUES (
      v_original_owner_id,
      v_royalty_amount,
      'card_royalty',
      'Royalty from card resale (' || v_royalty_amount || ' coins)'
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

  INSERT INTO notification_counts (user_id, notification_type, unread_count)
  VALUES (v_request.buyer_id, 'card_sold', 1)
  ON CONFLICT (user_id, notification_type)
  DO UPDATE SET
    unread_count = notification_counts.unread_count + 1,
    updated_at = now();

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
$function$;

-- Fix decline_purchase_request to update notification_counts
CREATE OR REPLACE FUNCTION public.decline_purchase_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_request record;
BEGIN
  SELECT * INTO v_request
  FROM purchase_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  UPDATE purchase_requests
  SET status = 'declined', response_date = now()
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, actor_id, type, message, metadata)
  VALUES (
    v_request.buyer_id,
    v_request.seller_id,
    'purchase_declined',
    'declined your purchase request',
    jsonb_build_object('request_id', p_request_id, 'card_user_id', v_request.card_user_id)
  );

  INSERT INTO notification_counts (user_id, notification_type, unread_count)
  VALUES (v_request.buyer_id, 'purchase_offer', 1)
  ON CONFLICT (user_id, notification_type)
  DO UPDATE SET
    unread_count = notification_counts.unread_count + 1,
    updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$function$;
