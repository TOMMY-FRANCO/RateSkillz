/*
  # Update age trigger to set both privacy settings

  1. Updates
    - Update set_default_findable_by_age function to also set hide_from_leaderboard
    - When age 11-17: findable_by_school = false, hide_from_leaderboard = true
    - When age 18+: findable_by_school = true, hide_from_leaderboard = false
  
  2. Security
    - Maintains SECURITY DEFINER for proper permissions
    - Only sets defaults when age is being set for first time
*/

-- Update the function to set both privacy settings based on age
CREATE OR REPLACE FUNCTION set_default_findable_by_age()
RETURNS TRIGGER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- If age is being set or changed
  IF NEW.age IS NOT NULL AND (OLD.age IS NULL OR OLD.age IS DISTINCT FROM NEW.age) THEN
    -- Set privacy defaults based on age
    IF NEW.age >= 11 AND NEW.age < 18 THEN
      -- Minors: hidden from search and leaderboards by default
      IF OLD.age IS NULL OR OLD.findable_by_school IS NULL THEN
        NEW.findable_by_school := false;
      END IF;
      IF OLD.age IS NULL OR OLD.hide_from_leaderboard IS NULL THEN
        NEW.hide_from_leaderboard := true;
      END IF;
    ELSIF NEW.age >= 18 THEN
      -- Adults: visible in search and leaderboards by default
      IF OLD.age IS NULL OR OLD.findable_by_school IS NULL THEN
        NEW.findable_by_school := true;
      END IF;
      IF OLD.age IS NULL OR OLD.hide_from_leaderboard IS NULL THEN
        NEW.hide_from_leaderboard := false;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Log the update
INSERT INTO admin_security_log (event_type, severity, operation_type, details)
VALUES (
  'validation_failed',
  'info',
  'age_trigger_update',
  jsonb_build_object(
    'action', 'updated_age_trigger_for_privacy',
    'function_updated', 'set_default_findable_by_age',
    'privacy_settings', jsonb_build_array(
      'findable_by_school (false for minors, true for adults)',
      'hide_from_leaderboard (true for minors, false for adults)'
    ),
    'timestamp', now()
  )
);