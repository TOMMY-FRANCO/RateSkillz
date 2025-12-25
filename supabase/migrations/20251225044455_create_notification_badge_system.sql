/*
  # Notification Badge System

  1. New Tables
    - `user_notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles) - who receives the notification
      - `notification_type` (text) - type of notification
      - `related_id` (uuid) - reference to related item
      - `related_user_id` (uuid) - user who triggered the notification
      - `message` (text) - notification message
      - `is_read` (boolean) - read status
      - `created_at` (timestamptz)
      - `read_at` (timestamptz)

    - `notification_counts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `notification_type` (text)
      - `unread_count` (integer)
      - `last_checked_at` (timestamptz)
      - UNIQUE constraint on (user_id, notification_type)

  2. Notification Types
    - 'message' - New messages
    - 'coin_received' - Coins received
    - 'coin_request' - Coin request received
    - 'swap_offer' - Card swap offer
    - 'purchase_offer' - Card purchase offer
    - 'card_sold' - Card sold notification
    - 'battle_request' - Battle challenge received
    - 'profile_view' - Profile viewed
    - 'transaction' - New transaction
    - 'rank_update' - Leaderboard rank change
    - 'setting_change' - Account/security update

  3. Functions
    - `create_notification` - Creates notification and updates count
    - `mark_notifications_read` - Marks notifications as read
    - `get_notification_counts` - Gets unread counts per type
    - `reset_notification_count` - Resets count for a type

  4. Security
    - Enable RLS on all tables
    - Users can only see their own notifications
    - Notifications created by system functions

  5. Real-time
    - Enable real-time subscriptions on notification_counts
*/

-- Create user_notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN (
    'message',
    'coin_received',
    'coin_request',
    'swap_offer',
    'purchase_offer',
    'card_sold',
    'battle_request',
    'profile_view',
    'transaction',
    'rank_update',
    'setting_change'
  )),
  related_id uuid,
  related_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  message text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Create notification_counts table
CREATE TABLE IF NOT EXISTS notification_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  unread_count integer DEFAULT 0 CHECK (unread_count >= 0),
  last_checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_notification_type UNIQUE(user_id, notification_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notification_counts_user ON notification_counts(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_counts_user_type ON notification_counts(user_id, notification_type);

-- Enable RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_counts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_notifications
CREATE POLICY "Users can view their own notifications"
  ON user_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON user_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON user_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for notification_counts
CREATE POLICY "Users can view their own notification counts"
  ON notification_counts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification counts"
  ON notification_counts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can manage notification counts"
  ON notification_counts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to create notification and update count
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_notification_type text,
  p_related_id uuid DEFAULT NULL,
  p_related_user_id uuid DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  -- Create notification
  INSERT INTO user_notifications (
    user_id,
    notification_type,
    related_id,
    related_user_id,
    message,
    is_read
  ) VALUES (
    p_user_id,
    p_notification_type,
    p_related_id,
    p_related_user_id,
    p_message,
    false
  ) RETURNING id INTO v_notification_id;

  -- Update or insert notification count
  INSERT INTO notification_counts (user_id, notification_type, unread_count)
  VALUES (p_user_id, p_notification_type, 1)
  ON CONFLICT (user_id, notification_type)
  DO UPDATE SET
    unread_count = notification_counts.unread_count + 1,
    updated_at = now();

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_user_id uuid,
  p_notification_type text
)
RETURNS void AS $$
BEGIN
  -- Mark all notifications of this type as read
  UPDATE user_notifications
  SET is_read = true,
      read_at = now()
  WHERE user_id = p_user_id
    AND notification_type = p_notification_type
    AND is_read = false;

  -- Reset notification count
  UPDATE notification_counts
  SET unread_count = 0,
      last_checked_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id
    AND notification_type = p_notification_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notification counts
CREATE OR REPLACE FUNCTION get_notification_counts(p_user_id uuid)
RETURNS TABLE (
  notification_type text,
  unread_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT nc.notification_type, nc.unread_count
  FROM notification_counts nc
  WHERE nc.user_id = p_user_id
    AND nc.unread_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if ad is available today (Watch & Earn badge)
CREATE OR REPLACE FUNCTION is_ad_available_today(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_last_watch_date date;
  v_today_gmt date;
BEGIN
  -- Get today's date in GMT
  v_today_gmt := (now() AT TIME ZONE 'GMT')::date;

  -- Get last ad watch date
  SELECT (last_ad_watch_date AT TIME ZONE 'GMT')::date INTO v_last_watch_date
  FROM ad_watches
  WHERE user_id = p_user_id
  ORDER BY last_ad_watch_date DESC
  LIMIT 1;

  -- If no watch record or watch date is before today, ad is available
  RETURN (v_last_watch_date IS NULL OR v_last_watch_date < v_today_gmt);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notification when new message is created
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sender_id != NEW.receiver_id THEN
    PERFORM create_notification(
      NEW.receiver_id,
      'message',
      NEW.id,
      NEW.sender_id,
      'New message received'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- Trigger to create notification when coin transfer is received
CREATE OR REPLACE FUNCTION notify_coin_received()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_type IN ('transfer_received', 'card_sale_royalty', 'card_swap_royalty', 'battle_royalty') THEN
    PERFORM create_notification(
      NEW.user_id,
      'coin_received',
      NEW.id,
      NEW.related_user_id,
      'You received coins'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_coin_received ON coin_transactions;
CREATE TRIGGER trigger_notify_coin_received
  AFTER INSERT ON coin_transactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_coin_received();

-- Trigger to create notification when coin transfer request is received
CREATE OR REPLACE FUNCTION notify_coin_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM create_notification(
      NEW.receiver_id,
      'coin_request',
      NEW.id,
      NEW.sender_id,
      'New coin request received'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_coin_request ON coin_transfers;
CREATE TRIGGER trigger_notify_coin_request
  AFTER INSERT ON coin_transfers
  FOR EACH ROW
  EXECUTE FUNCTION notify_coin_request();

-- Trigger to create notification when swap offer is received
CREATE OR REPLACE FUNCTION notify_swap_offer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.initiated_by = NEW.manager_a_id THEN
    -- Notify manager B
    PERFORM create_notification(
      NEW.manager_b_id,
      'swap_offer',
      NEW.id,
      NEW.manager_a_id,
      'New card swap offer received'
    );
  ELSIF NEW.status = 'pending' AND NEW.initiated_by = NEW.manager_b_id THEN
    -- Notify manager A
    PERFORM create_notification(
      NEW.manager_a_id,
      'swap_offer',
      NEW.id,
      NEW.manager_b_id,
      'New card swap offer received'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_swap_offer ON card_swaps;
CREATE TRIGGER trigger_notify_swap_offer
  AFTER INSERT ON card_swaps
  FOR EACH ROW
  EXECUTE FUNCTION notify_swap_offer();

-- Trigger to create notification when purchase offer is received
CREATE OR REPLACE FUNCTION notify_purchase_offer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM create_notification(
      NEW.current_owner_id,
      'purchase_offer',
      NEW.id,
      NEW.buyer_id,
      'New card purchase offer received'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_purchase_offer ON card_offers;
CREATE TRIGGER trigger_notify_purchase_offer
  AFTER INSERT ON card_offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_purchase_offer();

-- Trigger to create notification when card is sold
CREATE OR REPLACE FUNCTION notify_card_sold()
RETURNS TRIGGER AS $$
DECLARE
  v_card_owner_id uuid;
BEGIN
  IF NEW.transaction_type IN ('card_sale', 'card_purchase') THEN
    -- Notify the card's original owner
    SELECT card_user_id INTO v_card_owner_id
    FROM card_transactions
    WHERE id = NEW.id;
    
    IF v_card_owner_id IS NOT NULL AND v_card_owner_id != NEW.seller_id THEN
      PERFORM create_notification(
        v_card_owner_id,
        'card_sold',
        NEW.id,
        NEW.buyer_id,
        'Your card was sold'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_card_sold ON card_transactions;
CREATE TRIGGER trigger_notify_card_sold
  AFTER INSERT ON card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_card_sold();

-- Trigger to create notification when battle request is received
CREATE OR REPLACE FUNCTION notify_battle_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM create_notification(
      NEW.challenged_id,
      'battle_request',
      NEW.id,
      NEW.challenger_id,
      'New battle challenge received'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_battle_request ON battles;
CREATE TRIGGER trigger_notify_battle_request
  AFTER INSERT ON battles
  FOR EACH ROW
  EXECUTE FUNCTION notify_battle_request();

-- Trigger to create notification when profile is viewed
CREATE OR REPLACE FUNCTION notify_profile_view()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.viewer_id != NEW.viewed_id THEN
    PERFORM create_notification(
      NEW.viewed_id,
      'profile_view',
      NEW.id,
      NEW.viewer_id,
      'Someone viewed your profile'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_profile_view ON profile_views;
CREATE TRIGGER trigger_notify_profile_view
  AFTER INSERT ON profile_views
  FOR EACH ROW
  EXECUTE FUNCTION notify_profile_view();
