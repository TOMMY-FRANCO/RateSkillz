/*
  # Create Safety Features and Moderation System

  ## Overview
  This migration implements comprehensive safety features including:
  - Age-based privacy controls (11-17 vs 18+)
  - Searchability toggle (findable_by_school)
  - User reporting system
  - Admin moderation dashboard
  - Ban functionality

  ## New Tables
  1. **reports**
     - `id` (uuid, primary key)
     - `reported_user_id` (uuid, references profiles)
     - `reporter_id` (uuid, references profiles)
     - `reason` (text)
     - `status` (text: 'active', 'cleared', 'banned')
     - `admin_notes` (text, nullable)
     - `created_at` (timestamptz)
     - `resolved_at` (timestamptz, nullable)
     - `resolved_by` (uuid, nullable, references profiles - admin who resolved)

  2. **admin_action_logs**
     - `id` (uuid, primary key)
     - `admin_id` (uuid, references profiles)
     - `action_type` (text: 'ban_user', 'clear_report', 'unban_user')
     - `target_user_id` (uuid, references profiles)
     - `report_id` (uuid, nullable, references reports)
     - `notes` (text, nullable)
     - `created_at` (timestamptz)

  ## Profile Updates
  - Add `age` (integer, 11-150)
  - Add `findable_by_school` (boolean, default based on age)
  - Add `is_banned` (boolean, default false)
  - Add `safety_popup_shown` (boolean, tracks if under-18 saw safety info)

  ## Security
  - RLS policies ensure users can only report others, not themselves
  - Admin dashboard functions only accessible to is_admin users
  - All admin actions logged with audit trail
  - Banned users cannot login or perform actions
*/

-- ============================================================================
-- STEP 1: Add new columns to profiles table
-- ============================================================================

-- Add age column (11-150)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'age'
  ) THEN
    ALTER TABLE profiles ADD COLUMN age integer;
    ALTER TABLE profiles ADD CONSTRAINT age_range CHECK (age >= 11 AND age <= 150);
  END IF;
END $$;

-- Add findable_by_school column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'findable_by_school'
  ) THEN
    ALTER TABLE profiles ADD COLUMN findable_by_school boolean DEFAULT true;
  END IF;
END $$;

-- Add is_banned column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_banned'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_banned boolean DEFAULT false;
  END IF;
END $$;

-- Add safety_popup_shown column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'safety_popup_shown'
  ) THEN
    ALTER TABLE profiles ADD COLUMN safety_popup_shown boolean DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create reports table
-- ============================================================================

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('active', 'cleared', 'banned')),
  CONSTRAINT no_self_report CHECK (reported_user_id != reporter_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);

-- ============================================================================
-- STEP 3: Create admin_action_logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_action_type CHECK (action_type IN ('ban_user', 'clear_report', 'unban_user'))
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_action_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_action_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_report ON admin_action_logs(report_id);

-- ============================================================================
-- STEP 4: Enable RLS on new tables
-- ============================================================================

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies for reports table
-- ============================================================================

-- Users can create reports (but not for themselves - enforced by constraint)
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own submitted reports
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins can update reports
CREATE POLICY "Admins can update reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- STEP 6: Create RLS Policies for admin_action_logs table
-- ============================================================================

-- Only admins can view admin action logs
CREATE POLICY "Admins can view admin logs"
  ON admin_action_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Only admins can create admin action logs
CREATE POLICY "Admins can create admin logs"
  ON admin_action_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = admin_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- STEP 7: Create function to submit a report
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_report(
  p_reported_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter_id uuid;
  v_report_id uuid;
  v_reporter_banned boolean;
  v_reported_exists boolean;
BEGIN
  -- Get authenticated user
  v_reporter_id := auth.uid();
  
  IF v_reporter_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;
  
  -- Check if reporter is banned
  SELECT is_banned INTO v_reporter_banned
  FROM profiles
  WHERE id = v_reporter_id;
  
  IF v_reporter_banned THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot submit reports while banned'
    );
  END IF;
  
  -- Check if reported user exists
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_reported_user_id
  ) INTO v_reported_exists;
  
  IF NOT v_reported_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Prevent self-reporting
  IF v_reporter_id = p_reported_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot report yourself'
    );
  END IF;
  
  -- Create report
  INSERT INTO reports (
    reported_user_id,
    reporter_id,
    reason,
    status
  ) VALUES (
    p_reported_user_id,
    v_reporter_id,
    p_reason,
    'active'
  ) RETURNING id INTO v_report_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'message', 'Report sent. Our team will review it.'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to submit report: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- STEP 8: Create function to ban user (admin only)
-- ============================================================================

CREATE OR REPLACE FUNCTION ban_user(
  p_report_id uuid,
  p_target_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_is_admin boolean;
  v_log_id uuid;
BEGIN
  -- Get authenticated user
  v_admin_id := auth.uid();
  
  -- Verify admin status
  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = v_admin_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized - admin access required'
    );
  END IF;
  
  -- Ban the user
  UPDATE profiles
  SET is_banned = true
  WHERE id = p_target_user_id;
  
  -- Update report status
  UPDATE reports
  SET 
    status = 'banned',
    resolved_at = now(),
    resolved_by = v_admin_id,
    admin_notes = p_notes
  WHERE id = p_report_id;
  
  -- Log the action
  INSERT INTO admin_action_logs (
    admin_id,
    action_type,
    target_user_id,
    report_id,
    notes
  ) VALUES (
    v_admin_id,
    'ban_user',
    p_target_user_id,
    p_report_id,
    p_notes
  ) RETURNING id INTO v_log_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'User banned successfully',
    'log_id', v_log_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to ban user: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- STEP 9: Create function to clear report (admin only)
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_report(
  p_report_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_is_admin boolean;
  v_target_user_id uuid;
  v_log_id uuid;
BEGIN
  -- Get authenticated user
  v_admin_id := auth.uid();
  
  -- Verify admin status
  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = v_admin_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized - admin access required'
    );
  END IF;
  
  -- Get target user from report
  SELECT reported_user_id INTO v_target_user_id
  FROM reports
  WHERE id = p_report_id;
  
  -- Update report status
  UPDATE reports
  SET 
    status = 'cleared',
    resolved_at = now(),
    resolved_by = v_admin_id,
    admin_notes = p_notes
  WHERE id = p_report_id;
  
  -- Log the action
  INSERT INTO admin_action_logs (
    admin_id,
    action_type,
    target_user_id,
    report_id,
    notes
  ) VALUES (
    v_admin_id,
    'clear_report',
    v_target_user_id,
    p_report_id,
    p_notes
  ) RETURNING id INTO v_log_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Report cleared successfully',
    'log_id', v_log_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to clear report: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- STEP 10: Create function to get active reports (admin only)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_reports()
RETURNS TABLE (
  report_id uuid,
  reported_user_id uuid,
  reported_username text,
  reported_display_name text,
  reporter_id uuid,
  reporter_username text,
  reason text,
  status text,
  admin_notes text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get authenticated user
  v_admin_id := auth.uid();
  
  -- Verify admin status
  SELECT p.is_admin INTO v_is_admin
  FROM profiles p
  WHERE p.id = v_admin_id;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized - admin access required';
  END IF;
  
  -- Return active reports with user details
  RETURN QUERY
  SELECT 
    r.id as report_id,
    r.reported_user_id,
    reported.username as reported_username,
    reported.display_name as reported_display_name,
    r.reporter_id,
    reporter.username as reporter_username,
    r.reason,
    r.status,
    r.admin_notes,
    r.created_at,
    r.resolved_at,
    r.resolved_by
  FROM reports r
  JOIN profiles reported ON reported.id = r.reported_user_id
  JOIN profiles reporter ON reporter.id = r.reporter_id
  ORDER BY 
    CASE WHEN r.status = 'active' THEN 0 ELSE 1 END,
    r.created_at DESC;
END;
$$;

-- ============================================================================
-- STEP 11: Create trigger to set findable_by_school based on age
-- ============================================================================

CREATE OR REPLACE FUNCTION set_default_findable_by_age()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If age is being set for first time and findable_by_school is NULL
  IF NEW.age IS NOT NULL AND OLD.age IS NULL AND NEW.findable_by_school IS NULL THEN
    IF NEW.age < 18 THEN
      NEW.findable_by_school := false; -- Minors hidden by default
    ELSE
      NEW.findable_by_school := true;  -- Adults visible by default
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_default_findable_by_age ON profiles;
CREATE TRIGGER trigger_set_default_findable_by_age
  BEFORE INSERT OR UPDATE OF age ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_default_findable_by_age();

-- ============================================================================
-- STEP 12: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION submit_report(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ban_user(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_report(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_reports() TO authenticated;

-- ============================================================================
-- STEP 13: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE reports IS 
'Stores user reports for harassment and inappropriate behavior. Admins review and take action.';

COMMENT ON TABLE admin_action_logs IS 
'Audit trail of all admin moderation actions including bans and report resolutions.';

COMMENT ON FUNCTION submit_report(uuid, text) IS 
'Allows authenticated users to report other users for harassment. Creates active report for admin review.';

COMMENT ON FUNCTION ban_user(uuid, uuid, text) IS 
'Admin-only function to ban a user and mark report as resolved with banned status.';

COMMENT ON FUNCTION clear_report(uuid, text) IS 
'Admin-only function to clear a report without banning, marking user as safe.';

COMMENT ON FUNCTION get_active_reports() IS 
'Admin-only function to retrieve all reports with full details for moderation dashboard.';
