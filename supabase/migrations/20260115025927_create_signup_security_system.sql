/*
  # Create Signup Security System

  ## Overview
  Adds security measures to prevent abuse during signup:
  - Rate limiting table to track signup attempts by IP
  - Email uniqueness constraint to prevent duplicates
  - Automatic cleanup of old rate limit data

  ## New Tables
  
  ### `signup_rate_limit`
  Tracks signup attempts by IP address for rate limiting
  - `id` (uuid, primary key) - Unique identifier
  - `ip_address` (text, unique) - IP address of signup attempt
  - `signup_count` (integer, default 0) - Number of signups in current period
  - `last_signup_at` (timestamptz) - Timestamp of last signup attempt
  - `reset_date` (date) - Date when counter resets (for daily limits)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp

  ## Security
  - Enable RLS on signup_rate_limit table
  - Only service role can read/write (prevents user manipulation)
  - Automatic cleanup function for old records (30 days)

  ## Important Notes
  - Rate limit: 5 signups per IP per day
  - Old records (30+ days) cleaned up automatically
  - IP tracking only used for signup security, not stored long-term
*/

-- Create signup rate limit tracking table
CREATE TABLE IF NOT EXISTS signup_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text UNIQUE NOT NULL,
  signup_count integer DEFAULT 0 NOT NULL,
  last_signup_at timestamptz DEFAULT now(),
  reset_date date DEFAULT CURRENT_DATE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS (only service role can access)
ALTER TABLE signup_rate_limit ENABLE ROW LEVEL SECURITY;

-- No policies needed - only service role/Edge Functions can access
-- This prevents users from manipulating rate limit data

-- Create index for faster IP lookups
CREATE INDEX IF NOT EXISTS idx_signup_rate_limit_ip 
  ON signup_rate_limit(ip_address);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_signup_rate_limit_created_at 
  ON signup_rate_limit(created_at);

-- Ensure email is unique in profiles table (if not already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_email_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- Function to clean up old rate limit records (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_signup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM signup_rate_limit
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Function to check and update rate limit
CREATE OR REPLACE FUNCTION check_signup_rate_limit(
  p_ip_address text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record signup_rate_limit%ROWTYPE;
  v_current_date date := CURRENT_DATE;
BEGIN
  -- Get or create rate limit record
  SELECT * INTO v_record
  FROM signup_rate_limit
  WHERE ip_address = p_ip_address;

  -- If no record exists, create one
  IF v_record IS NULL THEN
    INSERT INTO signup_rate_limit (ip_address, signup_count, reset_date)
    VALUES (p_ip_address, 0, v_current_date)
    RETURNING * INTO v_record;
  END IF;

  -- Reset counter if it's a new day
  IF v_record.reset_date < v_current_date THEN
    UPDATE signup_rate_limit
    SET signup_count = 0,
        reset_date = v_current_date,
        updated_at = now()
    WHERE ip_address = p_ip_address
    RETURNING * INTO v_record;
  END IF;

  -- Check if limit exceeded (5 per day)
  IF v_record.signup_count >= 5 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'message', 'Too many signup attempts. Please try again tomorrow.',
      'current_count', v_record.signup_count,
      'limit', 5
    );
  END IF;

  -- Allow signup
  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', v_record.signup_count,
    'limit', 5
  );
END;
$$;

-- Function to increment signup count after successful signup
CREATE OR REPLACE FUNCTION increment_signup_count(
  p_ip_address text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE signup_rate_limit
  SET signup_count = signup_count + 1,
      last_signup_at = now(),
      updated_at = now()
  WHERE ip_address = p_ip_address;

  -- If no record exists, create one with count 1
  IF NOT FOUND THEN
    INSERT INTO signup_rate_limit (ip_address, signup_count, last_signup_at)
    VALUES (p_ip_address, 1, now());
  END IF;
END;
$$;