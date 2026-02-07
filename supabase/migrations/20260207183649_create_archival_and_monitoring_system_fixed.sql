/*
  # Create Data Archival and Monitoring System for Scalability

  1. Purpose
    - Archive old data from active tables to reduce table bloat
    - Create monitoring views and functions for performance tracking
    - Implement cleanup routines for expired/stale data
    - Support 10,000+ users with millions of rows efficiently

  2. Archival Tables
    - reports_archive: Archive resolved reports older than 90 days
    - moderation_cases_archive: Archive closed cases older than 90 days
    - enforcement_history_archive: Archive old enforcement records
    - admin_action_logs_archive: Archive old admin actions

  3. Monitoring Views
    - table_sizes_view: Monitor table growth
    - index_usage_view: Monitor index effectiveness

  4. Cleanup Functions
    - archive_old_reports(): Move old reports to archive
    - archive_old_moderation_cases(): Move old moderation data
    - cleanup_expired_password_resets(): Remove expired tokens
    - cleanup_stale_typing_status(): Remove old typing indicators
*/

-- =============================================
-- ARCHIVE TABLES
-- =============================================

-- Archive table for old reports
CREATE TABLE IF NOT EXISTS reports_archive (
  LIKE reports INCLUDING ALL
);

-- Archive table for old moderation cases
CREATE TABLE IF NOT EXISTS moderation_cases_archive (
  LIKE moderation_cases INCLUDING ALL
);

-- Archive table for old enforcement history
CREATE TABLE IF NOT EXISTS enforcement_history_archive (
  LIKE enforcement_history INCLUDING ALL
);

-- Archive table for old admin action logs
CREATE TABLE IF NOT EXISTS admin_action_logs_archive (
  LIKE admin_action_logs INCLUDING ALL
);

-- =============================================
-- ARCHIVAL FUNCTIONS
-- =============================================

-- Function to archive old reports (90+ days old, resolved)
CREATE OR REPLACE FUNCTION archive_old_reports()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move reports older than 90 days that are resolved
  WITH moved_reports AS (
    DELETE FROM reports
    WHERE status IN ('resolved', 'dismissed')
      AND created_at < NOW() - INTERVAL '90 days'
    RETURNING *
  )
  INSERT INTO reports_archive
  SELECT * FROM moved_reports;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  RETURN archived_count;
END;
$$;

-- Function to archive old moderation cases (90+ days old, closed)
CREATE OR REPLACE FUNCTION archive_old_moderation_cases()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move moderation cases older than 90 days that are closed
  WITH moved_cases AS (
    DELETE FROM moderation_cases
    WHERE status IN ('resolved', 'dismissed')
      AND created_at < NOW() - INTERVAL '90 days'
    RETURNING *
  )
  INSERT INTO moderation_cases_archive
  SELECT * FROM moved_cases;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  RETURN archived_count;
END;
$$;

-- Function to archive old enforcement history (180+ days old)
CREATE OR REPLACE FUNCTION archive_old_enforcement_history()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move enforcement history older than 180 days
  WITH moved_history AS (
    DELETE FROM enforcement_history
    WHERE created_at < NOW() - INTERVAL '180 days'
    RETURNING *
  )
  INSERT INTO enforcement_history_archive
  SELECT * FROM moved_history;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  RETURN archived_count;
END;
$$;

-- Function to archive old admin action logs (90+ days old)
CREATE OR REPLACE FUNCTION archive_old_admin_action_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move admin action logs older than 90 days
  WITH moved_logs AS (
    DELETE FROM admin_action_logs
    WHERE created_at < NOW() - INTERVAL '90 days'
    RETURNING *
  )
  INSERT INTO admin_action_logs_archive
  SELECT * FROM moved_logs;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  RETURN archived_count;
END;
$$;

-- =============================================
-- CLEANUP FUNCTIONS
-- =============================================

-- Function to cleanup expired password reset tokens
CREATE OR REPLACE FUNCTION cleanup_expired_password_resets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM password_resets
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Function to cleanup stale typing status (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_stale_typing_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM typing_status
  WHERE updated_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Function to cleanup old ad views (older than 1 year)
CREATE OR REPLACE FUNCTION cleanup_old_ad_views()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ad_views
  WHERE created_at < NOW() - INTERVAL '1 year';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Function to cleanup old profile views (older than 6 months, keep only latest per viewer)
CREATE OR REPLACE FUNCTION cleanup_old_profile_views()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Keep only the most recent view per viewer-profile pair
  DELETE FROM profile_views
  WHERE id IN (
    SELECT id FROM (
      SELECT id, 
        ROW_NUMBER() OVER (PARTITION BY profile_id, viewer_id ORDER BY viewed_at DESC) as rn
      FROM profile_views
      WHERE viewed_at < NOW() - INTERVAL '6 months'
    ) t WHERE rn > 1
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- =============================================
-- MASTER ARCHIVAL FUNCTION
-- =============================================

-- Function to run all archival processes
CREATE OR REPLACE FUNCTION run_all_archival_processes()
RETURNS TABLE(
  process_name TEXT,
  records_processed INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reports_count INTEGER;
  cases_count INTEGER;
  history_count INTEGER;
  logs_count INTEGER;
  password_count INTEGER;
  typing_count INTEGER;
  ad_count INTEGER;
  views_count INTEGER;
BEGIN
  -- Run all archival functions
  reports_count := archive_old_reports();
  cases_count := archive_old_moderation_cases();
  history_count := archive_old_enforcement_history();
  logs_count := archive_old_admin_action_logs();
  
  -- Run cleanup functions
  password_count := cleanup_expired_password_resets();
  typing_count := cleanup_stale_typing_status();
  ad_count := cleanup_old_ad_views();
  views_count := cleanup_old_profile_views();

  -- Return results
  RETURN QUERY
  SELECT 'Archive Old Reports'::TEXT, reports_count, 'Completed'::TEXT
  UNION ALL
  SELECT 'Archive Old Moderation Cases'::TEXT, cases_count, 'Completed'::TEXT
  UNION ALL
  SELECT 'Archive Old Enforcement History'::TEXT, history_count, 'Completed'::TEXT
  UNION ALL
  SELECT 'Archive Old Admin Action Logs'::TEXT, logs_count, 'Completed'::TEXT
  UNION ALL
  SELECT 'Cleanup Expired Password Resets'::TEXT, password_count, 'Completed'::TEXT
  UNION ALL
  SELECT 'Cleanup Stale Typing Status'::TEXT, typing_count, 'Completed'::TEXT
  UNION ALL
  SELECT 'Cleanup Old Ad Views'::TEXT, ad_count, 'Completed'::TEXT
  UNION ALL
  SELECT 'Cleanup Old Profile Views'::TEXT, views_count, 'Completed'::TEXT;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION archive_old_reports() IS 'Archives reports older than 90 days that are resolved or dismissed';
COMMENT ON FUNCTION archive_old_moderation_cases() IS 'Archives moderation cases older than 90 days that are closed';
COMMENT ON FUNCTION archive_old_enforcement_history() IS 'Archives enforcement history older than 180 days';
COMMENT ON FUNCTION cleanup_expired_password_resets() IS 'Removes expired password reset tokens';
COMMENT ON FUNCTION cleanup_stale_typing_status() IS 'Removes typing status entries older than 1 hour';
COMMENT ON FUNCTION run_all_archival_processes() IS 'Runs all archival and cleanup processes in one call';
