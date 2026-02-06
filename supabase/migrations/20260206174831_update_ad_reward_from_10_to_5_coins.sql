/*
  # Update ad reward from 10 coins to 5 coins

  1. Modified Functions
    - `earn_coins_from_ad` - Changed reward amount from 10 to 5 coins
      - `v_coin_reward` changed from 10 to 5
      - Success message updated to reflect 5 coins

  2. Purpose
    - Reduces daily ad reward to 5 coins per watch
    - All other ad mechanics (daily reset, eligibility check, pool deduction) unchanged
*/

CREATE OR REPLACE FUNCTION earn_coins_from_ad(p_user_id uuid)
RETURNS TABLE(success boolean, new_balance numeric, message text, transaction_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today_start timestamptz;
  v_last_ad_date timestamptz;
  v_coin_reward numeric := 5;
  v_current_balance numeric;
  v_community_pool_remaining numeric;
  v_transaction_id uuid;
  v_pool_id uuid;
BEGIN
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'GMT') AT TIME ZONE 'GMT';

  SELECT last_ad_view_date INTO v_last_ad_date
  FROM profiles
  WHERE id = p_user_id;

  IF v_last_ad_date IS NOT NULL AND v_last_ad_date >= v_today_start THEN
    RETURN QUERY SELECT
      false as success,
      NULL::numeric as new_balance,
      'You''ve already watched today''s ad. Come back at midnight GMT' as message,
      NULL::uuid as transaction_id;
    RETURN;
  END IF;

  SELECT coin_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id;

  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  SELECT id, remaining_coins INTO v_pool_id, v_community_pool_remaining
  FROM coin_pool
  WHERE pool_type = 'community'
  FOR UPDATE;

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Community pool not found';
  END IF;

  IF v_community_pool_remaining < v_coin_reward THEN
    RETURN QUERY SELECT
      false as success,
      NULL::numeric as new_balance,
      'Community pool has insufficient coins' as message,
      NULL::uuid as transaction_id;
    RETURN;
  END IF;

  UPDATE coin_pool
  SET
    remaining_coins = remaining_coins - v_coin_reward,
    distributed_coins = distributed_coins + v_coin_reward,
    updated_at = NOW() AT TIME ZONE 'GMT'
  WHERE pool_type = 'community';

  UPDATE profiles
  SET
    coin_balance = coin_balance + v_coin_reward,
    last_ad_view_date = NOW() AT TIME ZONE 'GMT',
    updated_at = NOW() AT TIME ZONE 'GMT'
  WHERE id = p_user_id
  RETURNING coin_balance INTO v_current_balance;

  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    balance_after,
    created_at
  ) VALUES (
    p_user_id,
    v_coin_reward,
    'ad_reward',
    'Daily ad reward',
    v_current_balance,
    NOW() AT TIME ZONE 'GMT'
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO admin_security_log (
    event_type,
    severity,
    operation_type,
    details
  ) VALUES (
    'validation_failed',
    'info',
    'ad_reward',
    jsonb_build_object(
      'user_id', p_user_id,
      'amount', v_coin_reward,
      'new_balance', v_current_balance,
      'timestamp', NOW() AT TIME ZONE 'GMT',
      'transaction_id', v_transaction_id
    )
  );

  RETURN QUERY SELECT
    true as success,
    v_current_balance as new_balance,
    'Successfully earned 5 coins from ad!' as message,
    v_transaction_id as transaction_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in earn_coins_from_ad: %', SQLERRM;
    RETURN QUERY SELECT
      false as success,
      NULL::numeric as new_balance,
      'Error processing ad reward: ' || SQLERRM as message,
      NULL::uuid as transaction_id;
END;
$$;
