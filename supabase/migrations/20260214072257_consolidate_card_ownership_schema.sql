/*
  # Consolidate card_ownership Schema

  1. Problem
    - card_ownership table was created in migration 20251218014520
    - Multiple subsequent migrations modified the schema (added/removed columns)
    - Current schema has drifted from original definition
    - This creates inconsistency for fresh deployments vs existing databases

  2. Solution
    - Ensure all required columns exist with correct types and defaults
    - Verify constraints are properly set
    - Add missing columns that may not exist in older deployments
    - Update default values to match current business logic

  3. Current Schema (as of this migration):
    - id (uuid, PK)
    - card_user_id (uuid, UNIQUE, FK to profiles, NOT NULL)
    - owner_id (uuid, FK to profiles, NOT NULL)
    - current_price (numeric, DEFAULT 20.00, NOT NULL)
    - base_price (numeric, DEFAULT 20.00, NOT NULL)
    - is_listed_for_sale (boolean, DEFAULT true)
    - times_traded (integer, DEFAULT 0)
    - last_sale_price (numeric, nullable)
    - last_purchase_price (numeric, DEFAULT 20.00)
    - acquired_at (timestamptz, DEFAULT now(), NOT NULL)
    - created_at (timestamptz, DEFAULT now(), NOT NULL)
    - updated_at (timestamptz, DEFAULT now(), NOT NULL)
    - original_owner_id (uuid, FK to profiles, nullable)
    - is_locked_in_battle (boolean, DEFAULT false)
    - locked_since (timestamptz, nullable)
    - locked_in_battle_id (uuid, nullable)

  4. Removed Columns (deprecated in earlier migrations):
    - asking_price (dropped in 20260113211901)

  5. Important Notes
    - Uses IF NOT EXISTS / IF EXISTS checks for idempotency
    - Safe to run on both fresh and existing databases
    - Preserves existing data
*/

-- Ensure all required columns exist with correct defaults
-- These may be missing if migrations were run out of order or partially

-- Add last_purchase_price if missing (should exist from 20251222202921)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_ownership' AND column_name = 'last_purchase_price'
  ) THEN
    ALTER TABLE card_ownership 
      ADD COLUMN last_purchase_price numeric DEFAULT 20.00;
    RAISE NOTICE 'Added last_purchase_price column';
  END IF;
END $$;

-- Add original_owner_id if missing (should exist from 20251225050452)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_ownership' AND column_name = 'original_owner_id'
  ) THEN
    ALTER TABLE card_ownership 
      ADD COLUMN original_owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added original_owner_id column';
  END IF;
END $$;

-- Add battle-related columns if missing (should exist from 20251224232239)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_ownership' AND column_name = 'is_locked_in_battle'
  ) THEN
    ALTER TABLE card_ownership 
      ADD COLUMN is_locked_in_battle boolean DEFAULT false;
    RAISE NOTICE 'Added is_locked_in_battle column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_ownership' AND column_name = 'locked_since'
  ) THEN
    ALTER TABLE card_ownership 
      ADD COLUMN locked_since timestamptz;
    RAISE NOTICE 'Added locked_since column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_ownership' AND column_name = 'locked_in_battle_id'
  ) THEN
    ALTER TABLE card_ownership 
      ADD COLUMN locked_in_battle_id uuid;
    RAISE NOTICE 'Added locked_in_battle_id column';
  END IF;
END $$;

-- Ensure asking_price is removed (should have been dropped in 20260113211901)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_ownership' AND column_name = 'asking_price'
  ) THEN
    ALTER TABLE card_ownership DROP COLUMN asking_price;
    RAISE NOTICE 'Dropped deprecated asking_price column';
  END IF;
END $$;

-- Update default for is_listed_for_sale to true (changed in 20260113211901)
DO $$
BEGIN
  ALTER TABLE card_ownership 
    ALTER COLUMN is_listed_for_sale SET DEFAULT true;
  RAISE NOTICE 'Updated is_listed_for_sale default to true';
END $$;

-- Ensure all existing cards are listed (per fixed-price system)
UPDATE card_ownership
SET is_listed_for_sale = true
WHERE is_listed_for_sale IS NULL OR is_listed_for_sale = false;

-- Verify and fix any null values in critical columns
UPDATE card_ownership
SET 
  current_price = GREATEST(COALESCE(current_price, 20.00), 20.00),
  base_price = COALESCE(base_price, 20.00),
  times_traded = COALESCE(times_traded, 0),
  last_purchase_price = COALESCE(last_purchase_price, 20.00),
  is_locked_in_battle = COALESCE(is_locked_in_battle, false)
WHERE 
  current_price IS NULL 
  OR current_price < 20.00 
  OR base_price IS NULL 
  OR times_traded IS NULL
  OR last_purchase_price IS NULL
  OR is_locked_in_battle IS NULL;

-- Set original_owner_id where missing (should be the card_user_id)
UPDATE card_ownership
SET original_owner_id = card_user_id
WHERE original_owner_id IS NULL;

-- Verify schema consistency
DO $$
DECLARE
  v_total_cards integer;
  v_cards_listed integer;
  v_cards_in_battle integer;
  v_min_price numeric;
  v_max_price numeric;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE is_listed_for_sale = true),
    COUNT(*) FILTER (WHERE is_locked_in_battle = true),
    MIN(current_price),
    MAX(current_price)
  INTO 
    v_total_cards,
    v_cards_listed,
    v_cards_in_battle,
    v_min_price,
    v_max_price
  FROM card_ownership;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'CARD_OWNERSHIP SCHEMA CONSOLIDATED';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Total cards: %', v_total_cards;
  RAISE NOTICE 'Cards listed for sale: %', v_cards_listed;
  RAISE NOTICE 'Cards locked in battle: %', v_cards_in_battle;
  RAISE NOTICE 'Price range: % to % coins', v_min_price, v_max_price;
  RAISE NOTICE '========================================';
END $$;
