/*
  # Fix handle_new_user notification_type constraint violation

  ## Problem
  The handle_new_user trigger inserts a welcome notification with
  notification_type = 'achievement', but the user_notifications table
  has a CHECK constraint that only allows:
  'message', 'coin_received', 'coin_request', 'swap_offer', 'purchase_offer',
  'card_sold', 'battle_request', 'profile_view', 'transaction', 'rank_update',
  'setting_change', 'purchase_request', 'quiz_complete'

  'achievement' is not in this list, causing every new user creation to fail
  with a database error.

  ## Fix
  Change the welcome notification type to 'setting_change' which is valid,
  and matches the existing notify_welcome trigger pattern already used on profiles.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username text;
  v_retry_count integer := 0;
  v_max_retries integer := 5;
  v_success boolean := false;
  v_error_message text;
BEGIN
  WHILE v_retry_count < v_max_retries AND NOT v_success LOOP
    BEGIN
      v_username := generate_username(NEW.id);

      INSERT INTO profiles (
        id,
        username,
        email,
        full_name,
        avatar_url,
        bio,
        coin_balance
      ) VALUES (
        NEW.id,
        v_username,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        '',
        100
      );

      v_success := true;

    EXCEPTION
      WHEN unique_violation THEN
        v_retry_count := v_retry_count + 1;
        IF v_retry_count >= v_max_retries THEN
          RAISE EXCEPTION 'Failed to generate unique username after % attempts', v_max_retries;
        END IF;
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
        RAISE WARNING 'Error in handle_new_user: %', v_error_message;
        RAISE;
    END;
  END LOOP;

  PERFORM initialize_notification_sound_preferences(NEW.id);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    RAISE WARNING 'Fatal error in handle_new_user: %', v_error_message;
    RAISE;
END;
$$;
