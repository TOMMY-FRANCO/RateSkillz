/*
  # Fix Messaging System - Broken Trigger and Missing Conversations

  1. Bug Fix
    - `notify_new_message` trigger function references `NEW.receiver_id` but the column is `recipient_id`
    - This crashes EVERY message INSERT, making messaging completely non-functional
    - Fixed to use correct column name `recipient_id`

  2. Missing Conversations
    - Many accepted friendships have no conversation created (silent failures)
    - Creates conversations for all accepted friendships that are missing one

  3. Security
    - Both trigger functions updated to SECURITY DEFINER with safe search_path
*/

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.sender_id != NEW.recipient_id THEN
    PERFORM create_notification(
      NEW.recipient_id,
      'message',
      NEW.id,
      NEW.sender_id,
      'New message received'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_conversation_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r RECORD;
  v_ordered_one uuid;
  v_ordered_two uuid;
  v_exists boolean;
BEGIN
  FOR r IN 
    SELECT user_id, friend_id 
    FROM friends 
    WHERE status = 'accepted'
  LOOP
    IF r.user_id < r.friend_id THEN
      v_ordered_one := r.user_id;
      v_ordered_two := r.friend_id;
    ELSE
      v_ordered_one := r.friend_id;
      v_ordered_two := r.user_id;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM conversations 
      WHERE user_one_id = v_ordered_one AND user_two_id = v_ordered_two
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO conversations (user_one_id, user_two_id)
      VALUES (v_ordered_one, v_ordered_two);
    END IF;
  END LOOP;
END $$;
