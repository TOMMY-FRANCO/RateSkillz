/*
  # Add batch mark notifications read function

  1. New Functions
    - `mark_notifications_read_batch` - Marks multiple notification types as read in a single call
      - `p_user_id` (uuid) - The user whose notifications to mark
      - `p_notification_types` (text[]) - Array of notification type strings to clear
    
  2. Purpose
    - Reduces multiple sequential RPC calls (e.g., 3-4 per page) down to 1
    - Improves page load performance on Inbox and Trading pages
    
  3. Security
    - Uses SECURITY DEFINER with restricted search_path
    - Only affects rows owned by the specified user
*/

CREATE OR REPLACE FUNCTION mark_notifications_read_batch(
  p_user_id uuid,
  p_notification_types text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE user_notifications
  SET is_read = true,
      read_at = now()
  WHERE user_id = p_user_id
    AND notification_type = ANY(p_notification_types)
    AND is_read = false;

  UPDATE notification_counts
  SET unread_count = 0,
      last_checked_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id
    AND notification_type = ANY(p_notification_types);
END;
$$;
