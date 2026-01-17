/*
  # Add Info Severity to Admin Security Log

  ## Problem
  The reset_daily_ad_views() function uses 'info' severity, but the constraint
  only allows 'low', 'medium', 'high', 'critical'.

  ## Solution
  Add 'info' severity to the allowed values for admin_security_log.severity

  ## Changes
  - Drop existing severity constraint
  - Recreate with 'info' severity added
*/

-- Drop the existing constraint
ALTER TABLE admin_security_log 
DROP CONSTRAINT IF EXISTS admin_security_log_severity_check;

-- Recreate with info severity
ALTER TABLE admin_security_log
ADD CONSTRAINT admin_security_log_severity_check
CHECK (severity IN (
  'info',
  'low',
  'medium',
  'high',
  'critical'
));

-- Add comment
COMMENT ON CONSTRAINT admin_security_log_severity_check ON admin_security_log IS
'Allowed severity levels: info (informational logs), low, medium, high, critical (security threats)';
