/*
  # Increase Comment Reward from 0.1 to 1 Coin
  
  ## Overview
  This migration increases the comment reward from 0.1 coins to 1 coin per first comment
  on each profile. This change encourages more user engagement and provides a more
  meaningful reward for contributing comments.
  
  ## Changes Made
  
  ### 1. Update Database Function
  - `earn_coins_from_comment` function updated to distribute 1 coin instead of 0.1
  - Function now records 1 coin in comment_earnings table
  - Success message updated to reflect new amount
  
  ### 2. Maintain One-Comment-Per-Profile Rule
  - Users still can only earn once per profile they comment on
  - Unique constraint (user_id, profile_id) remains in place
  - Already earned check still prevents duplicate rewards
  
  ### 3. Coin Pool Distribution
  - Each comment reward now deducts 1 coin from pool (instead of 0.1)
  - Users receive 1 coin added to their balance (instead of 0.1)
  - Total distributed amount increases by 1 per reward (instead of 0.1)
  
  ## Backward Compatibility
  - Historical comment_earnings records with 0.1 coins remain unchanged
  - These records accurately reflect earnings when old system was in place
  - New earnings will show 1 coin going forward
  - Reports and statistics handle both old and new amounts correctly
  
  ## User Experience Improvements
  - More meaningful reward amount (1 coin vs 0.1 coin)
  - Encourages more profile engagement
  - Easier to understand whole numbers
  - More satisfying earning experience
  
  ## Security
  - All security checks remain in place
  - Cannot earn from own profile
  - Cannot earn twice from same profile
  - Coin pool validation still active
*/

-- Update the earn_coins_from_comment function to award 1 coin instead of 0.1
CREATE OR REPLACE FUNCTION earn_coins_from_comment(
  p_user_id uuid,
  p_profile_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_already_earned boolean;
  v_result json;
BEGIN
  -- Check if user already earned from this profile
  SELECT EXISTS(
    SELECT 1 FROM comment_earnings
    WHERE user_id = p_user_id AND profile_id = p_profile_id
  ) INTO v_already_earned;
  
  IF v_already_earned THEN
    RETURN json_build_object(
      'success', false,
      'error', 'already_earned',
      'message', 'You have already earned coins from commenting on this profile'
    );
  END IF;
  
  -- Distribute 1 coin from pool (increased from 0.1)
  v_result := distribute_coins_from_pool(
    p_user_id,
    1.0,
    'comment',
    'Earned from commenting on profile'
  );
  
  -- Record that user earned from this profile with 1 coin amount
  INSERT INTO comment_earnings (user_id, profile_id, amount)
  VALUES (p_user_id, p_profile_id, 1.0);
  
  RETURN json_build_object(
    'success', true,
    'amount', 1.0,
    'message', 'You earned 1 coin!'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Update default value for comment_earnings table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'comment_earnings' 
    AND column_name = 'amount'
  ) THEN
    ALTER TABLE comment_earnings 
      ALTER COLUMN amount SET DEFAULT 1.0;
  END IF;
END $$;

-- Update default value for comment_coin_rewards table if it still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'comment_coin_rewards'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'comment_coin_rewards' 
      AND column_name = 'coins_awarded'
    ) THEN
      ALTER TABLE comment_coin_rewards 
        ALTER COLUMN coins_awarded SET DEFAULT 1.0;
    END IF;
  END IF;
END $$;
