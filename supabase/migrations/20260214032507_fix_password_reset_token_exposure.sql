/*
  # Fix Password Reset Token Exposure

  ## Security Fix
  The `request_password_reset` RPC was returning the raw reset token to the caller.
  This is a critical security vulnerability because the token reaches the browser,
  allowing interception and account takeover.

  ## Changes
  1. Modified `request_password_reset` to return only success/failure and the reset row ID
     - Token is stored in DB but never returned to the caller
     - The `reset_id` is returned so a server-side edge function can look up the token securely
  2. Created `get_reset_token_by_id` - a SECURITY DEFINER function that retrieves the token
     by reset row ID, callable only from server-side (service role)
  3. Revoked anon/authenticated EXECUTE on `request_password_reset` so only the edge function
     (via service role) can call it

  ## Security
  - Token never leaves the database except to server-side edge functions
  - Frontend only receives success/failure
  - Rate limiting preserved
*/

-- Replace request_password_reset to NOT return the token
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
  v_reset_id uuid;
BEGIN
  p_email := lower(trim(p_email));
  
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'If this email exists, a password reset link has been sent.'
    );
  END IF;
  
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
  
  v_reset_token := generate_reset_token();
  v_token_expiry := now() + INTERVAL '30 minutes';
  
  INSERT INTO password_resets (
    user_id, email, reset_token, token_expiry, ip_address
  ) VALUES (
    v_user_id, p_email, v_reset_token, v_token_expiry, p_ip_address
  )
  RETURNING id INTO v_reset_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'reset_id', v_reset_id,
    'email', p_email,
    'message', 'Password reset token generated successfully.'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to process password reset request.'
    );
END;
$$;

-- Server-side only function to retrieve the token by reset row ID
CREATE OR REPLACE FUNCTION get_reset_token_by_id(p_reset_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT reset_token INTO v_token
  FROM password_resets
  WHERE id = p_reset_id
  AND used_at IS NULL
  AND token_expiry > now();

  RETURN v_token;
END;
$$;

-- Revoke direct browser access to request_password_reset
-- Only the edge function (via service role) should call it
REVOKE EXECUTE ON FUNCTION request_password_reset(text, text) FROM anon, authenticated;

-- The token lookup function should also be restricted
REVOKE EXECUTE ON FUNCTION get_reset_token_by_id(uuid) FROM anon, authenticated;
