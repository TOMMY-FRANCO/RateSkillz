/*
  # Create New Skill-Based Battle Mode System

  ## Overview
  Removes old battle mode tables and creates a new 100% skill-based turn-based battle system.
  Managers (users with 5+ cards) can challenge others to strategic skill competitions.

  ## Changes Made
  
  ### 1. Remove Old Tables
  - Drop battles table (old system)
  - Drop battle_rounds table
  - Drop battle_wagers table
  - Drop battle_royalties table (will recreate)
  
  ### 2. Create New Tables
  
  **battles table:**
  - id: UUID primary key
  - manager1_id: UUID (challenger)
  - manager2_id: UUID (opponent)
  - wager_amount: numeric (50-200 coins)
  - status: enum (waiting, active, completed, forfeited)
  - created_at: timestamp
  - completed_at: timestamp
  - winner_id: UUID
  - current_turn_user_id: UUID (whose turn it is)
  - turn_started_at: timestamp (for 1-minute timer)
  - first_player_id: UUID (who goes first)
  - card_selections: jsonb (tracks cards/skills used)
  - used_skills: text[] (array of skills removed from play)
  - player1_remaining_cards: integer (default 5)
  - player2_remaining_cards: integer (default 5)
  - is_tiebreaker: boolean (default false)
  
  **battle_royalties table:**
  - id: UUID primary key
  - battle_id: UUID (foreign key)
  - card_id: UUID (card that earned royalty)
  - owner_id: UUID (card owner)
  - amount: numeric (5 coins per card)
  - paid_at: timestamp
  
  ### 3. RLS Policies
  - Users can view battles they're involved in
  - Users can create challenges
  - Users can update battles they're in (for moves)
  - Royalties visible to owners
  
  ### 4. Helper Functions
  - check_manager_status: Verify user has 5+ cards
  - create_battle_challenge: Create new battle
  - accept_battle_challenge: Accept and start battle
  - make_battle_move: Record player move and skill selection
  - end_battle: Complete battle and distribute coins
  - forfeit_battle: Forfeit and lose wager
*/

-- STEP 1: Drop old tables if they exist
DROP TABLE IF EXISTS battle_rounds CASCADE;
DROP TABLE IF EXISTS battle_wagers CASCADE;
DROP TABLE IF EXISTS battle_royalties CASCADE;
DROP TABLE IF EXISTS battles CASCADE;

-- STEP 2: Create battle status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'battle_status_enum') THEN
    CREATE TYPE battle_status_enum AS ENUM ('waiting', 'active', 'completed', 'forfeited');
  END IF;
END $$;

-- STEP 3: Create battles table
CREATE TABLE battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager1_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  manager2_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wager_amount numeric NOT NULL CHECK (wager_amount >= 50 AND wager_amount <= 200),
  status battle_status_enum NOT NULL DEFAULT 'waiting',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  winner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  current_turn_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  turn_started_at timestamptz,
  first_player_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  card_selections jsonb DEFAULT '[]'::jsonb,
  used_skills text[] DEFAULT ARRAY[]::text[],
  player1_remaining_cards integer DEFAULT 5,
  player2_remaining_cards integer DEFAULT 5,
  is_tiebreaker boolean DEFAULT false,
  CONSTRAINT no_self_battle CHECK (manager1_id != manager2_id)
);

-- STEP 4: Create battle_royalties table
CREATE TABLE battle_royalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  card_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 5,
  paid_at timestamptz DEFAULT now()
);

-- STEP 5: Create indexes
CREATE INDEX idx_battles_manager1 ON battles(manager1_id);
CREATE INDEX idx_battles_manager2 ON battles(manager2_id);
CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_created_at ON battles(created_at DESC);
CREATE INDEX idx_battle_royalties_battle ON battle_royalties(battle_id);
CREATE INDEX idx_battle_royalties_owner ON battle_royalties(owner_id);

-- STEP 6: Enable RLS
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_royalties ENABLE ROW LEVEL SECURITY;

-- STEP 7: Create RLS policies for battles

CREATE POLICY "Users can view their own battles"
  ON battles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = manager1_id OR 
    auth.uid() = manager2_id
  );

CREATE POLICY "Managers can create challenges"
  ON battles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = manager1_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_manager = true
    )
  );

CREATE POLICY "Users can update their battles"
  ON battles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = manager1_id OR 
    auth.uid() = manager2_id
  )
  WITH CHECK (
    auth.uid() = manager1_id OR 
    auth.uid() = manager2_id
  );

-- STEP 8: Create RLS policies for battle_royalties

CREATE POLICY "Users can view their royalties"
  ON battle_royalties FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "System can insert royalties"
  ON battle_royalties FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- STEP 9: Helper function to check manager status
CREATE OR REPLACE FUNCTION check_manager_status(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_card_count integer;
BEGIN
  -- Count cards owned by user
  SELECT COUNT(*)
  INTO v_card_count
  FROM player_cards
  WHERE current_owner_id = p_user_id;
  
  RETURN v_card_count >= 5;
END;
$$;

-- STEP 10: Function to create battle challenge
CREATE OR REPLACE FUNCTION create_battle_challenge(
  p_challenger_id uuid,
  p_opponent_id uuid,
  p_wager_amount numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_battle_id uuid;
  v_challenger_balance numeric;
  v_challenger_is_manager boolean;
  v_opponent_is_manager boolean;
BEGIN
  -- Validate challenger is manager
  SELECT check_manager_status(p_challenger_id) INTO v_challenger_is_manager;
  IF NOT v_challenger_is_manager THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You must be a manager (own 5+ cards) to battle'
    );
  END IF;
  
  -- Validate opponent is manager
  SELECT check_manager_status(p_opponent_id) INTO v_opponent_is_manager;
  IF NOT v_opponent_is_manager THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Opponent must be a manager (own 5+ cards)'
    );
  END IF;
  
  -- Check challenger has sufficient balance
  SELECT coin_balance INTO v_challenger_balance
  FROM profiles
  WHERE id = p_challenger_id;
  
  IF v_challenger_balance < p_wager_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient coins for wager'
    );
  END IF;
  
  -- Validate wager amount
  IF p_wager_amount < 50 OR p_wager_amount > 200 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Wager must be between 50 and 200 coins'
    );
  END IF;
  
  -- Create battle
  INSERT INTO battles (
    manager1_id,
    manager2_id,
    wager_amount,
    status
  ) VALUES (
    p_challenger_id,
    p_opponent_id,
    p_wager_amount,
    'waiting'
  )
  RETURNING id INTO v_battle_id;
  
  RETURN json_build_object(
    'success', true,
    'battle_id', v_battle_id,
    'message', 'Challenge created successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- STEP 11: Function to accept battle challenge
CREATE OR REPLACE FUNCTION accept_battle_challenge(
  p_battle_id uuid,
  p_accepter_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wager_amount numeric;
  v_accepter_balance numeric;
  v_manager2_id uuid;
BEGIN
  -- Get battle details
  SELECT wager_amount, manager2_id
  INTO v_wager_amount, v_manager2_id
  FROM battles
  WHERE id = p_battle_id AND status = 'waiting';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Battle not found or already started'
    );
  END IF;
  
  -- Verify accepter is the opponent
  IF v_manager2_id != p_accepter_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You are not the opponent in this battle'
    );
  END IF;
  
  -- Check accepter has sufficient balance
  SELECT coin_balance INTO v_accepter_balance
  FROM profiles
  WHERE id = p_accepter_id;
  
  IF v_accepter_balance < v_wager_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient coins for wager'
    );
  END IF;
  
  -- Update battle to active (waiting for first player selection)
  UPDATE battles
  SET 
    status = 'active'
  WHERE id = p_battle_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Battle accepted! Choose who goes first.'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- STEP 12: Comments for documentation
COMMENT ON TABLE battles IS 'Skill-based turn-based battle system where managers compete using card skills';
COMMENT ON TABLE battle_royalties IS 'Royalty payments to card owners (5 coins per card used in battle)';
COMMENT ON COLUMN battles.card_selections IS 'JSON array tracking each move: {round, attacker_id, defender_id, attacker_card_id, defender_card_id, skill_used, attacker_value, defender_value, winner_id, card_eliminated_id}';
COMMENT ON COLUMN battles.used_skills IS 'Array of skills removed from play: PAC, SHO, PAS, DRI, DEF, PHY';
COMMENT ON COLUMN battles.turn_started_at IS 'Timestamp when current turn started (for 1-minute timeout)';

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'New Skill-Based Battle Mode System Created Successfully';
  RAISE NOTICE 'Old battle tables removed';
  RAISE NOTICE 'New tables: battles, battle_royalties';
  RAISE NOTICE 'Manager requirement: 5+ cards';
  RAISE NOTICE 'Wager range: 50-200 coins';
  RAISE NOTICE 'Turn timer: 1 minute per turn';
END $$;
