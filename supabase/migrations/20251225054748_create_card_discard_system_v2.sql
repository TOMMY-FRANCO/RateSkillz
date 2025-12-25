/*
  # Card Discard System

  1. New Tables
    - `card_discards`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to profiles) - user who discarded the card
      - `card_user_id` (uuid, FK to profiles) - the player whose card was discarded
      - `original_owner_id` (uuid, FK to profiles) - original owner receiving payment
      - `card_price_at_discard` (numeric) - card price at discard time
      - `bonus_amount` (numeric, default 10) - bonus payment to original owner
      - `total_paid` (numeric) - total amount paid (card_price + bonus)
      - `card_value_before` (numeric) - card value before discard
      - `card_value_after` (numeric) - card value after discard (increased by 10)
      - `created_at` (timestamp)

  2. Functions
    - `discard_card()` - handles complete discard transaction
    - `get_user_cards_for_discard()` - fetches user's cards with discard info
    - `get_discard_history()` - retrieves user's discard history

  3. Security
    - Enable RLS on card_discards
    - Users can view their own discard history
    - Authenticated users can discard their own cards

  4. Notes
    - User pays card_price + 10 coins bonus to original owner
    - Card value increases by 10 coins
    - Card removed from user's inventory
    - Cannot discard cards locked in battle
    - Cannot discard if insufficient coins
*/

-- Create card_discards table
CREATE TABLE IF NOT EXISTS card_discards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  card_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  original_owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  card_price_at_discard numeric NOT NULL,
  bonus_amount numeric DEFAULT 10 NOT NULL,
  total_paid numeric NOT NULL,
  card_value_before numeric NOT NULL,
  card_value_after numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE card_discards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for card_discards
DROP POLICY IF EXISTS "Users can view their own discard history" ON card_discards;
CREATE POLICY "Users can view their own discard history"
  ON card_discards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own discards" ON card_discards;
CREATE POLICY "Users can insert their own discards"
  ON card_discards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_card_discards_user_id ON card_discards(user_id);
CREATE INDEX IF NOT EXISTS idx_card_discards_original_owner ON card_discards(original_owner_id);
CREATE INDEX IF NOT EXISTS idx_card_discards_created_at ON card_discards(created_at DESC);

-- Function to get user's cards available for discard
CREATE OR REPLACE FUNCTION get_user_cards_for_discard(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  card_user_id uuid,
  owner_id uuid,
  original_owner_id uuid,
  current_price numeric,
  base_price numeric,
  times_traded integer,
  acquired_at timestamptz,
  is_locked_in_battle boolean,
  player_username text,
  player_full_name text,
  player_avatar_url text,
  original_owner_username text,
  original_owner_full_name text,
  discard_cost numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    co.id,
    co.card_user_id,
    co.owner_id,
    co.original_owner_id,
    co.current_price,
    co.base_price,
    co.times_traded,
    co.acquired_at,
    COALESCE(co.is_locked_in_battle, false) as is_locked_in_battle,
    p1.username as player_username,
    p1.full_name as player_full_name,
    p1.avatar_url as player_avatar_url,
    p2.username as original_owner_username,
    p2.full_name as original_owner_full_name,
    (co.current_price + 10) as discard_cost
  FROM card_ownership co
  INNER JOIN profiles p1 ON co.card_user_id = p1.id
  LEFT JOIN profiles p2 ON co.original_owner_id = p2.id
  WHERE co.owner_id = p_user_id
  AND COALESCE(co.is_locked_in_battle, false) = false
  ORDER BY co.acquired_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to discard a card
CREATE OR REPLACE FUNCTION discard_card(
  p_user_id uuid,
  p_card_ownership_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_card_record RECORD;
  v_user_balance numeric;
  v_total_cost numeric;
  v_card_price numeric;
  v_bonus numeric := 10;
  v_original_owner_id uuid;
  v_new_card_value numeric;
  v_discard_id uuid;
BEGIN
  -- Get card details and verify ownership
  SELECT 
    co.card_user_id,
    co.owner_id,
    co.original_owner_id,
    co.current_price,
    co.is_locked_in_battle,
    p.username as player_username,
    p.full_name as player_full_name
  INTO v_card_record
  FROM card_ownership co
  INNER JOIN profiles p ON co.card_user_id = p.id
  WHERE co.id = p_card_ownership_id;

  -- Validate card exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Card not found'
    );
  END IF;

  -- Validate ownership
  IF v_card_record.owner_id != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You do not own this card'
    );
  END IF;

  -- Check if card is locked in battle
  IF COALESCE(v_card_record.is_locked_in_battle, false) = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot discard card locked in battle'
    );
  END IF;

  -- Get user's coin balance
  SELECT COALESCE(coin_balance, 0) INTO v_user_balance
  FROM profiles
  WHERE id = p_user_id;

  -- Calculate costs
  v_card_price := v_card_record.current_price;
  v_total_cost := v_card_price + v_bonus;

  -- Validate sufficient balance
  IF v_user_balance < v_total_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient coins. You need ' || v_total_cost || ' coins to discard this card.'
    );
  END IF;

  v_original_owner_id := v_card_record.original_owner_id;
  v_new_card_value := v_card_price + 10;

  -- Deduct coins from user
  UPDATE profiles
  SET coin_balance = coin_balance - v_total_cost
  WHERE id = p_user_id;

  -- Pay original owner (if exists and not the current user)
  IF v_original_owner_id IS NOT NULL AND v_original_owner_id != p_user_id THEN
    UPDATE profiles
    SET coin_balance = coin_balance + v_total_cost
    WHERE id = v_original_owner_id;
  END IF;

  -- Increase card value
  UPDATE card_ownership
  SET current_price = v_new_card_value
  WHERE card_user_id = v_card_record.card_user_id;

  -- Record discard in history
  INSERT INTO card_discards (
    user_id,
    card_user_id,
    original_owner_id,
    card_price_at_discard,
    bonus_amount,
    total_paid,
    card_value_before,
    card_value_after
  ) VALUES (
    p_user_id,
    v_card_record.card_user_id,
    v_original_owner_id,
    v_card_price,
    v_bonus,
    v_total_cost,
    v_card_price,
    v_new_card_value
  ) RETURNING id INTO v_discard_id;

  -- Log coin transaction for user (payment)
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    related_user_id
  ) VALUES (
    p_user_id,
    -v_total_cost,
    'card_discard',
    'Discarded card: ' || v_card_record.player_username || ' (Price: ' || v_card_price || ' + Bonus: ' || v_bonus || ')',
    v_original_owner_id
  );

  -- Log coin transaction for original owner (received payment)
  IF v_original_owner_id IS NOT NULL AND v_original_owner_id != p_user_id THEN
    INSERT INTO coin_transactions (
      user_id,
      amount,
      transaction_type,
      description,
      related_user_id
    ) VALUES (
      v_original_owner_id,
      v_total_cost,
      'card_discard_payment',
      'Received discard payment for card: ' || v_card_record.player_username,
      p_user_id
    );
  END IF;

  -- Remove card from user's inventory
  DELETE FROM card_ownership
  WHERE id = p_card_ownership_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'discard_id', v_discard_id,
    'card_user_id', v_card_record.card_user_id,
    'total_paid', v_total_cost,
    'card_price', v_card_price,
    'bonus', v_bonus,
    'original_owner_id', v_original_owner_id,
    'new_card_value', v_new_card_value
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Discard failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's discard history
CREATE OR REPLACE FUNCTION get_discard_history(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  card_user_id uuid,
  original_owner_id uuid,
  card_price_at_discard numeric,
  bonus_amount numeric,
  total_paid numeric,
  card_value_before numeric,
  card_value_after numeric,
  created_at timestamptz,
  player_username text,
  player_full_name text,
  player_avatar_url text,
  original_owner_username text,
  original_owner_full_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cd.id,
    cd.card_user_id,
    cd.original_owner_id,
    cd.card_price_at_discard,
    cd.bonus_amount,
    cd.total_paid,
    cd.card_value_before,
    cd.card_value_after,
    cd.created_at,
    p1.username as player_username,
    p1.full_name as player_full_name,
    p1.avatar_url as player_avatar_url,
    p2.username as original_owner_username,
    p2.full_name as original_owner_full_name
  FROM card_discards cd
  INNER JOIN profiles p1 ON cd.card_user_id = p1.id
  LEFT JOIN profiles p2 ON cd.original_owner_id = p2.id
  WHERE cd.user_id = p_user_id
  ORDER BY cd.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
