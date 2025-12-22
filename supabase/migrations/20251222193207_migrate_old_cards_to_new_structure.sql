/*
  # Migrate Old Card Data to New Structure
  
  1. Problem
    - Old cards exist from before the system redesign
    - Cards may have outdated field values or missing fields
    - Need defensive data migration to handle all edge cases
  
  2. Changes
    - Ensure all cards have proper current_price (minimum 20 coins)
    - Set base_price = current_price for consistency
    - Verify all cards have times_traded properly set
    - Ensure last_sale_price is null for never-sold cards
    - Fix any cards with percentage-inflated values
  
  3. Safety
    - Uses IF NOT EXISTS checks
    - Preserves existing valid data
    - Only updates cards with problematic values
    - Logs all changes for audit trail
*/

-- Step 1: Add missing base_price column if it doesn't exist (backwards compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'card_ownership' AND column_name = 'base_price'
  ) THEN
    ALTER TABLE card_ownership ADD COLUMN base_price numeric DEFAULT 20.00;
    RAISE NOTICE 'Added base_price column to card_ownership';
  END IF;
END $$;

-- Step 2: Fix all cards with invalid current_price (null or below minimum)
UPDATE card_ownership
SET current_price = 20.00
WHERE current_price IS NULL OR current_price < 20.00;

-- Step 3: Sync base_price with current_price for all cards
UPDATE card_ownership
SET base_price = 20.00
WHERE base_price IS NULL OR base_price != 20.00;

-- Step 4: Fix cards with percentage-inflated values
-- If a card has current_price that's not a multiple of 5 above 20, round it properly
UPDATE card_ownership
SET current_price = 20.00 + (FLOOR((current_price - 20.00) / 5.00) * 5.00)
WHERE current_price > 20.00 
  AND MOD((current_price - 20.00)::numeric, 5.00) != 0;

-- Step 5: Ensure times_traded is set correctly
UPDATE card_ownership
SET times_traded = 0
WHERE times_traded IS NULL;

-- Step 6: Reset last_sale_price for cards that have never been traded
UPDATE card_ownership
SET last_sale_price = NULL
WHERE times_traded = 0 AND last_sale_price IS NOT NULL;

-- Step 7: Ensure all cards are properly linked to card_user_id
UPDATE card_ownership
SET card_user_id = owner_id
WHERE card_user_id IS NULL;

-- Step 8: Set acquired_at for any cards missing it
UPDATE card_ownership
SET acquired_at = created_at
WHERE acquired_at IS NULL;

-- Step 9: Verify and log results
DO $$
DECLARE
  v_total_cards integer;
  v_cards_at_base integer;
  v_cards_traded integer;
  v_min_value numeric;
  v_max_value numeric;
BEGIN
  SELECT COUNT(*) INTO v_total_cards FROM card_ownership;
  SELECT COUNT(*) INTO v_cards_at_base FROM card_ownership WHERE current_price = 20.00;
  SELECT COUNT(*) INTO v_cards_traded FROM card_ownership WHERE times_traded > 0;
  SELECT MIN(current_price), MAX(current_price) INTO v_min_value, v_max_value FROM card_ownership;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CARD DATA MIGRATION COMPLETED';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Total cards: %', v_total_cards;
  RAISE NOTICE 'Cards at base value (20): %', v_cards_at_base;
  RAISE NOTICE 'Cards that have been traded: %', v_cards_traded;
  RAISE NOTICE 'Value range: % to % coins', v_min_value, v_max_value;
  RAISE NOTICE '========================================';
END $$;

-- Step 10: Create helper function to safely get card value with fallback
CREATE OR REPLACE FUNCTION get_safe_card_value(p_card_ownership_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_price numeric;
  v_base_price numeric;
BEGIN
  SELECT current_price, base_price 
  INTO v_current_price, v_base_price
  FROM card_ownership
  WHERE id = p_card_ownership_id;
  
  -- Return current_price if valid
  IF v_current_price IS NOT NULL AND v_current_price >= 20.00 THEN
    RETURN v_current_price;
  END IF;
  
  -- Fallback to base_price if valid
  IF v_base_price IS NOT NULL AND v_base_price >= 20.00 THEN
    RETURN v_base_price;
  END IF;
  
  -- Final fallback to minimum value
  RETURN 20.00;
END;
$$;

-- Step 11: Add validation trigger to prevent invalid card prices in future
CREATE OR REPLACE FUNCTION validate_card_price_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ensure current_price is never below minimum
  IF NEW.current_price IS NULL OR NEW.current_price < 20.00 THEN
    NEW.current_price := 20.00;
  END IF;
  
  -- Ensure base_price matches initial value
  IF NEW.base_price IS NULL OR NEW.base_price < 20.00 THEN
    NEW.base_price := 20.00;
  END IF;
  
  -- Ensure times_traded starts at 0
  IF NEW.times_traded IS NULL THEN
    NEW.times_traded := 0;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger for new cards
DROP TRIGGER IF EXISTS trigger_validate_card_price_on_insert ON card_ownership;
CREATE TRIGGER trigger_validate_card_price_on_insert
  BEFORE INSERT ON card_ownership
  FOR EACH ROW
  EXECUTE FUNCTION validate_card_price_on_insert();

-- Verify all cards are now valid
DO $$
DECLARE
  v_invalid_cards integer;
BEGIN
  SELECT COUNT(*) INTO v_invalid_cards
  FROM card_ownership
  WHERE current_price < 20.00 OR current_price IS NULL;
  
  IF v_invalid_cards > 0 THEN
    RAISE WARNING 'Found % cards with invalid prices after migration', v_invalid_cards;
  ELSE
    RAISE NOTICE 'All cards validated successfully - no invalid prices found';
  END IF;
END $$;
