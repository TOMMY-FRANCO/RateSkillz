/*
  # Create Customizable Username System

  1. New Columns in profiles table
    - `username_last_changed` (timestamp) - Last time username was changed
    - `username_change_count` (integer) - Number of times username has been changed
    - `username_customized` (boolean) - Whether user has customized their username
  
  2. New Table
    - `username_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles) - User who changed username
      - `old_username` (text) - Previous username
      - `new_username` (text) - New username
      - `changed_at` (timestamp) - When the change occurred
  
  3. Functions
    - `validate_username_format` - Validates username format rules
    - `can_change_username` - Checks if user can change username (15-day cooldown)
    - `days_until_username_change` - Calculates days remaining until next change
    - `change_username` - Changes username with validation and history tracking
    - `check_username_available` - Checks if username is available (case-insensitive)
  
  4. Security
    - Enable RLS on username_history
    - Add unique index on lowercase(username)
    - Validate all username changes server-side
    - Enforce 15-day cooldown
  
  5. Important Notes
    - Usernames stored in LOWERCASE in database
    - Display in UPPERCASE in UI
    - First username change is immediate
    - Subsequent changes have 15-day cooldown
    - Max 16 characters
    - Can only contain: letters, numbers, ONE underscore, ONE period
    - Cannot start/end with underscore or period
*/

-- Add new columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'username_last_changed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN username_last_changed timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'username_change_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN username_change_count integer DEFAULT 0 NOT NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'username_customized'
  ) THEN
    ALTER TABLE profiles ADD COLUMN username_customized boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Convert existing usernames to lowercase
UPDATE profiles SET username = LOWER(username);

-- Create unique index on lowercase username for case-insensitive uniqueness
DROP INDEX IF EXISTS idx_profiles_username_lower;
CREATE UNIQUE INDEX idx_profiles_username_lower ON profiles (LOWER(username));

-- Create username_history table
CREATE TABLE IF NOT EXISTS username_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  old_username text NOT NULL,
  new_username text NOT NULL,
  changed_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_username_history_user_id ON username_history(user_id);
CREATE INDEX IF NOT EXISTS idx_username_history_changed_at ON username_history(changed_at DESC);

-- Enable RLS on username_history
ALTER TABLE username_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for username_history
CREATE POLICY "Users can view their own username history"
  ON username_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert username history"
  ON username_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to validate username format
CREATE OR REPLACE FUNCTION validate_username_format(p_username text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_underscore_count integer;
  v_period_count integer;
BEGIN
  -- Check if empty
  IF p_username IS NULL OR LENGTH(TRIM(p_username)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Username cannot be empty');
  END IF;
  
  -- Check length
  IF LENGTH(p_username) > 16 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Username must be 16 characters or less');
  END IF;
  
  -- Check if starts or ends with underscore or period
  IF p_username ~ '^[_.]' OR p_username ~ '[_.]$' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Username cannot start or end with underscore or period');
  END IF;
  
  -- Count underscores and periods
  v_underscore_count := LENGTH(p_username) - LENGTH(REPLACE(p_username, '_', ''));
  v_period_count := LENGTH(p_username) - LENGTH(REPLACE(p_username, '.', ''));
  
  IF v_underscore_count > 1 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Username can only contain one underscore');
  END IF;
  
  IF v_period_count > 1 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Username can only contain one period');
  END IF;
  
  -- Check for invalid characters (only letters, numbers, underscore, period allowed)
  IF p_username !~ '^[a-zA-Z0-9_.]+$' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Username can only contain letters, numbers, one underscore, and one period');
  END IF;
  
  RETURN jsonb_build_object('valid', true);
END;
$$;

-- Function to check username availability (case-insensitive)
CREATE OR REPLACE FUNCTION check_username_available(p_username text, p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Check if username exists (case-insensitive), excluding current user
  SELECT EXISTS(
    SELECT 1 FROM profiles
    WHERE LOWER(username) = LOWER(p_username)
    AND (p_user_id IS NULL OR id != p_user_id)
  ) INTO v_exists;
  
  RETURN NOT v_exists;
END;
$$;

-- Function to check if user can change username
CREATE OR REPLACE FUNCTION can_change_username(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_changed timestamptz;
  v_change_count integer;
  v_days_since_change numeric;
  v_days_remaining integer;
BEGIN
  -- Get user's username change info
  SELECT username_last_changed, username_change_count
  INTO v_last_changed, v_change_count
  FROM profiles
  WHERE id = p_user_id;
  
  -- First time change is always allowed
  IF v_change_count = 0 OR v_last_changed IS NULL THEN
    RETURN jsonb_build_object(
      'can_change', true,
      'days_remaining', 0,
      'is_first_change', true
    );
  END IF;
  
  -- Calculate days since last change
  v_days_since_change := EXTRACT(EPOCH FROM (now() - v_last_changed)) / 86400;
  
  -- Check if 15 days have passed
  IF v_days_since_change >= 15 THEN
    RETURN jsonb_build_object(
      'can_change', true,
      'days_remaining', 0,
      'is_first_change', false
    );
  ELSE
    v_days_remaining := CEIL(15 - v_days_since_change);
    RETURN jsonb_build_object(
      'can_change', false,
      'days_remaining', v_days_remaining,
      'is_first_change', false,
      'error', format('You can change your username again in %s days', v_days_remaining)
    );
  END IF;
END;
$$;

-- Function to change username
CREATE OR REPLACE FUNCTION change_username(
  p_user_id uuid,
  p_new_username text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_username text;
  v_validation jsonb;
  v_can_change jsonb;
  v_lowercase_username text;
BEGIN
  -- Verify the requesting user matches
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Convert to lowercase for storage
  v_lowercase_username := LOWER(TRIM(p_new_username));
  
  -- Validate username format
  v_validation := validate_username_format(v_lowercase_username);
  IF NOT (v_validation->>'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', v_validation->>'error');
  END IF;
  
  -- Check if user can change username (cooldown)
  v_can_change := can_change_username(p_user_id);
  IF NOT (v_can_change->>'can_change')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', v_can_change->>'error');
  END IF;
  
  -- Check if username is available
  IF NOT check_username_available(v_lowercase_username, p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username is already taken');
  END IF;
  
  -- Get current username
  SELECT username INTO v_old_username FROM profiles WHERE id = p_user_id;
  
  -- Check if username is actually different
  IF LOWER(v_old_username) = v_lowercase_username THEN
    RETURN jsonb_build_object('success', false, 'error', 'New username is the same as current username');
  END IF;
  
  -- Update username
  UPDATE profiles
  SET 
    username = v_lowercase_username,
    username_last_changed = now(),
    username_change_count = username_change_count + 1,
    username_customized = true,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Log in history
  INSERT INTO username_history (user_id, old_username, new_username)
  VALUES (p_user_id, v_old_username, v_lowercase_username);
  
  RETURN jsonb_build_object(
    'success', true,
    'new_username', v_lowercase_username,
    'old_username', v_old_username
  );
END;
$$;

-- Function to generate unique username from email
CREATE OR REPLACE FUNCTION generate_username_from_email(p_email text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_username text;
  v_username text;
  v_counter integer := 1;
  v_underscore_count integer;
  v_period_count integer;
BEGIN
  -- Extract part before @ and convert to lowercase
  v_base_username := LOWER(split_part(p_email, '@', 1));
  
  -- Remove all special characters except underscore and period
  v_base_username := regexp_replace(v_base_username, '[^a-z0-9_.]', '', 'g');
  
  -- Remove leading/trailing underscores and periods
  v_base_username := regexp_replace(v_base_username, '^[_.]+', '', 'g');
  v_base_username := regexp_replace(v_base_username, '[_.]+$', '', 'g');
  
  -- Keep only first underscore and first period
  v_underscore_count := LENGTH(v_base_username) - LENGTH(REPLACE(v_base_username, '_', ''));
  v_period_count := LENGTH(v_base_username) - LENGTH(REPLACE(v_base_username, '.', ''));
  
  IF v_underscore_count > 1 THEN
    -- Keep only first underscore
    v_base_username := regexp_replace(v_base_username, '_', '', 'g', 2);
  END IF;
  
  IF v_period_count > 1 THEN
    -- Keep only first period
    v_base_username := regexp_replace(v_base_username, '\.', '', 'g', 2);
  END IF;
  
  -- Ensure max 16 characters
  v_base_username := LEFT(v_base_username, 16);
  
  -- If empty after cleaning, use default
  IF LENGTH(v_base_username) = 0 THEN
    v_base_username := 'user';
  END IF;
  
  v_username := v_base_username;
  
  -- Find unique username by appending numbers if needed
  WHILE EXISTS(SELECT 1 FROM profiles WHERE LOWER(username) = v_username) LOOP
    v_username := LEFT(v_base_username, 16 - LENGTH(v_counter::text)) || v_counter::text;
    v_counter := v_counter + 1;
    
    -- Safety check to prevent infinite loop
    IF v_counter > 9999 THEN
      v_username := 'user' || floor(random() * 1000000)::text;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN v_username;
END;
$$;
