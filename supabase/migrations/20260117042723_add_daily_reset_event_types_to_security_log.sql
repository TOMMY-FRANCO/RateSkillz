/*
  # Add Daily Reset Event Types to Admin Security Log

  ## Problem
  The reset_daily_ad_views() function tries to log 'daily_ad_reset' and 
  'daily_ad_reset_error' events, but these are not in the allowed event types
  for admin_security_log table.

  ## Solution
  Add these event types to the check constraint on admin_security_log.event_type

  ## Changes
  - Drop existing constraint
  - Recreate with additional event types for daily reset operations
*/

-- Drop the existing constraint
ALTER TABLE admin_security_log 
DROP CONSTRAINT IF EXISTS admin_security_log_event_type_check;

-- Recreate with additional event types
ALTER TABLE admin_security_log
ADD CONSTRAINT admin_security_log_event_type_check
CHECK (event_type IN (
  'validation_failed',
  'negative_amount_rejected',
  'excessive_amount_rejected',
  'invalid_user_rejected',
  'duplicate_payment_detected',
  'concurrent_operation_detected',
  'suspicious_activity',
  'daily_ad_reset',
  'daily_ad_reset_error'
));

-- Add comment
COMMENT ON CONSTRAINT admin_security_log_event_type_check ON admin_security_log IS
'Allowed event types including security violations and scheduled tasks like daily ad reset';
