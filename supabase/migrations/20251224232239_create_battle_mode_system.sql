/*
  # Battle Mode System - Complete Implementation

  1. Manager System
    - Add `is_manager` and `manager_upgrade_date` to profiles table
    - Managers are users who own 5+ cards
    - One-time 100 coin bonus awarded on manager upgrade

  2. New Tables
    - `battles` - Main battle tracking table
    - `battle_rounds` - Individual round tracking
    - `battle_wagers` - Wager tracking and settlement
    - `battle_royalties` - Royalty payments to original card owners

  3. Security
    - Enable RLS on all new tables
    - Add policies for managers to create/view battles
    - Add policies for original owners to view their royalties

  4. Functions
    - `check_and_upgrade_to_manager()` - Auto-upgrade users to manager at 5+ cards
    - `create_battle_challenge()` - Create new battle challenge
    - `accept_battle_challenge()` - Accept opponent's challenge
    - `cancel_battle_challenge()` - Cancel waiting battle
*/

-- Add manager fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_manager'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_manager boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'manager_upgrade_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN manager_upgrade_date timestamptz;
  END IF;
END $$;

-- Add locking fields to card_ownership table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_ownership' AND column_name = 'is_locked_in_battle'
  ) THEN
    ALTER TABLE card_ownership ADD COLUMN is_locked_in_battle boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_ownership' AND column_name = 'locked_since'
  ) THEN
    ALTER TABLE card_ownership ADD COLUMN locked_since timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_ownership' AND column_name = 'locked_in_battle_id'
  ) THEN
    ALTER TABLE card_ownership ADD COLUMN locked_in_battle_id uuid;
  END IF;
END $$;

-- Create battles table
CREATE TABLE IF NOT EXISTS battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager1_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  manager2_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  manager1_selected_cards jsonb NOT NULL,
  manager2_selected_cards jsonb,
  wager_amount integer NOT NULL CHECK (wager_amount >= 50 AND wager_amount <= 200),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'cancelled', 'expired')),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  winner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  round_results jsonb DEFAULT '[]'::jsonb,
  penalty_shot_used boolean DEFAULT false,
  manager1_score integer DEFAULT 0,
  manager2_score integer DEFAULT 0
);

-- Create battle_rounds table
CREATE TABLE IF NOT EXISTS battle_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid REFERENCES battles(id) ON DELETE CASCADE NOT NULL,
  round_number integer NOT NULL CHECK (round_number >= 1 AND round_number <= 5),
  card1_id uuid NOT NULL,
  card2_id uuid NOT NULL,
  stat_used text NOT NULL CHECK (stat_used IN ('PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY')),
  card1_stat_value integer NOT NULL,
  card2_stat_value integer NOT NULL,
  winning_card_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create battle_wagers table
CREATE TABLE IF NOT EXISTS battle_wagers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid REFERENCES battles(id) ON DELETE CASCADE NOT NULL,
  manager_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount_wagered decimal NOT NULL,
  amount_won decimal,
  amount_lost decimal,
  created_at timestamptz DEFAULT now()
);

-- Create battle_royalties table
CREATE TABLE IF NOT EXISTS battle_royalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid REFERENCES battles(id) ON DELETE CASCADE NOT NULL,
  original_owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  card_id uuid NOT NULL,
  amount_earned decimal NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_wagers ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_royalties ENABLE ROW LEVEL SECURITY;

-- RLS Policies for battles
CREATE POLICY "Users can view their own battles"
  ON battles FOR SELECT
  TO authenticated
  USING (auth.uid() = manager1_id OR auth.uid() = manager2_id);

CREATE POLICY "Managers can view available challenges"
  ON battles FOR SELECT
  TO authenticated
  USING (status = 'waiting' AND manager2_id IS NULL);

CREATE POLICY "Managers can create battles"
  ON battles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = manager1_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_manager = true)
  );

CREATE POLICY "Managers can update their battles"
  ON battles FOR UPDATE
  TO authenticated
  USING (auth.uid() = manager1_id OR auth.uid() = manager2_id);

-- RLS Policies for battle_rounds
CREATE POLICY "Users can view rounds from their battles"
  ON battle_rounds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM battles
      WHERE battles.id = battle_rounds.battle_id
      AND (battles.manager1_id = auth.uid() OR battles.manager2_id = auth.uid())
    )
  );

CREATE POLICY "System can insert battle rounds"
  ON battle_rounds FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for battle_wagers
CREATE POLICY "Users can view their own wagers"
  ON battle_wagers FOR SELECT
  TO authenticated
  USING (auth.uid() = manager_id);

CREATE POLICY "System can insert wagers"
  ON battle_wagers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update wagers"
  ON battle_wagers FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for battle_royalties
CREATE POLICY "Users can view their own royalties"
  ON battle_royalties FOR SELECT
  TO authenticated
  USING (auth.uid() = original_owner_id);

CREATE POLICY "System can insert royalties"
  ON battle_royalties FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function: Check and upgrade to manager when user gets 5th card
CREATE OR REPLACE FUNCTION check_and_upgrade_to_manager()
RETURNS TRIGGER AS $$
DECLARE
  card_count integer;
  user_is_manager boolean;
  current_balance decimal;
BEGIN
  -- Count how many cards this user now owns
  SELECT COUNT(*) INTO card_count
  FROM card_ownership
  WHERE owner_id = NEW.owner_id;

  -- Check if user is already a manager
  SELECT is_manager INTO user_is_manager
  FROM profiles
  WHERE id = NEW.owner_id;

  -- If user has 5+ cards and is not already a manager, upgrade them
  IF card_count >= 5 AND (user_is_manager IS NULL OR user_is_manager = false) THEN
    -- Upgrade to manager
    UPDATE profiles
    SET is_manager = true,
        manager_upgrade_date = now()
    WHERE id = NEW.owner_id;

    -- Get current balance
    SELECT balance INTO current_balance
    FROM coins
    WHERE user_id = NEW.owner_id;

    -- Award 100 coins from the coin pool
    UPDATE coins
    SET balance = COALESCE(balance, 0) + 100
    WHERE user_id = NEW.owner_id;

    -- Deduct from coin pool
    UPDATE coin_pool
    SET balance = balance - 100
    WHERE id = 1;

    -- Record transaction
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description, running_balance)
    VALUES (
      NEW.owner_id,
      100,
      'manager_bonus',
      'Manager upgrade bonus - earned by obtaining 5+ cards',
      COALESCE(current_balance, 0) + 100
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for manager upgrade
DROP TRIGGER IF EXISTS trigger_check_manager_upgrade ON card_ownership;
CREATE TRIGGER trigger_check_manager_upgrade
  AFTER INSERT OR UPDATE OF owner_id ON card_ownership
  FOR EACH ROW
  EXECUTE FUNCTION check_and_upgrade_to_manager();

-- Function: Create battle challenge
CREATE OR REPLACE FUNCTION create_battle_challenge(
  p_manager_id uuid,
  p_selected_cards jsonb,
  p_wager_amount integer
)
RETURNS uuid AS $$
DECLARE
  v_battle_id uuid;
  v_card jsonb;
  v_card_id uuid;
  v_manager_balance decimal;
BEGIN
  -- Verify user is a manager
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_manager_id AND is_manager = true) THEN
    RAISE EXCEPTION 'User is not a manager';
  END IF;

  -- Verify exactly 5 cards selected
  IF jsonb_array_length(p_selected_cards) != 5 THEN
    RAISE EXCEPTION 'Must select exactly 5 cards';
  END IF;

  -- Verify manager has sufficient balance
  SELECT balance INTO v_manager_balance
  FROM coins
  WHERE user_id = p_manager_id;

  IF v_manager_balance < p_wager_amount THEN
    RAISE EXCEPTION 'Insufficient balance for wager';
  END IF;

  -- Verify all cards are owned by manager and not locked
  FOR v_card IN SELECT * FROM jsonb_array_elements(p_selected_cards)
  LOOP
    v_card_id := (v_card->>'id')::uuid;

    IF NOT EXISTS (
      SELECT 1 FROM card_ownership
      WHERE id = v_card_id
      AND owner_id = p_manager_id
      AND (is_locked_in_battle IS NULL OR is_locked_in_battle = false)
    ) THEN
      RAISE EXCEPTION 'Card % is not available for battle', v_card_id;
    END IF;
  END LOOP;

  -- Create battle
  INSERT INTO battles (
    manager1_id,
    manager1_selected_cards,
    wager_amount,
    status
  ) VALUES (
    p_manager_id,
    p_selected_cards,
    p_wager_amount,
    'waiting'
  ) RETURNING id INTO v_battle_id;

  -- Lock the cards
  FOR v_card IN SELECT * FROM jsonb_array_elements(p_selected_cards)
  LOOP
    v_card_id := (v_card->>'id')::uuid;

    UPDATE card_ownership
    SET is_locked_in_battle = true,
        locked_since = now(),
        locked_in_battle_id = v_battle_id
    WHERE id = v_card_id;
  END LOOP;

  -- Create wager record
  INSERT INTO battle_wagers (battle_id, manager_id, amount_wagered)
  VALUES (v_battle_id, p_manager_id, p_wager_amount);

  RETURN v_battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Accept battle challenge
CREATE OR REPLACE FUNCTION accept_battle_challenge(
  p_battle_id uuid,
  p_manager_id uuid,
  p_selected_cards jsonb
)
RETURNS boolean AS $$
DECLARE
  v_wager_amount integer;
  v_manager_balance decimal;
  v_card jsonb;
  v_card_id uuid;
BEGIN
  -- Verify user is a manager
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_manager_id AND is_manager = true) THEN
    RAISE EXCEPTION 'User is not a manager';
  END IF;

  -- Verify battle exists and is waiting
  SELECT wager_amount INTO v_wager_amount
  FROM battles
  WHERE id = p_battle_id AND status = 'waiting' AND manager2_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not available';
  END IF;

  -- Verify exactly 5 cards selected
  IF jsonb_array_length(p_selected_cards) != 5 THEN
    RAISE EXCEPTION 'Must select exactly 5 cards';
  END IF;

  -- Verify manager has sufficient balance
  SELECT balance INTO v_manager_balance
  FROM coins
  WHERE user_id = p_manager_id;

  IF v_manager_balance < v_wager_amount THEN
    RAISE EXCEPTION 'Insufficient balance for wager';
  END IF;

  -- Verify all cards are owned by manager and not locked
  FOR v_card IN SELECT * FROM jsonb_array_elements(p_selected_cards)
  LOOP
    v_card_id := (v_card->>'id')::uuid;

    IF NOT EXISTS (
      SELECT 1 FROM card_ownership
      WHERE id = v_card_id
      AND owner_id = p_manager_id
      AND (is_locked_in_battle IS NULL OR is_locked_in_battle = false)
    ) THEN
      RAISE EXCEPTION 'Card % is not available for battle', v_card_id;
    END IF;
  END LOOP;

  -- Update battle
  UPDATE battles
  SET manager2_id = p_manager_id,
      manager2_selected_cards = p_selected_cards,
      status = 'active',
      started_at = now(),
      expires_at = now() + interval '1 hour'
  WHERE id = p_battle_id;

  -- Lock the cards
  FOR v_card IN SELECT * FROM jsonb_array_elements(p_selected_cards)
  LOOP
    v_card_id := (v_card->>'id')::uuid;

    UPDATE card_ownership
    SET is_locked_in_battle = true,
        locked_since = now(),
        locked_in_battle_id = p_battle_id
    WHERE id = v_card_id;
  END LOOP;

  -- Create wager record for manager 2
  INSERT INTO battle_wagers (battle_id, manager_id, amount_wagered)
  VALUES (p_battle_id, p_manager_id, v_wager_amount);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Cancel battle challenge
CREATE OR REPLACE FUNCTION cancel_battle_challenge(p_battle_id uuid, p_manager_id uuid)
RETURNS boolean AS $$
DECLARE
  v_card jsonb;
  v_card_id uuid;
  v_manager1_cards jsonb;
BEGIN
  -- Verify battle exists, is waiting, and belongs to this manager
  SELECT manager1_selected_cards INTO v_manager1_cards
  FROM battles
  WHERE id = p_battle_id
  AND status = 'waiting'
  AND manager1_id = p_manager_id
  AND manager2_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot cancel this battle';
  END IF;

  -- Unlock all cards
  FOR v_card IN SELECT * FROM jsonb_array_elements(v_manager1_cards)
  LOOP
    v_card_id := (v_card->>'id')::uuid;

    UPDATE card_ownership
    SET is_locked_in_battle = false,
        locked_since = NULL,
        locked_in_battle_id = NULL
    WHERE id = v_card_id;
  END LOOP;

  -- Delete battle
  DELETE FROM battles WHERE id = p_battle_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status);
CREATE INDEX IF NOT EXISTS idx_battles_manager1 ON battles(manager1_id);
CREATE INDEX IF NOT EXISTS idx_battles_manager2 ON battles(manager2_id);
CREATE INDEX IF NOT EXISTS idx_battle_rounds_battle_id ON battle_rounds(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_wagers_manager_id ON battle_wagers(manager_id);
CREATE INDEX IF NOT EXISTS idx_battle_royalties_owner_id ON battle_royalties(original_owner_id);
CREATE INDEX IF NOT EXISTS idx_card_ownership_locked ON card_ownership(is_locked_in_battle) WHERE is_locked_in_battle = true;
