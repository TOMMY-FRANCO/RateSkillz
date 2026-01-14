/*
  # Fix Battle Functions to Use card_ownership Table

  ## Overview
  Updates battle-related functions to use the correct table name (card_ownership instead of player_cards).

  ## Changes Made
  - Update check_manager_status to query card_ownership table
  - Update all references from player_cards to card_ownership
*/

-- Fix check_manager_status function
CREATE OR REPLACE FUNCTION check_manager_status(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_card_count integer;
BEGIN
  -- Count cards owned by user in card_ownership table
  SELECT COUNT(*)
  INTO v_card_count
  FROM card_ownership
  WHERE owner_id = p_user_id;
  
  RETURN v_card_count >= 5;
END;
$$;

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Battle functions updated to use card_ownership table';
  RAISE NOTICE 'check_manager_status function now queries card_ownership.owner_id';
END $$;
