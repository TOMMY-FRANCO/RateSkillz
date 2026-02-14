/*
  # Fix Coin Transfer: Explicit Balance Updates for Both Sender and Recipient

  ## Problem
  The `process_coin_transfer_trigger` function inserts coin_transactions for both
  sender and recipient, and updates daily limits, but does NOT directly update
  `coin_balance` on profiles. It relies on a downstream trigger chain
  (`update_coin_balance_on_transaction`) to handle balance updates. This indirect
  approach is fragile and can result in the recipient never being credited.

  ## Fix
  1. Add explicit `coin_balance` UPDATE statements for BOTH sender and recipient
     directly in `process_coin_transfer_trigger`, with row-count verification
  2. Exclude transfer transaction types from `update_coin_balance_on_transaction`
     to prevent double-counting

  ## Tables Modified
  - `profiles` - coin_balance now updated explicitly during transfers
  
  ## Functions Modified  
  - `process_coin_transfer_trigger` - Added explicit coin_balance updates for sender AND recipient
  - `update_coin_balance_on_transaction` - Excluded transfer types to prevent double-counting
*/

-- ============================================================================
-- 1. Update process_coin_transfer_trigger to explicitly update both balances
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_coin_transfer_trigger()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sender_rows integer;
  v_recipient_rows integer;
BEGIN
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  UPDATE profiles
  SET coin_balance = coin_balance - NEW.amount,
      coins_sent_today = coins_sent_today + NEW.amount,
      updated_at = now()
  WHERE id = NEW.sender_id;

  GET DIAGNOSTICS v_sender_rows = ROW_COUNT;
  IF v_sender_rows = 0 THEN
    RAISE EXCEPTION 'Failed to debit sender %', NEW.sender_id;
  END IF;

  UPDATE profiles
  SET coin_balance = coin_balance + NEW.amount,
      coins_received_today = coins_received_today + NEW.amount,
      updated_at = now()
  WHERE id = NEW.recipient_id;

  GET DIAGNOSTICS v_recipient_rows = ROW_COUNT;
  IF v_recipient_rows = 0 THEN
    RAISE EXCEPTION 'Failed to credit recipient %', NEW.recipient_id;
  END IF;

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, related_user_id)
  VALUES (NEW.sender_id, -NEW.amount, 'coin_transfer_sent', 'Sent to user', NEW.recipient_id);

  INSERT INTO coin_transactions (user_id, amount, transaction_type, description, related_user_id)
  VALUES (NEW.recipient_id, NEW.amount, 'coin_transfer_received', 'Received from user', NEW.sender_id);

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 2. Exclude transfer types from the generic balance update trigger
--    to prevent double-counting
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_coin_balance_on_transaction()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows_affected integer;
  v_old_balance numeric;
  v_new_balance numeric;
BEGIN
  IF NEW.transaction_type IN ('coin_transfer_sent', 'coin_transfer_received') THEN
    RETURN NEW;
  END IF;

  SELECT coin_balance INTO v_old_balance
  FROM profiles
  WHERE id = NEW.user_id;

  IF v_old_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', NEW.user_id;
  END IF;

  UPDATE profiles
  SET
    coin_balance = coin_balance + NEW.amount,
    updated_at = now()
  WHERE id = NEW.user_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'Failed to update balance for user_id: %', NEW.user_id;
  END IF;

  SELECT coin_balance INTO v_new_balance
  FROM profiles
  WHERE id = NEW.user_id;

  IF v_new_balance != (v_old_balance + NEW.amount) THEN
    RAISE EXCEPTION 'Balance update verification failed. Expected: %, Got: %',
      (v_old_balance + NEW.amount), v_new_balance;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to update coin balance for user %: %', NEW.user_id, SQLERRM;
END;
$function$;
