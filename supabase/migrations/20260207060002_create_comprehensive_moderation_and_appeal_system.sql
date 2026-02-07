/*
  # Create Comprehensive Moderation and Appeal System

  ## Overview
  This migration implements a full moderation case management and appeal system with:
  - Structured moderation cases with reason codes
  - 72-hour appeal window for reported users
  - Auto-escalation after deadline
  - Progressive enforcement (warning → 7-day suspension → permanent block)
  - Critical review flagging for repeat offenders
  - Device ID tracking for enforcement
  - Shadow banning during appeal windows

  ## New Tables
  1. **moderation_cases**
     - `case_id` (uuid, primary key)
     - `target_user_id` (uuid, references profiles)
     - `reporter_id` (uuid, references profiles)
     - `reason_code` (text: enum of violation types)
     - `reason_details` (text: additional context from reporter)
     - `status` (text: Pending, Warning Issued, Appealed, Resolved, Auto-Escalated)
     - `severity` (text: Low, Medium, High, Critical)
     - `appeal_deadline` (timestamptz: created_at + 72 hours)
     - `appeal_text` (text, nullable: user's appeal)
     - `appeal_submitted_at` (timestamptz, nullable)
     - `is_resolved` (boolean, default false)
     - `resolution_action` (text, nullable: None, Warning, 7-Day Suspension, Permanent Block)
     - `resolved_by` (uuid, nullable: admin who resolved)
     - `resolved_at` (timestamptz, nullable)
     - `admin_notes` (text, nullable)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  2. **enforcement_history**
     - `id` (uuid, primary key)
     - `user_id` (uuid, references profiles)
     - `case_id` (uuid, references moderation_cases)
     - `action_type` (text: Warning, 7-Day Suspension, Permanent Block, Account Deletion)
     - `starts_at` (timestamptz)
     - `ends_at` (timestamptz, nullable)
     - `device_ids` (text[], array of device identifiers)
     - `is_active` (boolean)
     - `created_at` (timestamptz)

  3. **critical_review_flags**
     - `id` (uuid, primary key)
     - `user_id` (uuid, references profiles)
     - `case_count` (integer: number of high-priority cases)
     - `time_period` (text: month/year for tracking)
     - `flagged_at` (timestamptz)
     - `reviewed_at` (timestamptz, nullable)
     - `reviewed_by` (uuid, nullable)

  ## Profile Updates
  - Add `shadow_banned` (boolean, default false)
  - Add `suspension_ends_at` (timestamptz, nullable)
  - Add `permanently_blocked` (boolean, default false)
  - Add `device_id` (text, nullable: for tracking)
  - Add `legal_hold_until` (timestamptz, nullable: 30-day deletion hold)

  ## Security
  - RLS policies ensure users can only report others, not themselves
  - Users can only view/update their own cases (for appeals)
  - Admins have full access to all cases
  - Auto-escalation function runs via scheduled checks
*/

-- ============================================================================
-- STEP 1: Add new columns to profiles table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'shadow_banned'
  ) THEN
    ALTER TABLE profiles ADD COLUMN shadow_banned boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspension_ends_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspension_ends_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'permanently_blocked'
  ) THEN
    ALTER TABLE profiles ADD COLUMN permanently_blocked boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN device_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'legal_hold_until'
  ) THEN
    ALTER TABLE profiles ADD COLUMN legal_hold_until timestamptz;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create moderation_cases table
-- ============================================================================

CREATE TABLE IF NOT EXISTS moderation_cases (
  case_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason_code text NOT NULL,
  reason_details text,
  status text NOT NULL DEFAULT 'Pending',
  severity text NOT NULL DEFAULT 'Medium',
  appeal_deadline timestamptz NOT NULL,
  appeal_text text,
  appeal_submitted_at timestamptz,
  is_resolved boolean DEFAULT false,
  resolution_action text,
  resolved_by uuid REFERENCES profiles(id),
  resolved_at timestamptz,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_reason_code CHECK (reason_code IN (
    'Bullying/Harassment',
    'Hate Speech',
    'Scam/Spam',
    'Inappropriate Content',
    'Impersonation'
  )),
  CONSTRAINT valid_status CHECK (status IN (
    'Pending',
    'Warning Issued',
    'Appealed',
    'Resolved',
    'Auto-Escalated'
  )),
  CONSTRAINT valid_severity CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  CONSTRAINT valid_resolution_action CHECK (resolution_action IN (
    'None',
    'Warning',
    '7-Day Suspension',
    'Permanent Block',
    NULL
  )),
  CONSTRAINT no_self_report CHECK (target_user_id != reporter_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_moderation_cases_status ON moderation_cases(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_target_user ON moderation_cases(target_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_reporter ON moderation_cases(reporter_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_appeal_deadline ON moderation_cases(appeal_deadline) WHERE is_resolved = false;

-- ============================================================================
-- STEP 3: Create enforcement_history table
-- ============================================================================

CREATE TABLE IF NOT EXISTS enforcement_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_id uuid REFERENCES moderation_cases(case_id) ON DELETE SET NULL,
  action_type text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  device_ids text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT valid_action_type CHECK (action_type IN (
    'Warning',
    '7-Day Suspension',
    'Permanent Block',
    'Account Deletion'
  ))
);

CREATE INDEX IF NOT EXISTS idx_enforcement_history_user ON enforcement_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enforcement_history_active ON enforcement_history(is_active) WHERE is_active = true;

-- ============================================================================
-- STEP 4: Create critical_review_flags table
-- ============================================================================

CREATE TABLE IF NOT EXISTS critical_review_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_count integer NOT NULL,
  time_period text NOT NULL,
  flagged_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id),

  UNIQUE(user_id, time_period)
);

CREATE INDEX IF NOT EXISTS idx_critical_review_flags_user ON critical_review_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_critical_review_flags_unreviewed ON critical_review_flags(flagged_at) WHERE reviewed_at IS NULL;

-- ============================================================================
-- STEP 5: Enable RLS on new tables
-- ============================================================================

ALTER TABLE moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE enforcement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_review_flags ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS Policies for moderation_cases
-- ============================================================================

-- Users can create cases (reports)
CREATE POLICY "Users can create moderation cases"
  ON moderation_cases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Users can view cases where they are the target (to submit appeals)
CREATE POLICY "Users can view own cases"
  ON moderation_cases FOR SELECT
  TO authenticated
  USING (auth.uid() = target_user_id OR auth.uid() = reporter_id);

-- Users can update cases where they are the target (for appeals only)
CREATE POLICY "Users can update own cases for appeals"
  ON moderation_cases FOR UPDATE
  TO authenticated
  USING (auth.uid() = target_user_id AND is_resolved = false)
  WITH CHECK (auth.uid() = target_user_id AND is_resolved = false);

-- Admins can view all cases
CREATE POLICY "Admins can view all cases"
  ON moderation_cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins can update all cases
CREATE POLICY "Admins can update all cases"
  ON moderation_cases FOR UPDATE
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
-- STEP 7: Create RLS Policies for enforcement_history
-- ============================================================================

-- Users can view their own enforcement history
CREATE POLICY "Users can view own enforcement history"
  ON enforcement_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all enforcement history
CREATE POLICY "Admins can view all enforcement history"
  ON enforcement_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins can create enforcement records
CREATE POLICY "Admins can create enforcement records"
  ON enforcement_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- STEP 8: Create RLS Policies for critical_review_flags
-- ============================================================================

-- Only admins can view critical review flags
CREATE POLICY "Admins can view critical review flags"
  ON critical_review_flags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- System can create critical review flags
CREATE POLICY "System can create critical review flags"
  ON critical_review_flags FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- STEP 9: Create function to submit moderation case (report)
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_moderation_case(
  p_target_user_id uuid,
  p_reason_code text,
  p_reason_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reporter_id uuid;
  v_case_id uuid;
  v_reporter_banned boolean;
  v_target_exists boolean;
  v_severity text;
BEGIN
  v_reporter_id := auth.uid();

  IF v_reporter_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if reporter is banned
  SELECT is_banned INTO v_reporter_banned
  FROM profiles WHERE id = v_reporter_id;

  IF v_reporter_banned THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot submit reports while banned');
  END IF;

  -- Check if target exists
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = p_target_user_id) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Prevent self-reporting
  IF v_reporter_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot report yourself');
  END IF;

  -- Determine severity based on reason code
  v_severity := CASE p_reason_code
    WHEN 'Hate Speech' THEN 'High'
    WHEN 'Bullying/Harassment' THEN 'High'
    WHEN 'Scam/Spam' THEN 'Medium'
    WHEN 'Inappropriate Content' THEN 'Medium'
    WHEN 'Impersonation' THEN 'High'
    ELSE 'Medium'
  END;

  -- Create moderation case
  INSERT INTO moderation_cases (
    target_user_id,
    reporter_id,
    reason_code,
    reason_details,
    status,
    severity,
    appeal_deadline
  ) VALUES (
    p_target_user_id,
    v_reporter_id,
    p_reason_code,
    p_reason_details,
    'Pending',
    v_severity,
    now() + INTERVAL '72 hours'
  ) RETURNING case_id INTO v_case_id;

  -- Shadow ban the target user during investigation
  UPDATE profiles
  SET shadow_banned = true
  WHERE id = p_target_user_id;

  -- Send notification to target user
  INSERT INTO notifications (user_id, type, content, created_at)
  VALUES (
    p_target_user_id,
    'moderation_case',
    jsonb_build_object(
      'case_id', v_case_id,
      'reason', p_reason_code,
      'message', 'Your account has been flagged for review. You have 72 hours to submit an appeal.'
    ),
    now()
  );

  -- Check for repeat offenses (critical review)
  PERFORM check_critical_review(p_target_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'case_id', v_case_id,
    'message', 'Report submitted successfully. The user will be notified.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to submit report: ' || SQLERRM);
END;
$$;

-- ============================================================================
-- STEP 10: Create function to submit appeal
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_appeal(
  p_case_id uuid,
  p_appeal_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_target_user_id uuid;
  v_appeal_deadline timestamptz;
  v_is_resolved boolean;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get case details
  SELECT target_user_id, appeal_deadline, is_resolved
  INTO v_target_user_id, v_appeal_deadline, v_is_resolved
  FROM moderation_cases
  WHERE case_id = p_case_id;

  -- Verify user is the target
  IF v_target_user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check if case is already resolved
  IF v_is_resolved THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case already resolved');
  END IF;

  -- Check if deadline has passed
  IF now() > v_appeal_deadline THEN
    RETURN jsonb_build_object('success', false, 'error', 'Appeal deadline has passed');
  END IF;

  -- Update case with appeal
  UPDATE moderation_cases
  SET
    appeal_text = p_appeal_text,
    appeal_submitted_at = now(),
    status = 'Appealed',
    updated_at = now()
  WHERE case_id = p_case_id;

  -- Create notification for admins (sent to all admins)
  INSERT INTO notifications (user_id, type, content, created_at)
  SELECT
    id,
    'appeal_submitted',
    jsonb_build_object(
      'case_id', p_case_id,
      'user_id', v_user_id,
      'message', 'A user has submitted an appeal for review'
    ),
    now()
  FROM profiles
  WHERE is_admin = true;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Appeal submitted successfully. An admin will review your case.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to submit appeal: ' || SQLERRM);
END;
$$;

-- ============================================================================
-- STEP 11: Create function to check critical review threshold
-- ============================================================================

CREATE OR REPLACE FUNCTION check_critical_review(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_high_priority_count integer;
  v_time_period text;
BEGIN
  v_time_period := to_char(now(), 'YYYY-MM');

  -- Count high-priority cases for this user in current month
  SELECT COUNT(*)
  INTO v_high_priority_count
  FROM moderation_cases
  WHERE target_user_id = p_user_id
    AND severity IN ('High', 'Critical')
    AND created_at >= date_trunc('month', now())
    AND is_resolved = false;

  -- Flag for critical review if 3+ cases
  IF v_high_priority_count >= 3 THEN
    INSERT INTO critical_review_flags (user_id, case_count, time_period)
    VALUES (p_user_id, v_high_priority_count, v_time_period)
    ON CONFLICT (user_id, time_period)
    DO UPDATE SET case_count = v_high_priority_count;
  END IF;
END;
$$;

-- ============================================================================
-- STEP 12: Create function to auto-escalate expired cases
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_escalate_expired_cases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expired_case RECORD;
  v_escalated_count integer := 0;
  v_previous_suspensions integer;
BEGIN
  -- Find all cases where appeal deadline has passed and no appeal was submitted
  FOR v_expired_case IN
    SELECT case_id, target_user_id, severity
    FROM moderation_cases
    WHERE appeal_deadline < now()
      AND is_resolved = false
      AND appeal_submitted_at IS NULL
      AND status = 'Pending'
  LOOP
    -- Count previous suspensions
    SELECT COUNT(*)
    INTO v_previous_suspensions
    FROM enforcement_history
    WHERE user_id = v_expired_case.target_user_id
      AND action_type IN ('7-Day Suspension', 'Permanent Block');

    -- Apply progressive enforcement
    IF v_previous_suspensions = 0 THEN
      -- First offense: 7-day suspension
      UPDATE moderation_cases
      SET
        status = 'Auto-Escalated',
        resolution_action = '7-Day Suspension',
        is_resolved = true,
        resolved_at = now(),
        updated_at = now(),
        admin_notes = 'Auto-escalated: No appeal submitted within 72 hours'
      WHERE case_id = v_expired_case.case_id;

      -- Apply suspension
      UPDATE profiles
      SET suspension_ends_at = now() + INTERVAL '7 days'
      WHERE id = v_expired_case.target_user_id;

      -- Record enforcement
      INSERT INTO enforcement_history (user_id, case_id, action_type, ends_at)
      VALUES (v_expired_case.target_user_id, v_expired_case.case_id, '7-Day Suspension', now() + INTERVAL '7 days');

    ELSIF v_previous_suspensions = 1 THEN
      -- Second offense: Permanent block
      UPDATE moderation_cases
      SET
        status = 'Auto-Escalated',
        resolution_action = 'Permanent Block',
        is_resolved = true,
        resolved_at = now(),
        updated_at = now(),
        admin_notes = 'Auto-escalated: Repeat offense - Permanent block applied'
      WHERE case_id = v_expired_case.case_id;

      -- Apply permanent block
      UPDATE profiles
      SET
        permanently_blocked = true,
        legal_hold_until = now() + INTERVAL '30 days'
      WHERE id = v_expired_case.target_user_id;

      -- Record enforcement
      INSERT INTO enforcement_history (user_id, case_id, action_type)
      VALUES (v_expired_case.target_user_id, v_expired_case.case_id, 'Permanent Block');

    ELSE
      -- Third+ offense: Already permanently blocked, extend legal hold
      UPDATE profiles
      SET legal_hold_until = now() + INTERVAL '30 days'
      WHERE id = v_expired_case.target_user_id;

      UPDATE moderation_cases
      SET
        status = 'Auto-Escalated',
        is_resolved = true,
        resolved_at = now(),
        updated_at = now()
      WHERE case_id = v_expired_case.case_id;
    END IF;

    v_escalated_count := v_escalated_count + 1;
  END LOOP;

  RETURN v_escalated_count;
END;
$$;

-- ============================================================================
-- STEP 13: Create function to get user's active moderation cases
-- ============================================================================

CREATE OR REPLACE FUNCTION get_my_moderation_cases()
RETURNS TABLE (
  case_id uuid,
  reason_code text,
  reason_details text,
  status text,
  severity text,
  appeal_deadline timestamptz,
  appeal_text text,
  appeal_submitted_at timestamptz,
  is_resolved boolean,
  resolution_action text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    mc.case_id,
    mc.reason_code,
    mc.reason_details,
    mc.status,
    mc.severity,
    mc.appeal_deadline,
    mc.appeal_text,
    mc.appeal_submitted_at,
    mc.is_resolved,
    mc.resolution_action,
    mc.created_at
  FROM moderation_cases mc
  WHERE mc.target_user_id = v_user_id
  ORDER BY mc.created_at DESC;
END;
$$;

-- ============================================================================
-- STEP 14: Create admin function to get all moderation cases
-- ============================================================================

CREATE OR REPLACE FUNCTION get_all_moderation_cases()
RETURNS TABLE (
  case_id uuid,
  target_user_id uuid,
  target_username text,
  reporter_id uuid,
  reporter_username text,
  reason_code text,
  reason_details text,
  status text,
  severity text,
  appeal_deadline timestamptz,
  appeal_text text,
  appeal_submitted_at timestamptz,
  is_resolved boolean,
  resolution_action text,
  resolved_by uuid,
  resolved_at timestamptz,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  v_user_id := auth.uid();

  -- Verify admin status
  SELECT is_admin INTO v_is_admin
  FROM profiles WHERE id = v_user_id;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized - admin access required';
  END IF;

  RETURN QUERY
  SELECT
    mc.case_id,
    mc.target_user_id,
    target.username as target_username,
    mc.reporter_id,
    reporter.username as reporter_username,
    mc.reason_code,
    mc.reason_details,
    mc.status,
    mc.severity,
    mc.appeal_deadline,
    mc.appeal_text,
    mc.appeal_submitted_at,
    mc.is_resolved,
    mc.resolution_action,
    mc.resolved_by,
    mc.resolved_at,
    mc.admin_notes,
    mc.created_at,
    mc.updated_at
  FROM moderation_cases mc
  JOIN profiles target ON target.id = mc.target_user_id
  JOIN profiles reporter ON reporter.id = mc.reporter_id
  ORDER BY
    CASE WHEN mc.status = 'Appealed' THEN 0
         WHEN mc.status = 'Pending' THEN 1
         ELSE 2 END,
    mc.created_at DESC;
END;
$$;

-- ============================================================================
-- STEP 15: Create admin function to resolve moderation case
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_moderation_case(
  p_case_id uuid,
  p_resolution_action text,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid;
  v_is_admin boolean;
  v_target_user_id uuid;
BEGIN
  v_admin_id := auth.uid();

  -- Verify admin status
  SELECT is_admin INTO v_is_admin
  FROM profiles WHERE id = v_admin_id;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized - admin access required');
  END IF;

  -- Get target user
  SELECT target_user_id INTO v_target_user_id
  FROM moderation_cases WHERE case_id = p_case_id;

  -- Update case
  UPDATE moderation_cases
  SET
    status = 'Resolved',
    resolution_action = p_resolution_action,
    is_resolved = true,
    resolved_by = v_admin_id,
    resolved_at = now(),
    admin_notes = p_admin_notes,
    updated_at = now()
  WHERE case_id = p_case_id;

  -- Apply enforcement based on resolution
  IF p_resolution_action = 'Warning' THEN
    -- Remove shadow ban
    UPDATE profiles SET shadow_banned = false WHERE id = v_target_user_id;

    INSERT INTO enforcement_history (user_id, case_id, action_type)
    VALUES (v_target_user_id, p_case_id, 'Warning');

  ELSIF p_resolution_action = '7-Day Suspension' THEN
    UPDATE profiles
    SET
      shadow_banned = false,
      suspension_ends_at = now() + INTERVAL '7 days'
    WHERE id = v_target_user_id;

    INSERT INTO enforcement_history (user_id, case_id, action_type, ends_at)
    VALUES (v_target_user_id, p_case_id, '7-Day Suspension', now() + INTERVAL '7 days');

  ELSIF p_resolution_action = 'Permanent Block' THEN
    UPDATE profiles
    SET
      shadow_banned = false,
      permanently_blocked = true,
      legal_hold_until = now() + INTERVAL '30 days'
    WHERE id = v_target_user_id;

    INSERT INTO enforcement_history (user_id, case_id, action_type)
    VALUES (v_target_user_id, p_case_id, 'Permanent Block');

  ELSIF p_resolution_action = 'None' THEN
    -- Case dismissed - remove shadow ban
    UPDATE profiles SET shadow_banned = false WHERE id = v_target_user_id;
  END IF;

  -- Notify user
  INSERT INTO notifications (user_id, type, content, created_at)
  VALUES (
    v_target_user_id,
    'case_resolved',
    jsonb_build_object(
      'case_id', p_case_id,
      'resolution', p_resolution_action,
      'message', 'Your moderation case has been resolved by an admin.'
    ),
    now()
  );

  RETURN jsonb_build_object('success', true, 'message', 'Case resolved successfully');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to resolve case: ' || SQLERRM);
END;
$$;

-- ============================================================================
-- STEP 16: Create trigger to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_moderation_case_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_moderation_case_timestamp ON moderation_cases;
CREATE TRIGGER trigger_update_moderation_case_timestamp
  BEFORE UPDATE ON moderation_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_moderation_case_timestamp();

-- ============================================================================
-- STEP 17: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION submit_moderation_case(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_appeal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_moderation_cases() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_moderation_cases() TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_moderation_case(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_escalate_expired_cases() TO authenticated;

-- ============================================================================
-- STEP 18: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE moderation_cases IS
'Comprehensive moderation case management with 72-hour appeal window and progressive enforcement.';

COMMENT ON TABLE enforcement_history IS
'Tracks all enforcement actions taken against users with device ID tracking.';

COMMENT ON TABLE critical_review_flags IS
'Flags users who receive 3+ high-priority reports in a month for critical admin review.';

COMMENT ON FUNCTION submit_moderation_case(uuid, text, text) IS
'Creates a new moderation case with automatic shadow ban and 72-hour appeal window.';

COMMENT ON FUNCTION submit_appeal(uuid, text) IS
'Allows reported users to submit an appeal within the 72-hour deadline.';

COMMENT ON FUNCTION auto_escalate_expired_cases() IS
'Auto-escalates cases where appeal deadline passed without appeal. Progressive: 7-day suspension → permanent block.';

COMMENT ON FUNCTION resolve_moderation_case(uuid, text, text) IS
'Admin-only function to resolve moderation cases with enforcement actions.';
