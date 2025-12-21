/*
  # Update Comment Coin Reward Amount
  
  ## Changes
  1. Updates the default coin reward for commenting from 0.01 to 0.1 coins
  2. This change increases the comment reward by 10x to better incentivize user engagement
  
  ## Tables Modified
  - `comment_coin_rewards`
    - Update `coins_awarded` default from 0.01 to 0.1
  
  ## Important Notes
  - This only affects future records; existing rewards remain unchanged
  - The unique constraint (user_id, profile_user_id) ensures users can only earn rewards once per profile
  - Edge function already updated to award 0.1 coins per comment
*/

-- Update the default value for coins_awarded in comment_coin_rewards table
ALTER TABLE comment_coin_rewards 
  ALTER COLUMN coins_awarded SET DEFAULT 0.1;
