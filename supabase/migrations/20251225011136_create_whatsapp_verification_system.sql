/*
  # WhatsApp Verification & Social Badge System

  1. Updates to profiles table
    - `is_verified` (boolean) - True when user shares profile on WhatsApp
    - `verification_date` (timestamptz) - When verification was completed
    - `friend_count` (integer) - Count of mutual friend connections
    - `has_social_badge` (boolean) - True when user has 5+ friends
    - `verification_share_token` (text) - Unique token for tracking WhatsApp shares

  2. New Tables
    - `verification_logs`
      - Tracks verification events
      - Records share dates and confirmation dates
      - Links to user profiles

    - `friend_requests`
      - Mutual friend system
      - Tracks sent, pending, and accepted friend connections
      - Auto-updates friend_count when accepted

  3. Security
    - Enable RLS on all new tables
    - Users can view own verification status
    - Users can update own verification when valid
    - Public can view verified status on profiles

  4. Functions
    - Auto-generate verification tokens
    - Track WhatsApp share clicks
    - Update friend counts automatically
    - Award social badge when friend_count >= 5
*/

-- Add verification columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verification_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verification_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'friend_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN friend_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'has_social_badge'
  ) THEN
    ALTER TABLE profiles ADD COLUMN has_social_badge boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verification_share_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verification_share_token text UNIQUE;
  END IF;
END $$;

-- Create verification_logs table
CREATE TABLE IF NOT EXISTS verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  share_date timestamptz DEFAULT now(),
  verification_confirmed_date timestamptz,
  share_platform text DEFAULT 'whatsapp',
  token_used text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

-- Create friend_requests table for mutual friend system
CREATE TABLE IF NOT EXISTS friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for verification_logs
CREATE POLICY "Users can view own verification logs"
  ON verification_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification logs"
  ON verification_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for friend_requests
CREATE POLICY "Users can view own friend requests"
  ON friend_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send friend requests"
  ON friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update received friend requests"
  ON friend_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

CREATE POLICY "Users can delete own sent requests"
  ON friend_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- Function to generate unique verification token
CREATE OR REPLACE FUNCTION generate_verification_token()
RETURNS text AS $$
BEGIN
  RETURN encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to update friend count
CREATE OR REPLACE FUNCTION update_friend_count()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    -- Update both users' friend counts
    UPDATE profiles
    SET friend_count = (
      SELECT COUNT(*)
      FROM friend_requests
      WHERE (sender_id = profiles.id OR receiver_id = profiles.id)
      AND status = 'accepted'
    )
    WHERE id IN (NEW.sender_id, NEW.receiver_id);

    -- Check if either user now qualifies for social badge (5+ friends)
    UPDATE profiles
    SET has_social_badge = true
    WHERE id IN (NEW.sender_id, NEW.receiver_id)
    AND friend_count >= 5
    AND is_verified = true
    AND has_social_badge = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update friend counts
DROP TRIGGER IF EXISTS trigger_update_friend_count ON friend_requests;
CREATE TRIGGER trigger_update_friend_count
  AFTER UPDATE OF status ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_friend_count();

-- Function to mark user as verified when share is confirmed
CREATE OR REPLACE FUNCTION confirm_whatsapp_verification(
  p_token text
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- Find user by token
  SELECT id INTO v_user_id
  FROM profiles
  WHERE verification_share_token = p_token
  AND is_verified = false;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid or already used verification token'
    );
  END IF;

  -- Mark user as verified
  UPDATE profiles
  SET
    is_verified = true,
    verification_date = now()
  WHERE id = v_user_id;

  -- Log the verification
  UPDATE verification_logs
  SET verification_confirmed_date = now()
  WHERE user_id = v_user_id
  AND token_used = p_token;

  -- Check if user also qualifies for social badge
  UPDATE profiles
  SET has_social_badge = true
  WHERE id = v_user_id
  AND friend_count >= 5;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile verified successfully',
    'user_id', v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate verification token for user
CREATE OR REPLACE FUNCTION generate_user_verification_token()
RETURNS text AS $$
DECLARE
  v_token text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Generate unique token
  v_token := generate_verification_token();

  -- Update user's verification token
  UPDATE profiles
  SET verification_share_token = v_token
  WHERE id = v_user_id;

  -- Create verification log
  INSERT INTO verification_logs (user_id, token_used, share_platform)
  VALUES (v_user_id, v_token, 'whatsapp');

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_logs_user_id ON verification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_token ON verification_logs(token_used);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_token ON profiles(verification_share_token);
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON profiles(is_verified);
