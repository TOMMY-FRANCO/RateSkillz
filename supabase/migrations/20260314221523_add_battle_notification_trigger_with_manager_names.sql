/*
  # Add battle request notification trigger with manager names

  ## Summary
  Creates a trigger function on the battles table that fires on INSERT,
  notifying manager2 that manager1 has challenged them. Appends card user
  context ("managed by @ownername") if the challenger manages a card
  belonging to someone else.

  ## Changes
  - New function: notify_battle_challenge() - trigger function on battles INSERT
  - New trigger: trg_notify_battle_challenge on battles AFTER INSERT

  ## Notes
  - Uses manager1_id as challenger, manager2_id as challenged (matches trg_battles_change)
  - Only appends manager text when challenger manages a card that isn't their own
  - notification_type 'battle_request' is already valid in the constraint
*/

CREATE OR REPLACE FUNCTION notify_battle_challenge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_challenger_username text;
  v_managed_card_username text;
  v_message text;
BEGIN
  SELECT username INTO v_challenger_username
  FROM profiles
  WHERE id = NEW.manager1_id;

  SELECT p.username INTO v_managed_card_username
  FROM card_ownership co
  JOIN profiles p ON p.id = co.card_user_id
  WHERE co.owner_id = NEW.manager1_id
    AND co.card_user_id != NEW.manager1_id
  LIMIT 1;

  v_message := COALESCE(v_challenger_username, 'Someone') || ' has challenged you to a battle';

  IF v_managed_card_username IS NOT NULL THEN
    v_message := v_message || ', managed by @' || v_challenger_username;
  END IF;

  INSERT INTO user_notifications (
    user_id,
    notification_type,
    related_id,
    related_user_id,
    message,
    is_read
  ) VALUES (
    NEW.manager2_id,
    'battle_request',
    NEW.id,
    NEW.manager1_id,
    v_message,
    false
  );

  INSERT INTO notification_counts (user_id, notification_type, unread_count)
  VALUES (NEW.manager2_id, 'battle_request', 1)
  ON CONFLICT (user_id, notification_type)
  DO UPDATE SET
    unread_count = notification_counts.unread_count + 1,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_battle_challenge ON battles;

CREATE TRIGGER trg_notify_battle_challenge
  AFTER INSERT ON battles
  FOR EACH ROW
  EXECUTE FUNCTION notify_battle_challenge();
