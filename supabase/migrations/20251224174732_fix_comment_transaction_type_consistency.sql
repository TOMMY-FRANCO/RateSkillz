/*
  # Fix Comment Transaction Type Consistency

  ## Summary
  Updates the earn_coins_from_comment function to use 'comment_reward' as the transaction type
  instead of 'comment' to match the CHECK constraint.

  ## Changes Made
  1. Update earn_coins_from_comment to pass 'comment_reward' instead of 'comment'
  2. Ensures consistency with coin_transactions CHECK constraint

  ## Note
  This change only affects new comment rewards. Historical records remain unchanged.
*/

-- Update earn_coins_from_comment to use correct transaction type
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
  
  -- Distribute 0.1 coin from pool with correct transaction type
  v_result := distribute_coins_from_pool(
    p_user_id,
    0.1,
    'comment_reward',
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
