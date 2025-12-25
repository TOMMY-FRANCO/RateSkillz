/*
  # Add Leaderboard Columns

  1. Changes to `card_ownership`
    - Add `original_owner_id` (uuid, FK to profiles) - tracks who first owned/created the card
    - Set existing cards' original_owner_id to current owner_id

  2. Changes to `profiles`
    - Add `manager_losses` (integer) - tracks battle losses for managers
    - Add `total_battle_earnings` (numeric) - tracks total coins earned from battles

  3. Security
    - No RLS changes needed

  4. Notes
    - Original owner is set on card creation and never changes
    - Useful for showing card provenance and value history
    - Battle stats help rank managers by performance
*/

-- Add original_owner_id to card_ownership
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_ownership' AND column_name = 'original_owner_id'
  ) THEN
    ALTER TABLE card_ownership
    ADD COLUMN original_owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

    -- Set original_owner_id to current owner_id for existing cards
    UPDATE card_ownership
    SET original_owner_id = owner_id
    WHERE original_owner_id IS NULL;
  END IF;
END $$;

-- Add manager_losses to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'manager_losses'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN manager_losses integer DEFAULT 0;
  END IF;
END $$;

-- Add total_battle_earnings to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'total_battle_earnings'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN total_battle_earnings numeric DEFAULT 0;
  END IF;
END $$;

-- Create index on current_price for efficient sorting
CREATE INDEX IF NOT EXISTS idx_card_ownership_current_price ON card_ownership(current_price DESC);

-- Create index on manager_wins for efficient sorting
CREATE INDEX IF NOT EXISTS idx_profiles_manager_wins ON profiles(manager_wins DESC) WHERE is_manager = true;

-- Create index on card_user_id for lookups
CREATE INDEX IF NOT EXISTS idx_card_ownership_card_user_id ON card_ownership(card_user_id);
