/*
  # Fix Card Listing to Use Current Value Only
  
  ## Overview
  Cards must ONLY sell at their fixed current_value with no ability for users to change the price.
  This migration removes all custom price functionality and ensures cards always list at their
  exact current_value (which is stored in the current_price column).
  
  ## Changes Made
  
  ### 1. Update list_card_for_sale Function
  - Remove custom asking price validation
  - Always use current_price as the asking_price
  - No minimum price checks or markups - just use current_price exactly
  - Function still accepts p_asking_price parameter for backward compatibility but ignores it
  
  ### 2. Fixed Price Logic
  - When listing: asking_price = current_price (no user input)
  - When buying: buyer pays exactly the asking_price (which equals current_price)
  - After sale: current_price increases by 10 coins
  
  ### 3. User Experience
  - No price input fields in UI
  - Display current_price as read-only
  - Automatic listing at current_price
  - Clear messaging: "Cards sell at their current value only"
  
  ## Security
  - All existing security checks remain in place
  - Cannot list own card
  - Must be the owner to list
  - RLS policies unchanged
  
  ## Backward Compatibility
  - Function signature unchanged (still accepts p_asking_price)
  - Existing code continues to work
  - Simply ignores the price parameter and uses current_price instead
*/

-- Update list_card_for_sale to always use current_price
CREATE OR REPLACE FUNCTION list_card_for_sale(
  p_card_user_id uuid,
  p_owner_id uuid,
  p_asking_price numeric  -- Still accepted for compatibility but ignored
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ownership record;
  v_current_price numeric;
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
  
  -- CRITICAL: Always use current_price, ignore any custom asking price
  -- Cards must sell at their exact current value only
  v_current_price := COALESCE(v_ownership.current_price, v_ownership.base_price, 20.00);
  
  -- Update listing - set asking_price to exactly match current_price
  UPDATE card_ownership
  SET 
    is_listed_for_sale = true,
    asking_price = v_current_price,
    updated_at = now()
  WHERE card_user_id = p_card_user_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'asking_price', v_current_price,
    'message', 'Card listed at current value: ' || v_current_price || ' coins'
  );
END;
$$;

-- Add a comment explaining the fixed price system
COMMENT ON FUNCTION list_card_for_sale IS 
'Lists a card for sale at its current value only. The p_asking_price parameter is ignored - cards always sell at current_price. No custom pricing allowed.';
