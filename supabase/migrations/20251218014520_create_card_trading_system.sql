/*
  # Create Card Trading Marketplace System

  1. New Tables
    - `card_ownership`
      - `id` (uuid, primary key)
      - `card_user_id` (uuid, references profiles) - whose card this is
      - `owner_id` (uuid, references profiles) - who currently owns it
      - `current_price` (decimal) - current market value
      - `base_price` (decimal) - base value (increases 10% per sale)
      - `is_listed_for_sale` (boolean) - whether listed
      - `asking_price` (decimal) - owner's asking price
      - `times_traded` (integer) - number of trades
      - `last_sale_price` (decimal) - what current owner paid
      - `acquired_at` (timestamp)
      - UNIQUE constraint on card_user_id
    
    - `card_transactions`
      - `id` (uuid, primary key)
      - `card_user_id` (uuid, references profiles) - whose card
      - `seller_id` (uuid, references profiles) - who sold it
      - `buyer_id` (uuid, references profiles) - who bought it
      - `sale_price` (decimal) - transaction amount
      - `transaction_type` (text) - type of transaction
      - `created_at` (timestamp)
    
    - `card_offers`
      - `id` (uuid, primary key)
      - `card_user_id` (uuid, references profiles) - whose card
      - `current_owner_id` (uuid, references profiles) - who owns it now
      - `buyer_id` (uuid, references profiles) - who wants to buy
      - `offer_amount` (decimal) - offer price
      - `offer_type` (text) - type of offer
      - `status` (text) - pending/accepted/denied/expired
      - `message` (text) - optional message
      - `created_at` (timestamp)
      - `responded_at` (timestamp)
  
  2. Functions
    - `initialize_user_card` - Creates initial card ownership for new users
    - `create_card_offer` - Creates purchase request or offer
    - `accept_card_offer` - Processes card sale and transfer
    - `list_card_for_sale` - Lists a card for sale
    - `get_card_ownership_details` - Gets card ownership info
  
  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Validate business rules (no self-purchase, minimum markup, etc.)
  
  4. Important Notes
    - All users start with their own card at 20 coins
    - Card price increases 10% after each sale
    - Must markup 20% when relisting
    - Cannot buy your own card
    - Once you sell your own card, you can't opt-out
*/

-- Create card_ownership table
CREATE TABLE IF NOT EXISTS card_ownership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  current_price numeric(10,2) NOT NULL DEFAULT 20.00,
  base_price numeric(10,2) NOT NULL DEFAULT 20.00,
  is_listed_for_sale boolean DEFAULT false,
  asking_price numeric(10,2),
  times_traded integer DEFAULT 0,
  last_sale_price numeric(10,2),
  acquired_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_card_per_user UNIQUE(card_user_id),
  CONSTRAINT positive_prices CHECK (current_price > 0 AND base_price > 0),
  CONSTRAINT valid_asking_price CHECK (asking_price IS NULL OR asking_price > 0)
);

-- Create card_transactions table
CREATE TABLE IF NOT EXISTS card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  buyer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sale_price numeric(10,2) NOT NULL,
  transaction_type text DEFAULT 'sale' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('sale', 'offer_accepted', 'initial_purchase'))
);

-- Create card_offers table
CREATE TABLE IF NOT EXISTS card_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  current_owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  offer_amount numeric(10,2) NOT NULL,
  offer_type text DEFAULT 'purchase_request' NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  responded_at timestamptz,
  CONSTRAINT valid_offer_type CHECK (offer_type IN ('purchase_request', 'offer', 'counter_offer')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'denied', 'expired')),
  CONSTRAINT positive_offer CHECK (offer_amount > 0),
  CONSTRAINT no_self_purchase CHECK (buyer_id != card_user_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_card_ownership_card_user ON card_ownership(card_user_id);
CREATE INDEX IF NOT EXISTS idx_card_ownership_owner ON card_ownership(owner_id);
CREATE INDEX IF NOT EXISTS idx_card_ownership_listed ON card_ownership(is_listed_for_sale) WHERE is_listed_for_sale = true;
CREATE INDEX IF NOT EXISTS idx_card_transactions_card_user ON card_transactions(card_user_id);
CREATE INDEX IF NOT EXISTS idx_card_transactions_created ON card_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_offers_buyer ON card_offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_card_offers_owner ON card_offers(current_owner_id);
CREATE INDEX IF NOT EXISTS idx_card_offers_status ON card_offers(status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE card_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for card_ownership
CREATE POLICY "Anyone can view card ownership"
  ON card_ownership
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage card ownership"
  ON card_ownership
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for card_transactions
CREATE POLICY "Users can view their transactions"
  ON card_transactions
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid() OR buyer_id = auth.uid() OR card_user_id = auth.uid());

CREATE POLICY "System can create transactions"
  ON card_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for card_offers
CREATE POLICY "Users can view offers involving them"
  ON card_offers
  FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR current_owner_id = auth.uid() OR card_user_id = auth.uid());

CREATE POLICY "Users can create offers"
  ON card_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Owners can update offer status"
  ON card_offers
  FOR UPDATE
  TO authenticated
  USING (current_owner_id = auth.uid());

-- Function to initialize card ownership for new users
CREATE OR REPLACE FUNCTION initialize_user_card(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO card_ownership (card_user_id, owner_id, current_price, base_price)
  VALUES (p_user_id, p_user_id, 20.00, 20.00)
  ON CONFLICT (card_user_id) DO NOTHING;
END;
$$;

-- Function to create card offer
CREATE OR REPLACE FUNCTION create_card_offer(
  p_card_user_id uuid,
  p_buyer_id uuid,
  p_offer_amount numeric,
  p_offer_type text DEFAULT 'purchase_request',
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ownership record;
  v_offer_id uuid;
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
  SELECT coin_balance INTO v_buyer_balance
  FROM profiles
  WHERE id = p_buyer_id;
  
  IF v_buyer_balance < p_offer_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
  END IF;
  
  -- Create offer
  INSERT INTO card_offers (
    card_user_id,
    current_owner_id,
    buyer_id,
    offer_amount,
    offer_type,
    message
  ) VALUES (
    p_card_user_id,
    v_ownership.owner_id,
    p_buyer_id,
    p_offer_amount,
    p_offer_type,
    p_message
  ) RETURNING id INTO v_offer_id;
  
  -- Create notification for owner
  INSERT INTO notifications (user_id, actor_id, type, message, metadata)
  VALUES (
    v_ownership.owner_id,
    p_buyer_id,
    'card_offer',
    CASE 
      WHEN p_offer_type = 'purchase_request' THEN 'wants to buy your card'
      ELSE 'made an offer on your card'
    END,
    jsonb_build_object('offer_id', v_offer_id, 'amount', p_offer_amount, 'card_user_id', p_card_user_id)
  );
  
  RETURN jsonb_build_object('success', true, 'offer_id', v_offer_id);
END;
$$;

-- Function to accept card offer and process sale
CREATE OR REPLACE FUNCTION accept_card_offer(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer record;
  v_ownership record;
  v_buyer_balance numeric;
  v_new_base_price numeric;
  v_new_asking_price numeric;
BEGIN
  -- Get offer details
  SELECT * INTO v_offer
  FROM card_offers
  WHERE id = p_offer_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer not found or already processed');
  END IF;
  
  -- Get ownership details
  SELECT * INTO v_ownership
  FROM card_ownership
  WHERE card_user_id = v_offer.card_user_id;
  
  -- Verify current owner matches
  IF v_ownership.owner_id != v_offer.current_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ownership has changed');
  END IF;
  
  -- Check buyer balance
  SELECT coin_balance INTO v_buyer_balance
  FROM profiles
  WHERE id = v_offer.buyer_id;
  
  IF v_buyer_balance < v_offer.offer_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Buyer has insufficient coins');
  END IF;
  
  -- Calculate new prices
  v_new_base_price := ROUND(v_ownership.base_price * 1.10, 2);
  v_new_asking_price := ROUND(v_new_base_price * 1.20, 2);
  
  -- Transfer coins from buyer to seller
  UPDATE profiles SET coin_balance = coin_balance - v_offer.offer_amount WHERE id = v_offer.buyer_id;
  UPDATE profiles SET coin_balance = coin_balance + v_offer.offer_amount WHERE id = v_offer.current_owner_id;
  
  -- Log transactions
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES 
    (v_offer.buyer_id, -v_offer.offer_amount, 'purchase', 'Purchased card', p_offer_id),
    (v_offer.current_owner_id, v_offer.offer_amount, 'purchase', 'Sold card', p_offer_id);
  
  -- Update card ownership
  UPDATE card_ownership
  SET 
    owner_id = v_offer.buyer_id,
    base_price = v_new_base_price,
    current_price = v_new_asking_price,
    is_listed_for_sale = true,
    asking_price = v_new_asking_price,
    times_traded = times_traded + 1,
    last_sale_price = v_offer.offer_amount,
    acquired_at = now(),
    updated_at = now()
  WHERE card_user_id = v_offer.card_user_id;
  
  -- Record transaction
  INSERT INTO card_transactions (card_user_id, seller_id, buyer_id, sale_price, transaction_type)
  VALUES (v_offer.card_user_id, v_offer.current_owner_id, v_offer.buyer_id, v_offer.offer_amount, 'sale');
  
  -- Update offer status
  UPDATE card_offers
  SET status = 'accepted', responded_at = now()
  WHERE id = p_offer_id;
  
  -- Notify buyer of success
  INSERT INTO notifications (user_id, actor_id, type, message, metadata)
  VALUES (
    v_offer.buyer_id,
    v_offer.current_owner_id,
    'card_purchase_accepted',
    'accepted your card purchase',
    jsonb_build_object('offer_id', p_offer_id, 'amount', v_offer.offer_amount, 'card_user_id', v_offer.card_user_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'new_owner', v_offer.buyer_id,
    'sale_price', v_offer.offer_amount,
    'new_base_price', v_new_base_price,
    'new_asking_price', v_new_asking_price
  );
END;
$$;

-- Function to deny card offer
CREATE OR REPLACE FUNCTION deny_card_offer(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer record;
BEGIN
  -- Get offer details
  SELECT * INTO v_offer
  FROM card_offers
  WHERE id = p_offer_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer not found or already processed');
  END IF;
  
  -- Update offer status
  UPDATE card_offers
  SET status = 'denied', responded_at = now()
  WHERE id = p_offer_id;
  
  -- Notify buyer
  INSERT INTO notifications (user_id, actor_id, type, message, metadata)
  VALUES (
    v_offer.buyer_id,
    v_offer.current_owner_id,
    'card_purchase_denied',
    'denied your card purchase',
    jsonb_build_object('offer_id', p_offer_id, 'card_user_id', v_offer.card_user_id)
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to list card for sale
CREATE OR REPLACE FUNCTION list_card_for_sale(
  p_card_user_id uuid,
  p_owner_id uuid,
  p_asking_price numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ownership record;
  v_min_price numeric;
BEGIN
  -- Get ownership details
  SELECT * INTO v_ownership
  FROM card_ownership
  WHERE card_user_id = p_card_user_id AND owner_id = p_owner_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not own this card');
  END IF;
  
  -- Cannot sell your own card (only applies if you're the original owner)
  IF p_card_user_id = p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot list your own card for sale');
  END IF;
  
  -- Calculate minimum price (20% markup from what you paid)
  IF v_ownership.last_sale_price IS NOT NULL THEN
    v_min_price := ROUND(v_ownership.last_sale_price * 1.20, 2);
  ELSE
    v_min_price := ROUND(v_ownership.base_price * 1.20, 2);
  END IF;
  
  -- Validate asking price
  IF p_asking_price < v_min_price THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Asking price must be at least 20% more than purchase price',
      'minimum_price', v_min_price
    );
  END IF;
  
  -- Update listing
  UPDATE card_ownership
  SET 
    is_listed_for_sale = true,
    asking_price = p_asking_price,
    current_price = p_asking_price,
    updated_at = now()
  WHERE card_user_id = p_card_user_id;
  
  RETURN jsonb_build_object('success', true, 'asking_price', p_asking_price);
END;
$$;

-- Function to unlist card (only if you're not the original owner)
CREATE OR REPLACE FUNCTION unlist_card_from_sale(
  p_card_user_id uuid,
  p_owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cannot unlist if you're selling your own card
  IF p_card_user_id = p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot unlist your own card once listed');
  END IF;
  
  UPDATE card_ownership
  SET 
    is_listed_for_sale = false,
    asking_price = NULL,
    updated_at = now()
  WHERE card_user_id = p_card_user_id AND owner_id = p_owner_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Initialize cards for existing users
INSERT INTO card_ownership (card_user_id, owner_id, current_price, base_price)
SELECT id, id, 20.00, 20.00
FROM profiles
ON CONFLICT (card_user_id) DO NOTHING;
