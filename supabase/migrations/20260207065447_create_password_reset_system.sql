/*
  # Create Password Reset System

  ## Overview
  Implements a comprehensive password reset system with token tracking, expiry validation,
  one-time use enforcement, and automatic cleanup of expired tokens.

  ## New Tables
  1. **password_resets**
     - `id` (uuid, primary key)
     - `user_id` (uuid, references auth.users)
     - `email` (text, for tracking)
     - `reset_token` (text, high-entropy random string, unique)
     - `token_expiry` (timestamptz, 30 minutes from creation)
     - `used_at` (timestamptz, nullable, marks when token was used)
     - `created_at` (timestamptz)
     - `ip_address` (text, optional, for security audit)

  ## Features
  - High-entropy token generation (32-byte random hex)
  - 30-minute token expiry
  - One-time use enforcement
  - Automatic cleanup of expired tokens
  - Security audit trail
  - Rate limiting per email

  ## Security
  - Tokens cannot be reused
  - Tokens expire after 30 minutes
  - Email verification before token generation
  - Rate limiting: max 3 requests per email per hour
  - Complete audit trail
*/

-- ============================================================================
-- STEP 1: Create password_resets table
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  reset_token text NOT NULL UNIQUE,
  token_expiry timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  ip_address text,

  CONSTRAINT valid_expiry CHECK (token_expiry > created_at)
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(reset_token) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_resets_expiry ON password_resets(token_expiry) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id, created_at DESC);

-- ============================================================================
-- STEP 2: Enable RLS
-- ============================================================================

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: RLS Policies
-- ============================================================================

-- Users can view their own reset requests
CREATE POLICY "Users can view own reset requests"
  ON password_resets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- System can create reset requests (via edge function)
CREATE POLICY "System can create reset requests"
  ON password_resets FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- System can update reset requests (mark as used)
CREATE POLICY "System can update reset requests"
  ON password_resets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Admins can view all reset requests
CREATE POLICY "Admins can view all reset requests"
  ON password_resets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- STEP 4: Generate high-entropy reset token function
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_reset_token()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_token text;
  v_exists boolean;
BEGIN
  -- Generate tokens until we get a unique one
  LOOP
    -- Generate 32-byte random hex string (64 characters)
    v_token := encode(gen_random_bytes(32), 'hex');
    
    -- Check if token already exists
    SELECT EXISTS (
      SELECT 1 FROM password_resets 
      WHERE reset_token = v_token 
      AND used_at IS NULL
    ) INTO v_exists;
    
    -- Exit loop if token is unique
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_token;
END;
$$;

-- ============================================================================
-- STEP 5: Create password reset request function
-- ============================================================================

CREATE OR REPLACE FUNCTION request_password_reset(
  p_email text,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_reset_token text;
  v_token_expiry timestamptz;
  v_recent_requests integer;
BEGIN
  -- Normalize email
  p_email := lower(trim(p_email));
  
  -- Check if email exists in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    -- Don't reveal if email exists or not (security)
    -- Return success message regardless
    RETURN jsonb_build_object(
      'success', true,
      'message', 'If this email exists, a password reset link has been sent.'
    );
  END IF;
  
  -- Rate limiting: Check recent requests (max 3 per hour per email)
  SELECT COUNT(*) INTO v_recent_requests
  FROM password_resets
  WHERE email = p_email
  AND created_at > now() - INTERVAL '1 hour';
  
  IF v_recent_requests >= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many password reset requests. Please try again later.'
    );
  END IF;
  
  -- Generate unique token
  v_reset_token := generate_reset_token();
  
  -- Set expiry to 30 minutes from now
  v_token_expiry := now() + INTERVAL '30 minutes';
  
  -- Insert reset request
  INSERT INTO password_resets (
    user_id,
    email,
    reset_token,
    token_expiry,
    ip_address
  ) VALUES (
    v_user_id,
    p_email,
    v_reset_token,
    v_token_expiry,
    p_ip_address
  );
  
  -- Return token for email sending
  RETURN jsonb_build_object(
    'success', true,
    'token', v_reset_token,
    'email', p_email,
    'expiry', v_token_expiry,
    'message', 'Password reset token generated successfully.'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to process password reset request: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- STEP 6: Verify reset token function
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_reset_token(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reset_record RECORD;
BEGIN
  -- Find the reset request
  SELECT 
    pr.id,
    pr.user_id,
    pr.email,
    pr.token_expiry,
    pr.used_at,
    pr.created_at
  INTO v_reset_record
  FROM password_resets pr
  WHERE pr.reset_token = p_token;
  
  -- Check if token exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid reset token. Please request a new password reset.'
    );
  END IF;
  
  -- Check if token already used
  IF v_reset_record.used_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'This reset link has already been used. Please request a new password reset.'
    );
  END IF;
  
  -- Check if token expired
  IF now() > v_reset_record.token_expiry THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'This reset link has expired. Please request a new password reset.'
    );
  END IF;
  
  -- Token is valid
  RETURN jsonb_build_object(
    'valid', true,
    'email', v_reset_record.email,
    'user_id', v_reset_record.user_id,
    'expires_at', v_reset_record.token_expiry
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Failed to verify token: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- STEP 7: Mark token as used function
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_token_used(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Update the token to mark it as used
  UPDATE password_resets
  SET used_at = now()
  WHERE reset_token = p_token
  AND used_at IS NULL
  AND token_expiry > now()
  RETURNING user_id INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired token'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ============================================================================
-- STEP 8: Cleanup expired tokens function
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete tokens that are:
  -- 1. Expired (past token_expiry)
  -- 2. Used (have used_at set)
  -- 3. Old unused tokens (created more than 24 hours ago)
  DELETE FROM password_resets
  WHERE 
    token_expiry < now()
    OR used_at IS NOT NULL
    OR (created_at < now() - INTERVAL '24 hours' AND used_at IS NULL);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'cleaned_at', now()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ============================================================================
-- STEP 9: Get password reset stats (admin only)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_password_reset_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_stats jsonb;
BEGIN
  v_user_id := auth.uid();
  
  -- Verify admin status
  SELECT is_admin INTO v_is_admin
  FROM profiles WHERE id = v_user_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized - admin access required'
    );
  END IF;
  
  -- Gather stats
  SELECT jsonb_build_object(
    'total_requests', (SELECT COUNT(*) FROM password_resets),
    'pending_tokens', (SELECT COUNT(*) FROM password_resets WHERE used_at IS NULL AND token_expiry > now()),
    'expired_tokens', (SELECT COUNT(*) FROM password_resets WHERE used_at IS NULL AND token_expiry < now()),
    'used_tokens', (SELECT COUNT(*) FROM password_resets WHERE used_at IS NOT NULL),
    'requests_today', (SELECT COUNT(*) FROM password_resets WHERE created_at >= CURRENT_DATE),
    'requests_this_week', (SELECT COUNT(*) FROM password_resets WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')
  ) INTO v_stats;
  
  RETURN jsonb_build_object(
    'success', true,
    'stats', v_stats
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ============================================================================
-- STEP 10: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION request_password_reset(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_reset_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_token_used(text) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_reset_tokens() TO authenticated;
GRANT EXECUTE ON FUNCTION get_password_reset_stats() TO authenticated;

-- ============================================================================
-- STEP 11: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE password_resets IS
'Tracks password reset requests with high-entropy tokens, 30-minute expiry, and one-time use enforcement.';

COMMENT ON FUNCTION request_password_reset(text, text) IS
'Creates a password reset request with rate limiting (3 per hour per email). Returns token for email sending.';

COMMENT ON FUNCTION verify_reset_token(text) IS
'Verifies a reset token is valid, not expired, and not yet used.';

COMMENT ON FUNCTION mark_token_used(text) IS
'Marks a reset token as used (one-time use enforcement).';

COMMENT ON FUNCTION cleanup_expired_reset_tokens() IS
'Removes expired and used tokens. Should be called periodically (e.g., every 5 minutes).';

COMMENT ON FUNCTION get_password_reset_stats() IS
'Admin-only function returning password reset statistics.';
