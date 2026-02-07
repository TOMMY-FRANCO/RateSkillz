/*
  # Fix Ad Reward Double Payment Bug

  ## Problem Identified
  The `earn_coins_from_ad` function was manually updating `profiles.coin_balance` (+5)
  AND inserting a transaction (+5). The trigger `update_coin_balance_on_transaction`
  then fired and added another +5, resulting in users receiving 10 coins instead of 5.

  ## Solution
  Remove the manual balance update from `earn_coins_from_ad`. The trigger will handle
  adding coins when the transaction is inserted. This follows the established pattern:
  - EARNING (positive amounts): Only INSERT into coin_transactions, trigger handles balance
  - SPENDING (negative amounts): Manually UPDATE balance, then INSERT transaction

  ## Changes
  1. Remove `coin_balance = coin_balance + v_coin_reward` from the UPDATE statement
  2. Only update `last_ad_view_date` in the profiles UPDATE
  3. Get updated balance AFTER the trigger fires (from a fresh SELECT)
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

  -- CRITICAL FIX: Only update last_ad_view_date, NOT coin_balance
  -- The trigger will handle adding coins when we insert the transaction
  UPDATE profiles
  SET
    last_ad_view_date = NOW() AT TIME ZONE 'GMT',
    updated_at = NOW() AT TIME ZONE 'GMT'
  WHERE id = p_user_id;

  -- Insert transaction - trigger will add coins to balance
  INSERT INTO coin_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    created_at
  ) VALUES (
    p_user_id,
    v_coin_reward,
    'ad_reward',
    'Daily ad reward',
    NOW() AT TIME ZONE 'GMT'
  ) RETURNING id INTO v_transaction_id;

  -- Get the updated balance AFTER trigger has fired
  SELECT coin_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id;

  -- Update balance_after on the transaction record
  UPDATE coin_transactions
  SET balance_after = v_current_balance
  WHERE id = v_transaction_id;

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
      'transaction_id', v_transaction_id,
      'fix_applied', 'removed_manual_balance_update'
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

COMMENT ON FUNCTION earn_coins_from_ad IS 
'Awards 5 coins for watching daily ad. Fixed: no longer manually updates balance - trigger handles it to prevent double payment.';
