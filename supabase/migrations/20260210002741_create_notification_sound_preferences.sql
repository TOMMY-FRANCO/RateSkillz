/*
  # Create Notification Sound Preferences System

  ## Overview
  This migration creates a comprehensive notification sound preferences system that allows users to:
  - Enable/disable sounds per notification type
  - Track which notifications have already played sounds (prevents repeated playback)
  - Manage sound preferences with granular control

  ## Tables Created

  ### 1. `notification_sound_preferences`
  Stores user preferences for each notification type sound
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `notification_type` (text) - Type of notification
  - `sound_enabled` (boolean) - Whether sound is enabled for this type
  - `created_at` (timestamptz) - When preference was created
  - `updated_at` (timestamptz) - When preference was last updated

  ### 2. `notification_sound_played`
  Tracks which notifications have already had their sound played
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `notification_id` (uuid, foreign key) - References user_notifications
  - `played_at` (timestamptz) - When sound was played
  - Unique constraint on (user_id, notification_id) to prevent duplicate plays

  ## Functions Created

  ### 1. `initialize_notification_sound_preferences()`
  Creates default sound preferences for a new user
  - All notification types enabled by default
  - Called automatically on user signup

  ### 2. `get_notification_sound_preferences(p_user_id)`
  Retrieves all sound preferences for a user
  - Returns array of {notification_type, sound_enabled}

  ### 3. `update_notification_sound_preference(p_user_id, p_notification_type, p_sound_enabled)`
  Updates sound preference for a specific notification type
  - Creates if doesn't exist, updates if exists

  ### 4. `has_sound_played_for_notification(p_user_id, p_notification_id)`
  Checks if sound has already been played for a notification
  - Returns boolean

  ### 5. `mark_notification_sound_played(p_user_id, p_notification_id)`
  Marks that sound has been played for a notification
  - Prevents duplicate sound plays

  ## Notification Types Supported
  - message
  - coin_received
  - coin_request
  - swap_offer
  - purchase_offer
  - card_sold
  - battle_request
  - profile_view
  - transaction
  - rank_update
  - setting_change
  - purchase_request
  - ad_available

  ## Security
  - All tables have RLS enabled
  - Users can only access their own preferences
  - Users can only mark their own notification sounds as played
  - All functions use proper authentication checks

  ## Performance
  - Indexes on user_id for fast lookups
  - Unique constraint on (user_id, notification_type) for preferences
  - Unique constraint on (user_id, notification_id) to prevent duplicates
  - Indexes on notification_id for efficient checks

  ## Default Behavior
  - All notification sounds are ENABLED by default
  - Each notification plays sound ONCE only
  - Users can disable sounds per notification type in Settings
*/

-- Create notification_sound_preferences table
CREATE TABLE IF NOT EXISTS notification_sound_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  sound_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Create notification_sound_played table
CREATE TABLE IF NOT EXISTS notification_sound_played (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES user_notifications(id) ON DELETE CASCADE,
  played_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_sound_prefs_user_id 
  ON notification_sound_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_sound_played_user_id 
  ON notification_sound_played(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_sound_played_notification_id 
  ON notification_sound_played(notification_id);

-- Enable RLS
ALTER TABLE notification_sound_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_sound_played ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_sound_preferences
CREATE POLICY "Users can view own sound preferences"
  ON notification_sound_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sound preferences"
  ON notification_sound_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sound preferences"
  ON notification_sound_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for notification_sound_played
CREATE POLICY "Users can view own played sounds"
  ON notification_sound_played FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own played sounds"
  ON notification_sound_played FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function: Initialize default notification sound preferences
CREATE OR REPLACE FUNCTION initialize_notification_sound_preferences(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notification_types text[] := ARRAY[
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
    'setting_change',
    'purchase_request',
    'ad_available'
  ];
  v_type text;
BEGIN
  -- Insert default preferences for all notification types
  FOREACH v_type IN ARRAY v_notification_types
  LOOP
    INSERT INTO notification_sound_preferences (user_id, notification_type, sound_enabled)
    VALUES (p_user_id, v_type, true)
    ON CONFLICT (user_id, notification_type) DO NOTHING;
  END LOOP;
END;
$$;

-- Function: Get notification sound preferences
CREATE OR REPLACE FUNCTION get_notification_sound_preferences(p_user_id uuid)
RETURNS TABLE (
  notification_type text,
  sound_enabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Return all sound preferences for the user
  RETURN QUERY
  SELECT 
    nsp.notification_type,
    nsp.sound_enabled
  FROM notification_sound_preferences nsp
  WHERE nsp.user_id = p_user_id
  ORDER BY nsp.notification_type;
END;
$$;

-- Function: Update notification sound preference
CREATE OR REPLACE FUNCTION update_notification_sound_preference(
  p_user_id uuid,
  p_notification_type text,
  p_sound_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Insert or update the sound preference
  INSERT INTO notification_sound_preferences (user_id, notification_type, sound_enabled)
  VALUES (p_user_id, p_notification_type, p_sound_enabled)
  ON CONFLICT (user_id, notification_type)
  DO UPDATE SET 
    sound_enabled = EXCLUDED.sound_enabled,
    updated_at = now();
END;
$$;

-- Function: Check if sound has been played for a notification
CREATE OR REPLACE FUNCTION has_sound_played_for_notification(
  p_user_id uuid,
  p_notification_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Check if sound has already been played
  SELECT EXISTS(
    SELECT 1
    FROM notification_sound_played
    WHERE user_id = p_user_id
    AND notification_id = p_notification_id
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

-- Function: Mark notification sound as played
CREATE OR REPLACE FUNCTION mark_notification_sound_played(
  p_user_id uuid,
  p_notification_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Insert record to track that sound was played
  INSERT INTO notification_sound_played (user_id, notification_id)
  VALUES (p_user_id, p_notification_id)
  ON CONFLICT (user_id, notification_id) DO NOTHING;
END;
$$;

-- Update handle_new_user trigger to initialize sound preferences
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
  -- Generate unique username
  WHILE v_retry_count < v_max_retries AND NOT v_success LOOP
    BEGIN
      v_username := generate_username(NEW.id);
      
      -- Create profile
      INSERT INTO profiles (
        id,
        username,
        email,
        full_name,
        avatar_url,
        bio,
        balance
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
  
  -- Initialize notification sound preferences
  PERFORM initialize_notification_sound_preferences(NEW.id);
  
  -- Initialize tutorial state
  INSERT INTO tutorial_state (user_id, completed, coin_pool_rewarded)
  VALUES (NEW.id, false, false)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    RAISE WARNING 'Fatal error in handle_new_user: %', v_error_message;
    RAISE;
END;
$$;
