/*
  # Fix Comment Reward to 0.1 Coins

  ## Summary
  Reduces comment reward from 1.0 coins back to 0.1 coins per profile.
  Users can only earn once per profile they comment on.

  ## Changes Made

  ### 1. Update Database Function
  - `earn_coins_from_comment` function updated to distribute 0.1 coin instead of 1.0
  - Function now records 0.1 coin in comment_earnings table
  - Success message updated to reflect new amount

  ### 2. Maintain One-Comment-Per-Profile Rule
  - Users still can only earn once per profile they comment on
  - Unique constraint (user_id, profile_id) remains in place
  - Already earned check still prevents duplicate rewards

  ### 3. Coin Pool Distribution
  - Each comment reward now deducts 0.1 coin from pool (instead of 1.0)
  - Users receive 0.1 coin added to their balance (instead of 1.0)
  - Total distributed amount increases by 0.1 per reward (instead of 1.0)

  ## Security
  - All security checks remain in place
  - Cannot earn from own profile
  - Cannot earn twice from same profile
  - Coin pool validation still active
*/

-- Update the earn_coins_from_comment function to award 0.1 coin instead of 1.0
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
  
  -- Distribute 0.1 coin from pool
  v_result := distribute_coins_from_pool(
    p_user_id,
    0.1,
    'comment',
    'Earned from commenting on profile'
  );
  
  -- Record that user earned from this profile with 0.1 coin amount
  INSERT INTO comment_earnings (user_id, profile_id, amount)
  VALUES (p_user_id, p_profile_id, 0.1);
  
  RETURN json_build_object(
    'success', true,
    'amount', 0.1,
    'message', 'You earned 0.1 coins!'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
