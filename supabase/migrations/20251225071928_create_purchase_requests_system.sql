/*
  # Create Purchase Requests System for Not Bought & No Manager Cards

  ## Overview
  This migration adds support for purchase requests on cards that are either:
  1. Not Bought - Never purchased (times_traded = 0, owner = original user)
  2. No Manager - Previously purchased but no current manager

  ## New Tables

  ### purchase_requests
  - `id` (uuid, primary key) - Unique request ID
  - `card_user_id` (uuid, references profiles) - Whose card this is
  - `buyer_id` (uuid, references profiles) - Who wants to buy
  - `seller_id` (uuid, references profiles) - Current owner (original owner)
  - `requested_price` (numeric) - Price buyer is requesting to pay
  - `status` (enum) - pending/approved/declined
  - `created_at` (timestamp) - Request creation time
  - `response_date` (timestamp) - When owner responded
  
  ## Business Logic
  - Not Bought cards fixed at 20 coins
  - Buyer sends purchase request
  - Original owner approves/declines
  - On approval: buyer pays, card transfers, value increases by 10 coins
  - Original owner gets 20 coins + 10 coin royalty benefit

  ## Security
  - Enable RLS on purchase_requests table
  - Only authenticated users can create requests
  - Only seller can approve/decline
  - Both parties can view their requests
*/

-- Create purchase_requests table
CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  requested_price numeric(10,2) NOT NULL DEFAULT 20.00,
  status text DEFAULT 'pending' NOT NULL,
  request_type text DEFAULT 'not_bought' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  response_date timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'declined')),
  CONSTRAINT valid_request_type CHECK (request_type IN ('not_bought', 'no_manager')),
  CONSTRAINT positive_price CHECK (requested_price > 0),
  CONSTRAINT no_self_purchase CHECK (buyer_id != card_user_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_purchase_requests_buyer ON purchase_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_seller ON purchase_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_purchase_requests_card ON purchase_requests(card_user_id);

-- Enable RLS
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_requests
CREATE POLICY "Users can view requests involving them"
  ON purchase_requests
  FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users can create purchase requests"
  ON purchase_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Sellers can update request status"
  ON purchase_requests
  FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Function to create purchase request
CREATE OR REPLACE FUNCTION create_purchase_request(
  p_card_user_id uuid,
  p_buyer_id uuid,
  p_requested_price numeric,
  p_request_type text DEFAULT 'not_bought'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ownership record;
  v_request_id uuid;
  v_buyer_balance numeric;
BEGIN
  -- Prevent self-purchase
  IF p_card_user_id = p_buyer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot purchase your own card');
  END IF;
  
  -- Get card ownership details
  SELECT * INTO v_ownership
  FROM card_ownership
  WHERE card_user_id = p_card_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Card not found');
  END IF;
  
  -- Check buyer has enough coins
  SELECT balance INTO v_buyer_balance
  FROM coins
  WHERE user_id = p_buyer_id;
  
  IF v_buyer_balance < p_requested_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
  END IF;

  -- Check if there's already a pending request
  IF EXISTS (
    SELECT 1 FROM purchase_requests
    WHERE card_user_id = p_card_user_id
    AND buyer_id = p_buyer_id
    AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending request for this card');
  END IF;
  
  -- Create purchase request
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
  
  -- Create notification for seller
  INSERT INTO notifications (user_id, actor_id, type, message, metadata)
  VALUES (
    v_ownership.owner_id,
    p_buyer_id,
    'purchase_request',
    'sent you a purchase request for your card',
    jsonb_build_object('request_id', v_request_id, 'amount', p_requested_price, 'card_user_id', p_card_user_id)
  );
  
  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- Function to approve purchase request
CREATE OR REPLACE FUNCTION approve_purchase_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request record;
  v_ownership record;
  v_buyer_balance numeric;
  v_new_price numeric;
  v_is_first_sale boolean;
  v_royalty_amount numeric;
BEGIN
  -- Get request details
  SELECT * INTO v_request
  FROM purchase_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;
  
  -- Get ownership details
  SELECT * INTO v_ownership
  FROM card_ownership
  WHERE card_user_id = v_request.card_user_id;
  
  -- Verify current owner matches seller
  IF v_ownership.owner_id != v_request.seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ownership has changed');
  END IF;
  
  -- Check buyer balance
  SELECT balance INTO v_buyer_balance
  FROM coins
  WHERE user_id = v_request.buyer_id;
  
  IF v_buyer_balance < v_request.requested_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Buyer has insufficient coins');
  END IF;

  -- Determine if this is a first sale
  v_is_first_sale := (v_ownership.times_traded = 0 AND v_request.seller_id = v_request.card_user_id);
  
  -- Calculate new price (current price + 10 coins)
  v_new_price := v_ownership.current_price + 10.00;

  -- If first sale, seller gets full amount + royalty benefit
  IF v_is_first_sale THEN
    v_royalty_amount := 10.00;
  ELSE
    v_royalty_amount := 0;
  END IF;
  
  -- Deduct coins from buyer
  UPDATE coins 
  SET balance = balance - v_request.requested_price,
      updated_at = now()
  WHERE user_id = v_request.buyer_id;

  -- Add coins to seller (includes royalty if first sale)
  UPDATE coins
  SET balance = balance + v_request.requested_price + v_royalty_amount,
      updated_at = now()
  WHERE user_id = v_request.seller_id;

  -- Record buyer transaction
  INSERT INTO coin_transactions (
    user_id, 
    amount, 
    transaction_type, 
    description,
    balance_after
  ) VALUES (
    v_request.buyer_id,
    -v_request.requested_price,
    'purchase',
    'Purchased card',
    (SELECT balance FROM coins WHERE user_id = v_request.buyer_id)
  );

  -- Record seller transaction
  INSERT INTO coin_transactions (
    user_id, 
    amount, 
    transaction_type, 
    description,
    balance_after
  ) VALUES (
    v_request.seller_id,
    v_request.requested_price + v_royalty_amount,
    'purchase',
    CASE 
      WHEN v_is_first_sale THEN 'Sold card (first sale +10 royalty)'
      ELSE 'Sold card'
    END,
    (SELECT balance FROM coins WHERE user_id = v_request.seller_id)
  );
  
  -- Update card ownership
  UPDATE card_ownership
  SET 
    owner_id = v_request.buyer_id,
    current_price = v_new_price,
    times_traded = times_traded + 1,
    last_sale_price = v_request.requested_price,
    is_listed_for_sale = false,
    asking_price = NULL,
    acquired_at = now(),
    updated_at = now()
  WHERE card_user_id = v_request.card_user_id;
  
  -- Record card transaction
  INSERT INTO card_transactions (
    card_user_id, 
    seller_id, 
    buyer_id, 
    sale_price, 
    transaction_type
  ) VALUES (
    v_request.card_user_id, 
    v_request.seller_id, 
    v_request.buyer_id, 
    v_request.requested_price,
    'purchase_request_sale'
  );
  
  -- Update request status
  UPDATE purchase_requests
  SET status = 'approved', response_date = now()
  WHERE id = p_request_id;
  
  -- Notify buyer of approval
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
      'new_price', v_new_price
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'new_owner', v_request.buyer_id,
    'sale_price', v_request.requested_price,
    'new_price', v_new_price,
    'is_first_sale', v_is_first_sale,
    'royalty_paid', v_royalty_amount
  );
END;
$$;

-- Function to decline purchase request
CREATE OR REPLACE FUNCTION decline_purchase_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request record;
BEGIN
  -- Get request details
  SELECT * INTO v_request
  FROM purchase_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;
  
  -- Update request status
  UPDATE purchase_requests
  SET status = 'declined', response_date = now()
  WHERE id = p_request_id;
  
  -- Notify buyer of decline
  INSERT INTO notifications (user_id, actor_id, type, message, metadata)
  VALUES (
    v_request.buyer_id,
    v_request.seller_id,
    'purchase_declined',
    'declined your purchase request',
    jsonb_build_object('request_id', p_request_id, 'card_user_id', v_request.card_user_id)
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;
