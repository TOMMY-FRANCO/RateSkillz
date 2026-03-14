/*
  # Fix handle_new_user trigger broken column references

  ## Problem
  The handle_new_user trigger function references:
  1. `balance` column in profiles - does not exist (correct column is `coin_balance`)
  2. `tutorial_state` table - does not exist (tutorial data is in `tutorial_completions` or profile columns)

  ## Fix
  Replace the trigger function body to use correct column names and skip the
  non-existent tutorial_state insert. The tutorial flag lives on `profiles.tutorial_completed`.

  This fix allows new user auth accounts to be created without a database error.
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

  INSERT INTO user_notifications (user_id, notification_type, message, activity_feed_type)
  VALUES (
    NEW.id,
    'achievement',
    'Welcome to the family! Your journey starts here.',
    'gold'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    RAISE WARNING 'Fatal error in handle_new_user: %', v_error_message;
    RAISE;
END;
$$;
