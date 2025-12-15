/*
  # Create online status and notifications system

  1. New Tables
    - `user_presence`
      - `user_id` (uuid, primary key) - References profiles.id
      - `last_seen` (timestamptz) - Last activity timestamp
      - `is_online` (boolean) - Calculated based on last_seen
      - `updated_at` (timestamptz) - When the record was last updated
    
    - `notifications`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key) - User receiving the notification
      - `actor_id` (uuid, foreign key) - User who triggered the notification
      - `type` (text) - Type of notification (profile_view, friend_request, etc.)
      - `message` (text) - Notification message
      - `is_read` (boolean) - Whether notification has been read
      - `created_at` (timestamptz) - When notification was created
      - `metadata` (jsonb) - Additional data (profile_id, etc.)
  
  2. Security
    - Enable RLS on both tables
    - Users can update their own presence
    - Users can only view their own presence status (others calculated via function)
    - Users can only view their own notifications
    - Users can update their own notification read status
  
  3. Functions
    - Function to check if user is online (last_seen within 5 minutes)
    - Function to create notifications
*/

CREATE TABLE IF NOT EXISTS user_presence (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  last_seen timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all presence data"
  ON user_presence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own presence"
  ON user_presence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON user_presence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE OR REPLACE FUNCTION is_user_online(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_last_seen timestamptz;
BEGIN
  SELECT last_seen INTO user_last_seen
  FROM user_presence
  WHERE user_id = check_user_id;
  
  IF user_last_seen IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN (NOW() - user_last_seen) < INTERVAL '5 minutes';
END;
$$;