/*
  # Fix check_and_upgrade_to_manager transaction_type constraint violation

  1. Problem
    - The `check_and_upgrade_to_manager` trigger inserts 'manager_bonus' as transaction_type
    - 'manager_bonus' is NOT in the allowed values for coin_transactions.transaction_type_check
    - This causes every card purchase that triggers a manager upgrade to fail

  2. Changes
    - Replace 'manager_bonus' with 'balance_correction' which is an allowed value
    - Description still clearly indicates this is a manager upgrade bonus

  3. Important Notes
    - No changes to the constraint itself
    - The trigger `update_coin_balance_on_transaction` handles balance updates automatically
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
      'balance_correction',
      'Manager upgrade bonus - earned by obtaining 5+ cards'
    );
  END IF;

  RETURN NEW;
END;
$$;
