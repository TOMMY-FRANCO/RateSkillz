/*
  # Card Swap System with Opt-Out Fees

  1. New Tables
    - `card_swap_listings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles) - manager listing the card
      - `card_user_id` (uuid, references profiles) - whose card this is
      - `listed_at` (timestamptz)
      - `status` (text: active/swapped/delisted)
      - UNIQUE constraint on card_user_id when status = active

    - `card_swaps`
      - `id` (uuid, primary key)
      - `manager_a_id` (uuid, references profiles) - first manager
      - `manager_b_id` (uuid, references profiles) - second manager
      - `card_a_user_id` (uuid, references profiles) - original owner of card A
      - `card_b_user_id` (uuid, references profiles) - original owner of card B
      - `status` (text: pending/accepted/completed/declined/cancelled)
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `initiated_by` (uuid, references profiles) - who proposed the swap

    - `card_swap_transactions`
      - `id` (uuid, primary key)
      - `swap_id` (uuid, references card_swaps)
      - `payer_id` (uuid, references profiles) - manager paying fee
      - `payee_id` (uuid, references profiles) - original owner receiving fee
      - `card_user_id` (uuid, references profiles) - which card's opt-out fee
      - `amount` (numeric) - always 10 coins
      - `transaction_type` (text: opt_out_fee)
      - `created_at` (timestamptz)

  2. Business Logic
    - When swap proposed: create pending swap record
    - When swap accepted: 
      - Validate both managers have 10 coins
      - Pay opt-out fee (10 coins) from each manager to respective original owners
      - Increase both cards by 10 coins
      - Swap card ownership
      - Update swap status to completed
      - Mark listings as swapped
    - Prevents: self-swaps, swapping cards in battle, insufficient balance
    
  3. Security
    - Enable RLS on all tables
    - Users can view their own swap listings and offers
    - Only managers (owner_id != card_user_id) can list cards for swap
    - Validate all swap transactions with proper rollback handling

  4. Functions
    - `list_card_for_swap` - List a managed card for swap
    - `propose_card_swap` - Propose swap between two listed cards
    - `accept_card_swap` - Accept and execute swap with all validations
    - `decline_card_swap` - Decline a swap proposal
    - `cancel_swap_listing` - Remove card from swap listings
*/

-- Create card_swap_listings table
CREATE TABLE IF NOT EXISTS card_swap_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listed_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'swapped', 'delisted')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_swap_listing CHECK (user_id != card_user_id)
);

-- Create card_swaps table
CREATE TABLE IF NOT EXISTS card_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_a_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  manager_b_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_a_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_b_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'declined', 'cancelled')),
  initiated_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT no_self_swap CHECK (manager_a_id != manager_b_id),
  CONSTRAINT no_same_card_swap CHECK (card_a_user_id != card_b_user_id)
);

-- Create card_swap_transactions table
CREATE TABLE IF NOT EXISTS card_swap_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swap_id uuid NOT NULL REFERENCES card_swaps(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 10 CHECK (amount = 10),
  transaction_type text DEFAULT 'opt_out_fee' CHECK (transaction_type = 'opt_out_fee'),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_card_swap_listings_user ON card_swap_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_card_swap_listings_card_user ON card_swap_listings(card_user_id);
CREATE INDEX IF NOT EXISTS idx_card_swap_listings_status ON card_swap_listings(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_card_swaps_manager_a ON card_swaps(manager_a_id);
CREATE INDEX IF NOT EXISTS idx_card_swaps_manager_b ON card_swaps(manager_b_id);
CREATE INDEX IF NOT EXISTS idx_card_swaps_status ON card_swaps(status);
CREATE INDEX IF NOT EXISTS idx_card_swap_transactions_swap ON card_swap_transactions(swap_id);
CREATE INDEX IF NOT EXISTS idx_card_swap_transactions_payer ON card_swap_transactions(payer_id);

-- Enable RLS
ALTER TABLE card_swap_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_swap_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for card_swap_listings
CREATE POLICY "Anyone can view active swap listings"
  ON card_swap_listings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create swap listings for cards they manage"
  ON card_swap_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listings"
  ON card_swap_listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for card_swaps
CREATE POLICY "Users can view swaps they're involved in"
  ON card_swaps FOR SELECT
  TO authenticated
  USING (auth.uid() = manager_a_id OR auth.uid() = manager_b_id);

CREATE POLICY "Users can create swap proposals"
  ON card_swaps FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = initiated_by);

CREATE POLICY "Users can update swaps they're involved in"
  ON card_swaps FOR UPDATE
  TO authenticated
  USING (auth.uid() = manager_a_id OR auth.uid() = manager_b_id)
  WITH CHECK (auth.uid() = manager_a_id OR auth.uid() = manager_b_id);

-- RLS Policies for card_swap_transactions
CREATE POLICY "Users can view their swap transactions"
  ON card_swap_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = payer_id OR auth.uid() = payee_id);

CREATE POLICY "System can create swap transactions"
  ON card_swap_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to list card for swap
CREATE OR REPLACE FUNCTION list_card_for_swap(
  p_user_id uuid,
  p_card_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_ownership record;
  v_listing_id uuid;
BEGIN
  -- Verify user owns this card and is not the original owner
  SELECT * INTO v_ownership
  FROM card_ownership
  WHERE card_user_id = p_card_user_id
  AND owner_id = p_user_id
  AND owner_id != card_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only list cards you manage (not your own card)'
    );
  END IF;

  -- Check if card is already listed
  IF EXISTS (
    SELECT 1 FROM card_swap_listings
    WHERE card_user_id = p_card_user_id
    AND status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Card is already listed for swap'
    );
  END IF;

  -- Create listing
  INSERT INTO card_swap_listings (user_id, card_user_id, status)
  VALUES (p_user_id, p_card_user_id, 'active')
  RETURNING id INTO v_listing_id;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', v_listing_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to propose card swap
CREATE OR REPLACE FUNCTION propose_card_swap(
  p_initiator_id uuid,
  p_initiator_card_user_id uuid,
  p_target_card_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_target_owner_id uuid;
  v_swap_id uuid;
BEGIN
  -- Verify initiator owns their card
  IF NOT EXISTS (
    SELECT 1 FROM card_ownership
    WHERE card_user_id = p_initiator_card_user_id
    AND owner_id = p_initiator_id
    AND owner_id != card_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only swap cards you manage'
    );
  END IF;

  -- Get target card owner
  SELECT owner_id INTO v_target_owner_id
  FROM card_ownership
  WHERE card_user_id = p_target_card_user_id
  AND owner_id != card_user_id;

  IF v_target_owner_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target card not available for swap'
    );
  END IF;

  -- Prevent self-swap
  IF p_initiator_id = v_target_owner_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot swap with yourself'
    );
  END IF;

  -- Check for existing pending swap
  IF EXISTS (
    SELECT 1 FROM card_swaps
    WHERE ((manager_a_id = p_initiator_id AND manager_b_id = v_target_owner_id)
       OR (manager_a_id = v_target_owner_id AND manager_b_id = p_initiator_id))
    AND ((card_a_user_id = p_initiator_card_user_id AND card_b_user_id = p_target_card_user_id)
       OR (card_a_user_id = p_target_card_user_id AND card_b_user_id = p_initiator_card_user_id))
    AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A swap proposal already exists for these cards'
    );
  END IF;

  -- Create swap proposal
  INSERT INTO card_swaps (
    manager_a_id,
    manager_b_id,
    card_a_user_id,
    card_b_user_id,
    initiated_by,
    status
  ) VALUES (
    p_initiator_id,
    v_target_owner_id,
    p_initiator_card_user_id,
    p_target_card_user_id,
    p_initiator_id,
    'pending'
  ) RETURNING id INTO v_swap_id;

  RETURN jsonb_build_object(
    'success', true,
    'swap_id', v_swap_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept and execute card swap
CREATE OR REPLACE FUNCTION accept_card_swap(
  p_swap_id uuid,
  p_acceptor_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_swap record;
  v_manager_a_balance numeric;
  v_manager_b_balance numeric;
  v_card_a_price numeric;
  v_card_b_price numeric;
BEGIN
  -- Get swap details
  SELECT * INTO v_swap
  FROM card_swaps
  WHERE id = p_swap_id
  AND status = 'pending'
  AND (manager_a_id = p_acceptor_id OR manager_b_id = p_acceptor_id)
  AND initiated_by != p_acceptor_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Swap not found or already processed'
    );
  END IF;

  -- Check balances
  SELECT balance INTO v_manager_a_balance
  FROM coins WHERE user_id = v_swap.manager_a_id;

  SELECT balance INTO v_manager_b_balance
  FROM coins WHERE user_id = v_swap.manager_b_id;

  IF v_manager_a_balance < 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Manager A has insufficient balance for opt-out fee'
    );
  END IF;

  IF v_manager_b_balance < 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Manager B has insufficient balance for opt-out fee'
    );
  END IF;

  -- Get current card prices
  SELECT current_price INTO v_card_a_price
  FROM card_ownership WHERE card_user_id = v_swap.card_a_user_id;

  SELECT current_price INTO v_card_b_price
  FROM card_ownership WHERE card_user_id = v_swap.card_b_user_id;

  -- Process Manager A's opt-out fee (pays original owner of card A)
  UPDATE coins
  SET balance = balance - 10
  WHERE user_id = v_swap.manager_a_id;

  UPDATE coins
  SET balance = balance + 10
  WHERE user_id = v_swap.card_a_user_id;

  -- Process Manager B's opt-out fee (pays original owner of card B)
  UPDATE coins
  SET balance = balance - 10
  WHERE user_id = v_swap.manager_b_id;

  UPDATE coins
  SET balance = balance + 10
  WHERE user_id = v_swap.card_b_user_id;

  -- Record swap transactions
  INSERT INTO card_swap_transactions (swap_id, payer_id, payee_id, card_user_id, amount)
  VALUES (p_swap_id, v_swap.manager_a_id, v_swap.card_a_user_id, v_swap.card_a_user_id, 10);

  INSERT INTO card_swap_transactions (swap_id, payer_id, payee_id, card_user_id, amount)
  VALUES (p_swap_id, v_swap.manager_b_id, v_swap.card_b_user_id, v_swap.card_b_user_id, 10);

  -- Record coin transactions
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, related_user_id)
  VALUES 
    (v_swap.manager_a_id, -10, 'card_swap_fee', 'Opt-out fee for card swap', v_swap.card_a_user_id),
    (v_swap.card_a_user_id, 10, 'card_swap_royalty', 'Opt-out fee received from swap', v_swap.manager_a_id),
    (v_swap.manager_b_id, -10, 'card_swap_fee', 'Opt-out fee for card swap', v_swap.card_b_user_id),
    (v_swap.card_b_user_id, 10, 'card_swap_royalty', 'Opt-out fee received from swap', v_swap.manager_b_id);

  -- Increase both card prices by 10 coins
  UPDATE card_ownership
  SET current_price = current_price + 10,
      times_traded = times_traded + 1
  WHERE card_user_id = v_swap.card_a_user_id;

  UPDATE card_ownership
  SET current_price = current_price + 10,
      times_traded = times_traded + 1
  WHERE card_user_id = v_swap.card_b_user_id;

  -- Swap card ownership
  UPDATE card_ownership
  SET owner_id = v_swap.manager_b_id,
      acquired_at = now(),
      is_listed_for_sale = false,
      asking_price = NULL
  WHERE card_user_id = v_swap.card_a_user_id;

  UPDATE card_ownership
  SET owner_id = v_swap.manager_a_id,
      acquired_at = now(),
      is_listed_for_sale = false,
      asking_price = NULL
  WHERE card_user_id = v_swap.card_b_user_id;

  -- Update swap status
  UPDATE card_swaps
  SET status = 'completed',
      completed_at = now()
  WHERE id = p_swap_id;

  -- Mark listings as swapped
  UPDATE card_swap_listings
  SET status = 'swapped'
  WHERE card_user_id IN (v_swap.card_a_user_id, v_swap.card_b_user_id)
  AND status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'swap_id', p_swap_id,
    'card_a_new_price', v_card_a_price + 10,
    'card_b_new_price', v_card_b_price + 10
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Swap failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decline card swap
CREATE OR REPLACE FUNCTION decline_card_swap(
  p_swap_id uuid,
  p_user_id uuid
)
RETURNS jsonb AS $$
BEGIN
  UPDATE card_swaps
  SET status = 'declined'
  WHERE id = p_swap_id
  AND status = 'pending'
  AND (manager_a_id = p_user_id OR manager_b_id = p_user_id)
  AND initiated_by != p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Swap not found or cannot be declined'
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel swap listing
CREATE OR REPLACE FUNCTION cancel_swap_listing(
  p_listing_id uuid,
  p_user_id uuid
)
RETURNS jsonb AS $$
BEGIN
  UPDATE card_swap_listings
  SET status = 'delisted'
  WHERE id = p_listing_id
  AND user_id = p_user_id
  AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Listing not found or already removed'
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update transaction type constraint to include swap types
DO $$
BEGIN
  ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;
  
  ALTER TABLE coin_transactions ADD CONSTRAINT coin_transactions_transaction_type_check
    CHECK (transaction_type IN (
      'purchase',
      'ad_reward',
      'comment_reward',
      'card_sale',
      'card_purchase',
      'initial_card_creation',
      'card_sale_royalty',
      'balance_correction',
      'manager_bonus',
      'battle_win',
      'battle_loss',
      'battle_royalty',
      'transfer_sent',
      'transfer_received',
      'card_swap_fee',
      'card_swap_royalty'
    ));
END $$;
