/*
  # Fix remaining coins table references

  1. Problem
    - 5 database functions still reference a non-existent `coins` table
    - `check_and_upgrade_to_manager` is a trigger on card_ownership INSERT/UPDATE,
      so it crashes every card purchase, swap, or transfer
    - `get_user_coin_balance` reads from coins table instead of profiles
    - 3 audit/validation functions reference coins table

  2. Changes
    - `check_and_upgrade_to_manager`: Replace coins table reads/writes with profiles.coin_balance.
      Remove manual balance update since trigger on coin_transactions handles it.
      Remove running_balance column (doesn't exist). Remove coin_pool deduction
      (community pool system changed).
    - `get_user_coin_balance`: Read from profiles.coin_balance instead of coins.balance
    - `detect_balance_discrepancies`: Use profiles.coin_balance instead of coins.balance
    - `validate_all_user_balances`: Use profiles.coin_balance instead of coins.balance
    - `validate_user_balance_consistency`: Use profiles.coin_balance instead of coins.balance

  3. Important Notes
    - The trigger `update_coin_balance_on_transaction` automatically updates
      profiles.coin_balance on every coin_transactions INSERT
    - No manual balance updates are needed in any function
*/

CREATE OR REPLACE FUNCTION check_and_upgrade_to_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  card_count integer;
  user_is_manager boolean;
BEGIN
  SELECT COUNT(*) INTO card_count
  FROM card_ownership
  WHERE owner_id = NEW.owner_id;

  SELECT is_manager INTO user_is_manager
  FROM profiles
  WHERE id = NEW.owner_id;

  IF card_count >= 5 AND (user_is_manager IS NULL OR user_is_manager = false) THEN
    UPDATE profiles
    SET is_manager = true,
        manager_upgrade_date = now()
    WHERE id = NEW.owner_id;

    INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
    VALUES (
      NEW.owner_id,
      100,
      'manager_bonus',
      'Manager upgrade bonus - earned by obtaining 5+ cards'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_coin_balance(target_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT COALESCE(coin_balance, 0)
  INTO v_balance
  FROM profiles
  WHERE id = target_user_id;

  RETURN COALESCE(v_balance, 0);
END;
$$;

CREATE OR REPLACE FUNCTION detect_balance_discrepancies()
RETURNS TABLE(
  user_id uuid,
  username text,
  discrepancy numeric,
  current_balance numeric,
  expected_balance numeric,
  detected_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.username,
    p.coin_balance - COALESCE(SUM(ct.amount), 0) AS discrepancy,
    p.coin_balance AS current_balance,
    COALESCE(SUM(ct.amount), 0) AS expected_balance,
    now() AS detected_at
  FROM profiles p
  LEFT JOIN coin_transactions ct ON ct.user_id = p.id
  WHERE p.coin_balance IS NOT NULL
  GROUP BY p.id, p.username, p.coin_balance
  HAVING ABS(p.coin_balance - COALESCE(SUM(ct.amount), 0)) > 0.01
  ORDER BY ABS(p.coin_balance - COALESCE(SUM(ct.amount), 0)) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION validate_all_user_balances()
RETURNS TABLE(
  user_id uuid,
  username text,
  current_balance numeric,
  transaction_sum numeric,
  discrepancy numeric,
  transaction_count bigint,
  is_consistent boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.username,
    p.coin_balance AS current_balance,
    COALESCE(SUM(ct.amount), 0) AS transaction_sum,
    p.coin_balance - COALESCE(SUM(ct.amount), 0) AS discrepancy,
    COUNT(ct.id) AS transaction_count,
    ABS(p.coin_balance - COALESCE(SUM(ct.amount), 0)) < 0.01 AS is_consistent
  FROM profiles p
  LEFT JOIN coin_transactions ct ON ct.user_id = p.id
  WHERE p.coin_balance IS NOT NULL
  GROUP BY p.id, p.username, p.coin_balance
  ORDER BY ABS(p.coin_balance - COALESCE(SUM(ct.amount), 0)) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION validate_user_balance_consistency(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transaction_sum numeric;
  v_current_balance numeric;
  v_latest_balance_after numeric;
  v_discrepancy numeric;
  v_result json;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO v_transaction_sum
  FROM coin_transactions
  WHERE user_id = p_user_id;

  SELECT COALESCE(coin_balance, 0)
  INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id;

  SELECT COALESCE(balance_after, 0)
  INTO v_latest_balance_after
  FROM coin_transactions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_discrepancy := v_current_balance - v_transaction_sum;

  v_result := json_build_object(
    'user_id', p_user_id,
    'transaction_sum', v_transaction_sum,
    'current_balance', v_current_balance,
    'latest_balance_after', v_latest_balance_after,
    'discrepancy', v_discrepancy,
    'is_consistent', ABS(v_discrepancy) < 0.01,
    'balance_after_matches_sum', ABS(v_latest_balance_after - v_transaction_sum) < 0.01,
    'balance_matches_sum', ABS(v_current_balance - v_transaction_sum) < 0.01
  );

  RETURN v_result;
END;
$$;
