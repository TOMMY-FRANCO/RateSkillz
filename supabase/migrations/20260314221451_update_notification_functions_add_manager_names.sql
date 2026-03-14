/*
  # Update notification functions to include manager names

  ## Summary
  Updates 4 notification trigger functions so messages include the card manager's
  username when the card owner differs from the current card holder.

  ## Changes

  ### 1. notify_card_sold
  - Looks up the current owner (manager) of the sold card from card_ownership
  - Appends "managed by @username" to the message if owner != card user

  ### 2. notify_swap_offer
  - For each notified manager, looks up the username of the card being offered
    (i.e. whose card is managed by the initiating manager)
  - Appends "managed by @username" to the swap offer message

  ### 3. notify_purchase_request (replaces notify_purchase_offer pattern)
  - Looks up current owner of the card from card_ownership
  - If seller (current owner) differs from card_user_id, appends "managed by @ownername"

  ### 4. check_and_upgrade_to_manager
  - After promotion, looks up which card the new manager currently owns
    that belongs to another user, and appends "Your card is currently managed by @ownername"
    to the notification if such a card exists

  ## Notes
  - Manager text is only appended when owner != card user (no self-management messages)
  - All functions remain SECURITY DEFINER with proper search_path
  - No new tables, no RLS changes
*/

-- 1. Update notify_card_sold to include manager name
CREATE OR REPLACE FUNCTION notify_card_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_card_owner_id uuid;
  v_manager_username text;
  v_message text;
BEGIN
  IF NEW.transaction_type IN ('sale', 'initial_purchase') THEN
    v_card_owner_id := NEW.card_user_id;

    IF v_card_owner_id IS NOT NULL AND v_card_owner_id != NEW.seller_id THEN
      SELECT p.username INTO v_manager_username
      FROM profiles p
      WHERE p.id = NEW.seller_id;

      v_message := 'Your card was sold';
      IF v_manager_username IS NOT NULL THEN
        v_message := v_message || ', managed by @' || v_manager_username;
      END IF;

      PERFORM create_notification(
        v_card_owner_id,
        'card_sold',
        NEW.id,
        NEW.buyer_id,
        v_message
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Update notify_swap_offer to include manager name
CREATE OR REPLACE FUNCTION notify_swap_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_manager_username text;
  v_message text;
BEGIN
  IF NEW.status = 'pending' AND NEW.initiated_by = NEW.manager_a_id THEN
    SELECT p.username INTO v_manager_username
    FROM profiles p
    WHERE p.id = NEW.manager_a_id;

    v_message := 'New card swap offer received';
    IF v_manager_username IS NOT NULL THEN
      v_message := v_message || ', managed by @' || v_manager_username;
    END IF;

    PERFORM create_notification(
      NEW.manager_b_id,
      'swap_offer',
      NEW.id,
      NEW.manager_a_id,
      v_message
    );

  ELSIF NEW.status = 'pending' AND NEW.initiated_by = NEW.manager_b_id THEN
    SELECT p.username INTO v_manager_username
    FROM profiles p
    WHERE p.id = NEW.manager_b_id;

    v_message := 'New card swap offer received';
    IF v_manager_username IS NOT NULL THEN
      v_message := v_message || ', managed by @' || v_manager_username;
    END IF;

    PERFORM create_notification(
      NEW.manager_a_id,
      'swap_offer',
      NEW.id,
      NEW.manager_b_id,
      v_message
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Update notify_purchase_request to include manager name
CREATE OR REPLACE FUNCTION notify_purchase_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_buyer_username text;
  v_card_username text;
  v_message text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT username INTO v_buyer_username
    FROM profiles
    WHERE id = NEW.buyer_id;

    SELECT username INTO v_card_username
    FROM profiles
    WHERE id = NEW.card_user_id;

    v_message := COALESCE(v_buyer_username, 'Someone') || ' wants to buy ' ||
      COALESCE(v_card_username, 'a') || '''s card for ' ||
      NEW.requested_price || ' coins';

    IF NEW.seller_id IS DISTINCT FROM NEW.card_user_id THEN
      DECLARE
        v_seller_username text;
      BEGIN
        SELECT username INTO v_seller_username
        FROM profiles
        WHERE id = NEW.seller_id;

        IF v_seller_username IS NOT NULL THEN
          v_message := v_message || ', managed by @' || v_seller_username;
        END IF;
      END;
    END IF;

    INSERT INTO user_notifications (
      user_id,
      notification_type,
      message,
      related_id,
      related_user_id,
      is_read
    ) VALUES (
      NEW.seller_id,
      'purchase_request',
      v_message,
      NEW.id,
      NEW.buyer_id,
      false
    );

    INSERT INTO notification_counts (user_id, notification_type, unread_count)
    VALUES (NEW.seller_id, 'purchase_request', 1)
    ON CONFLICT (user_id, notification_type)
    DO UPDATE SET
      unread_count = notification_counts.unread_count + 1,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Update check_and_upgrade_to_manager to include current manager info
CREATE OR REPLACE FUNCTION check_and_upgrade_to_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  card_count integer;
  user_is_manager boolean;
  v_manager_username text;
  v_notification_message text;
BEGIN
  SELECT COUNT(*) INTO card_count
  FROM card_ownership
  WHERE owner_id = NEW.owner_id
  AND card_user_id != owner_id;

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

    SELECT p.username INTO v_manager_username
    FROM profiles p
    WHERE p.id = NEW.owner_id;

    v_notification_message := 'Promotion Alert! You are now a Manager. +100 coins have been added to your account.';

    IF v_manager_username IS NOT NULL THEN
      v_notification_message := v_notification_message || ' Your card is currently managed by @' || v_manager_username;
    END IF;

    INSERT INTO user_notifications (user_id, notification_type, message, activity_feed_type)
    VALUES (
      NEW.owner_id,
      'transaction',
      v_notification_message,
      'gold'
    );
  END IF;

  RETURN NEW;
END;
$$;
