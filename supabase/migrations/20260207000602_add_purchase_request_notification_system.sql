/*
  # Add Purchase Request Notification System

  1. Schema Changes
    - Add 'purchase_request' to user_notifications.notification_type enum
    - Add 'purchase_request' to notification_counts.notification_type enum

  2. New Trigger
    - Create trigger on purchase_requests table to generate notifications
    - When a purchase request is created, notify the seller (card owner)

  3. Security
    - Functions use SECURITY DEFINER for consistent access
    - All operations follow existing notification patterns
*/

-- Drop existing notification_type constraint on user_notifications
ALTER TABLE user_notifications
DROP CONSTRAINT IF EXISTS user_notifications_notification_type_check;

-- Add updated constraint with 'purchase_request' type
ALTER TABLE user_notifications
ADD CONSTRAINT user_notifications_notification_type_check
CHECK (notification_type = ANY (ARRAY[
  'message'::text, 
  'coin_received'::text, 
  'coin_request'::text, 
  'swap_offer'::text, 
  'purchase_offer'::text, 
  'card_sold'::text, 
  'battle_request'::text, 
  'profile_view'::text, 
  'transaction'::text, 
  'rank_update'::text, 
  'setting_change'::text,
  'purchase_request'::text
]));

-- Drop existing notification_type constraint on notification_counts
ALTER TABLE notification_counts
DROP CONSTRAINT IF EXISTS notification_counts_notification_type_check;

-- Add updated constraint with 'purchase_request' type
ALTER TABLE notification_counts
ADD CONSTRAINT notification_counts_notification_type_check
CHECK (notification_type = ANY (ARRAY[
  'message'::text, 
  'coin_received'::text, 
  'coin_request'::text, 
  'swap_offer'::text, 
  'purchase_offer'::text, 
  'card_sold'::text, 
  'battle_request'::text, 
  'profile_view'::text, 
  'transaction'::text, 
  'rank_update'::text, 
  'setting_change'::text,
  'purchase_request'::text
]));

-- Create function to notify seller when purchase request is created
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
  -- Only notify on new pending requests
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Get buyer username
    SELECT username INTO v_buyer_username
    FROM profiles
    WHERE id = NEW.buyer_id;
    
    -- Get card user's username
    SELECT username INTO v_card_username
    FROM profiles
    WHERE id = NEW.card_user_id;
    
    -- Build notification message
    v_message := COALESCE(v_buyer_username, 'Someone') || ' wants to buy ' || 
                 COALESCE(v_card_username, 'a') || '''s card for ' || 
                 NEW.requested_price || ' coins';
    
    -- Create notification for seller
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
    
    -- Update notification count for seller
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

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_notify_purchase_request ON purchase_requests;

-- Create trigger for purchase request notifications
CREATE TRIGGER trg_notify_purchase_request
  AFTER INSERT ON purchase_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_purchase_request();

-- Update existing get_notification_counts function to include purchase_request
CREATE OR REPLACE FUNCTION get_notification_counts(p_user_id uuid)
RETURNS TABLE (notification_type text, unread_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT nc.notification_type, nc.unread_count
  FROM notification_counts nc
  WHERE nc.user_id = p_user_id
  AND nc.unread_count > 0;
END;
$$;

-- Mark purchase_request notifications as read function
CREATE OR REPLACE FUNCTION mark_purchase_request_notifications_read(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Mark notifications as read
  UPDATE user_notifications
  SET is_read = true
  WHERE user_id = p_user_id
  AND notification_type = 'purchase_request'
  AND is_read = false;
  
  -- Reset count
  UPDATE notification_counts
  SET unread_count = 0, updated_at = now()
  WHERE user_id = p_user_id
  AND notification_type = 'purchase_request';
END;
$$;

-- Function to clear purchase_request notification when request is handled
CREATE OR REPLACE FUNCTION clear_purchase_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- When request status changes from pending to approved/declined
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'declined') THEN
    -- Mark related notification as read
    UPDATE user_notifications
    SET is_read = true
    WHERE related_id = NEW.id
    AND notification_type = 'purchase_request'
    AND is_read = false;
    
    -- Decrement count (but don't go below 0)
    UPDATE notification_counts
    SET unread_count = GREATEST(0, unread_count - 1),
        updated_at = now()
    WHERE user_id = NEW.seller_id
    AND notification_type = 'purchase_request';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_clear_purchase_request_notification ON purchase_requests;

-- Create trigger to clear notification when request is handled
CREATE TRIGGER trg_clear_purchase_request_notification
  AFTER UPDATE ON purchase_requests
  FOR EACH ROW
  EXECUTE FUNCTION clear_purchase_request_notification();
