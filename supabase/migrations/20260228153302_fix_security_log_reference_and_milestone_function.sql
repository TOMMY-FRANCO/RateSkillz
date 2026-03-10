/*
  # Fix security_log reference in claim_friend_milestone_reward_v2

  1. Problem
    - The `claim_friend_milestone_reward_v2` function references a non-existent table `security_log`
    - The correct table is `admin_security_log` with different column names
    - The function uses event types not in the `admin_security_log` CHECK constraint
    - This causes friend acceptance to fail because the trigger chain
      (friends UPDATE -> update_friend_count -> check_friend_milestones -> claim_friend_milestone_reward_v2)
      hits the missing table error and rolls back the entire transaction

  2. Changes
    - Add `friend_milestone_reward` and `friend_milestone_error` to the event_type CHECK constraint
    - Recreate `claim_friend_milestone_reward_v2` with correct table name (`admin_security_log`)
      and correct column names (`operation_type` instead of `description`, `details` instead of `metadata`)

  3. Impact
    - Fixes friend request acceptance failures (PATCH 404)
    - Fixes "relation security_log does not exist" error
    - No data loss - only function and constraint changes
*/

-- Step 1: Update the event_type constraint to include friend milestone events
ALTER TABLE admin_security_log
DROP CONSTRAINT IF EXISTS admin_security_log_event_type_check;

ALTER TABLE admin_security_log
ADD CONSTRAINT admin_security_log_event_type_check
CHECK (event_type = ANY (ARRAY[
  'validation_failed',
  'negative_amount_rejected',
  'excessive_amount_rejected',
  'invalid_user_rejected',
  'duplicate_payment_detected',
  'concurrent_operation_detected',
  'suspicious_activity',
  'daily_ad_reset',
  'daily_ad_reset_error',
  'friend_milestone_reward',
  'friend_milestone_error'
]));

-- Step 2: Recreate the function with correct table and column references
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

  SELECT friend_count INTO v_friend_count
  FROM profiles
  WHERE id = p_user_id;

  IF v_friend_count < p_milestone_level THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User has only ' || v_friend_count || ' friends, needs ' || p_milestone_level,
      'friend_count', v_friend_count
    );
  END IF;

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
    'Friend Milestone: ' || p_milestone_level || ' Friends (+' || v_reward_amount || ' coins)'
  ) RETURNING id INTO v_transaction_id;

  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = p_user_id;

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

  INSERT INTO admin_security_log (
    user_id,
    event_type,
    operation_type,
    severity,
    details
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
  INSERT INTO admin_security_log (
    user_id,
    event_type,
    operation_type,
    severity,
    details
  ) VALUES (
    p_user_id,
    'friend_milestone_error',
    'Error claiming friend milestone reward: ' || SQLERRM,
    'low',
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
