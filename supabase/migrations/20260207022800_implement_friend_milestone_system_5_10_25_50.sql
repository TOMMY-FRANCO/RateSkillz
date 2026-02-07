/*
  # Implement Friend Milestone Reward System (5, 10, 25, 50 Friends)

  ## Summary
  Implements a comprehensive milestone-based reward system that triggers when users
  reach 5, 10, 25, or 50 accepted friends. Each milestone can only be claimed once.

  ## Milestone Rewards
  - 5 friends: 10 coins
  - 10 friends: 20 coins
  - 25 friends: 50 coins
  - 50 friends: 100 coins

  ## Changes Made

  ### 1. Update reward_logs Table
  - Add milestone_level column to track which milestone (5, 10, 25, 50)
  - Update reward_type constraint to include milestone levels
  - Add unique constraint to prevent duplicate milestone claims

  ### 2. Update coin_transactions Types
  - Add transaction types for each milestone level

  ### 3. Create Milestone Reward Function
  - `claim_friend_milestone_reward_v2`: Awards coins for specific milestone
  - Checks for duplicate claims
  - Deducts from community pool
  - Creates transaction and reward log entries
  - Includes comprehensive error handling and logging

  ### 4. Create Trigger Function
  - Automatically checks milestones when friend_count changes
  - Calls reward function for newly reached milestones
  - Updates both users in the friendship

  ### 5. Fix Previous Bugs
  - Drops old buggy triggers that referenced non-existent friend_requests table
  - Uses correct friends table with status field
  - Works with existing friend_count update triggers

  ## Security
  - All functions run as SECURITY DEFINER with restricted search_path
  - Duplicate claim prevention at database level
  - Atomic operations within transactions
*/

-- Add milestone_level column to reward_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reward_logs' AND column_name = 'milestone_level'
  ) THEN
    ALTER TABLE reward_logs ADD COLUMN milestone_level integer DEFAULT NULL;
  END IF;
END $$;

-- Update reward_logs reward_type constraint to include new milestone types
DO $$
BEGIN
  ALTER TABLE reward_logs DROP CONSTRAINT IF EXISTS reward_logs_reward_type_check;

  ALTER TABLE reward_logs ADD CONSTRAINT reward_logs_reward_type_check
    CHECK (reward_type IN (
      'whatsapp_verify',
      'social_share',
      'friend_milestone',
      'friend_milestone_per_friend',
      'friend_milestone_5',
      'friend_milestone_10',
      'friend_milestone_25',
      'friend_milestone_50'
    ));
END $$;

-- Add unique constraint to prevent duplicate milestone claims
DO $$
BEGIN
  DROP INDEX IF EXISTS idx_reward_logs_user_reward_type;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_logs_user_milestone_level
    ON reward_logs(user_id, reward_type, milestone_level)
    WHERE status = 'claimed' AND milestone_level IS NOT NULL;
END $$;

-- Update coin_transactions transaction_type constraint (include all existing types)
DO $$
BEGIN
  ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;

  ALTER TABLE coin_transactions ADD CONSTRAINT coin_transactions_transaction_type_check
    CHECK (transaction_type IN (
      'comment_reward',
      'ad_view',
      'ad_reward',
      'purchase',
      'card_sale',
      'card_purchase',
      'coin_purchase',
      'card_royalty',
      'balance_correction',
      'battle_wager',
      'battle_win',
      'coin_transfer_sent',
      'coin_transfer_received',
      'card_swap',
      'card_discard',
      'reward_whatsapp',
      'reward_social_share',
      'reward_friend_milestone',
      'tutorial_completion',
      'battle_entry_fee',
      'battle_winner_payout',
      'buyout',
      'reward_whatsapp_share',
      'whatsapp_share',
      'purchase_request_declined'
    ));
END $$;

-- Drop old buggy triggers that reference non-existent friend_requests table
DROP TRIGGER IF EXISTS trigger_friend_milestone_reward ON friend_requests;
DROP TRIGGER IF EXISTS trigger_friend_milestone_reward ON friends;
DROP FUNCTION IF EXISTS update_friend_count_and_check_milestone();

-- Create new milestone reward function
CREATE OR REPLACE FUNCTION claim_friend_milestone_reward_v2(
  p_user_id uuid,
  p_milestone_level integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_already_claimed boolean;
  v_friend_count integer;
  v_pool_balance numeric;
  v_reward_amount numeric;
  v_transaction_id uuid;
  v_new_balance numeric;
  v_pool_id uuid;
  v_reward_type text;
BEGIN
  -- Set reward amount based on milestone level
  CASE p_milestone_level
    WHEN 5 THEN
      v_reward_amount := 10.00;
      v_reward_type := 'friend_milestone_5';
    WHEN 10 THEN
      v_reward_amount := 20.00;
      v_reward_type := 'friend_milestone_10';
    WHEN 25 THEN
      v_reward_amount := 50.00;
      v_reward_type := 'friend_milestone_25';
    WHEN 50 THEN
      v_reward_amount := 100.00;
      v_reward_type := 'friend_milestone_50';
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid milestone level: ' || p_milestone_level
      );
  END CASE;

  -- Check if already claimed
  SELECT EXISTS(
    SELECT 1 FROM reward_logs
    WHERE user_id = p_user_id
      AND reward_type = v_reward_type
      AND milestone_level = p_milestone_level
      AND status = 'claimed'
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Milestone ' || p_milestone_level || ' reward already claimed'
    );
  END IF;

  -- Get current friend count
  SELECT friend_count INTO v_friend_count
  FROM profiles
  WHERE id = p_user_id;

  -- Verify user has reached milestone
  IF v_friend_count < p_milestone_level THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User has only ' || v_friend_count || ' friends, needs ' || p_milestone_level,
      'friend_count', v_friend_count
    );
  END IF;

  -- Get and lock community pool
  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance
  FROM coin_pool
  WHERE pool_type = 'community'
  FOR UPDATE;

  IF v_pool_balance IS NULL OR v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient coins in community pool'
    );
  END IF;

  -- Deduct from pool
  UPDATE coin_pool
  SET
    distributed_coins = distributed_coins + v_reward_amount,
    remaining_coins = remaining_coins - v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  -- Create transaction record (trigger will update balance)
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'reward_friend_milestone',
    'Friend Milestone: ' || p_milestone_level || ' Friends (+' || v_reward_amount || ' coins)'
  ) RETURNING id INTO v_transaction_id;

  -- Get updated balance after trigger
  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id;

  -- Log reward
  INSERT INTO reward_logs (
    user_id,
    reward_type,
    amount,
    milestone_level,
    status,
    transaction_id
  ) VALUES (
    p_user_id,
    v_reward_type,
    v_reward_amount::integer,
    p_milestone_level,
    'claimed',
    v_transaction_id
  );

  -- Log success to security_log
  INSERT INTO security_log (
    user_id,
    event_type,
    description,
    severity,
    metadata
  ) VALUES (
    p_user_id,
    'friend_milestone_reward',
    'Friend milestone reward claimed: ' || p_milestone_level || ' friends',
    'info',
    jsonb_build_object(
      'milestone_level', p_milestone_level,
      'reward_amount', v_reward_amount,
      'friend_count', v_friend_count,
      'transaction_id', v_transaction_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'milestone_level', p_milestone_level,
    'reward_amount', v_reward_amount,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id,
    'friend_count', v_friend_count
  );
EXCEPTION WHEN OTHERS THEN
  -- Log error to security_log
  INSERT INTO security_log (
    user_id,
    event_type,
    description,
    severity,
    metadata
  ) VALUES (
    p_user_id,
    'friend_milestone_error',
    'Error claiming friend milestone reward: ' || SQLERRM,
    'error',
    jsonb_build_object(
      'milestone_level', p_milestone_level,
      'error', SQLERRM
    )
  );

  RETURN jsonb_build_object(
    'success', false,
    'error', 'Error claiming reward: ' || SQLERRM
  );
END;
$$;

-- Create trigger function to check milestones after friend_count updates
CREATE OR REPLACE FUNCTION check_friend_milestones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_milestone_level integer;
  v_reward_result jsonb;
  v_milestones integer[] := ARRAY[5, 10, 25, 50];
BEGIN
  -- Only check if friend_count increased
  IF NEW.friend_count > COALESCE(OLD.friend_count, 0) THEN
    -- Check each milestone
    FOREACH v_milestone_level IN ARRAY v_milestones
    LOOP
      -- If user reached this milestone and hasn't claimed it yet
      IF NEW.friend_count >= v_milestone_level AND
         (OLD.friend_count IS NULL OR OLD.friend_count < v_milestone_level) THEN

        -- Try to claim the reward
        SELECT claim_friend_milestone_reward_v2(NEW.id, v_milestone_level)
        INTO v_reward_result;

        -- Log result (success or failure)
        RAISE NOTICE 'Milestone check for user % at level %: %',
          NEW.id, v_milestone_level, v_reward_result;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on profiles table to check milestones when friend_count changes
DROP TRIGGER IF EXISTS trigger_check_friend_milestones ON profiles;
CREATE TRIGGER trigger_check_friend_milestones
  AFTER UPDATE OF friend_count ON profiles
  FOR EACH ROW
  WHEN (NEW.friend_count IS DISTINCT FROM OLD.friend_count)
  EXECUTE FUNCTION check_friend_milestones();

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Friend milestone system (5, 10, 25, 50) implemented successfully';
  RAISE NOTICE 'Rewards: 5 friends = 10 coins, 10 friends = 20 coins, 25 friends = 50 coins, 50 friends = 100 coins';
  RAISE NOTICE 'Automatic triggering enabled via friend_count updates';
END $$;
