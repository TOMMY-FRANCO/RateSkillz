/*
  # Fix notify_profile_view Trigger Function

  ## Problem
  - The notify_profile_view function was referencing wrong column names
  - Used NEW.viewed_id instead of NEW.profile_id
  - This caused errors when inserting profile views

  ## Changes
  - Fix column references in notify_profile_view function
  - NEW.viewed_id → NEW.profile_id (the user being viewed)
  - NEW.viewer_id → NEW.viewer_id (stays the same)
*/

CREATE OR REPLACE FUNCTION notify_profile_view()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create notification if viewer is not viewing their own profile
  IF NEW.viewer_id IS NOT NULL AND NEW.viewer_id != NEW.profile_id THEN
    PERFORM create_notification(
      NEW.profile_id,  -- Fixed: was NEW.viewed_id
      'profile_view',
      NEW.id,
      NEW.viewer_id,
      'Someone viewed your profile'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
