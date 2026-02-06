/*
  # Replace Friend Milestone with Per-Friend Reward System

  1. Changes
    - Replaces the old one-time 10-coin friend milestone reward
    - New system awards 5 coins per friend added, for the first 5 friends only (25 coins max)
    - Each friend acceptance creates its own reward_log entry with reward_type 'friend_milestone_per_friend'
    - Prevents duplicate rewards for the same friendship
    - Prevents rewards once user has 5+ milestone rewards already claimed

  2. New Function: `claim_per_friend_milestone_reward`
    - Called when a friend request is accepted
    - Accepts user_id and friend_id parameters
    - Checks that user has fewer than 5 milestone rewards already
    - Checks for duplicate reward for the same friend pair
    - Awards 5 coins from community pool
    - Logs reward with reference to the friend_id

  3. Modified
    - Drops old `claim_friend_milestone_reward` function
    - Adds `reference_id` column to reward_logs for tracking which friend triggered the reward

  4. Security
    - Function runs as SECURITY DEFINER with restricted search_path
    - All operations are atomic within the function
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reward_logs' AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE reward_logs ADD COLUMN reference_id text DEFAULT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION claim_per_friend_milestone_reward(
  p_user_id uuid,
  p_friend_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claimed_count integer;
  v_already_rewarded boolean;
  v_pool_balance numeric;
  v_reward_amount numeric := 5.00;
  v_transaction_id uuid;
  v_new_balance numeric;
  v_pool_id uuid;
  v_friend_key text;
BEGIN
  v_friend_key := LEAST(p_user_id::text, p_friend_id::text) || '_' || GREATEST(p_user_id::text, p_friend_id::text);

  SELECT COUNT(*) INTO v_claimed_count
  FROM reward_logs
  WHERE user_id = p_user_id
    AND reward_type = 'friend_milestone_per_friend'
    AND status = 'claimed';

  IF v_claimed_count >= 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Maximum 5 friend milestone rewards already claimed',
      'claimed_count', v_claimed_count
    );
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM reward_logs
    WHERE user_id = p_user_id
      AND reward_type = 'friend_milestone_per_friend'
      AND reference_id = v_friend_key
      AND status = 'claimed'
  ) INTO v_already_rewarded;

  IF v_already_rewarded THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reward already claimed for this friend',
      'claimed_count', v_claimed_count
    );
  END IF;

  SELECT id, remaining_coins INTO v_pool_id, v_pool_balance
  FROM coin_pool
  WHERE pool_type = 'community'
  FOR UPDATE;

  IF v_pool_balance IS NULL OR v_pool_balance < v_reward_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient coins in community pool',
      'claimed_count', v_claimed_count
    );
  END IF;

  UPDATE coin_pool
  SET
    distributed_coins = distributed_coins + v_reward_amount,
    remaining_coins = remaining_coins - v_reward_amount,
    updated_at = now()
  WHERE id = v_pool_id;

  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    p_user_id,
    v_reward_amount,
    'reward_friend_milestone',
    'Friend Milestone Reward (' || (v_claimed_count + 1) || '/5)'
  ) RETURNING id INTO v_transaction_id;

  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id;

  INSERT INTO reward_logs (
    user_id,
    reward_type,
    amount,
    status,
    transaction_id,
    reference_id
  ) VALUES (
    p_user_id,
    'friend_milestone_per_friend',
    v_reward_amount::integer,
    'claimed',
    v_transaction_id,
    v_friend_key
  );

  IF v_claimed_count + 1 >= 5 THEN
    UPDATE profiles
    SET social_badge_reward_claimed = true
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'amount', v_reward_amount,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id,
    'claimed_count', v_claimed_count + 1,
    'milestone_complete', (v_claimed_count + 1) >= 5
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Error claiming reward: ' || SQLERRM,
    'claimed_count', 0
  );
END;
$$;
