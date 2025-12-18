/*
  # Add Profile Views Count and Helper Functions

  1. New Columns
    - Add `profile_views_count` to profiles table to track total view count
  
  2. Functions
    - `record_profile_view` - Records a profile view only if viewer is not the owner
    - Automatically updates the count and logs the view
  
  3. Security
    - Function prevents self-views from being counted
    - Only increments count when viewer_id is different from profile owner
  
  4. Important Notes
    - Profile owners viewing their own profile will NOT increment the counter
    - Existing profile_views table is used for tracking individual views
*/

-- Add profile_views_count column to profiles table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'profile_views_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN profile_views_count integer DEFAULT 0;
  END IF;
END $$;

-- Function to record profile view (only if viewer is not the owner)
CREATE OR REPLACE FUNCTION record_profile_view(
  p_profile_id uuid,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_new_count integer;
BEGIN
  -- Only record view if viewer is different from profile owner
  IF p_viewer_id IS NULL OR p_viewer_id != p_profile_id THEN
    -- Insert view log
    INSERT INTO profile_views (profile_id, viewer_id, viewed_at)
    VALUES (p_profile_id, p_viewer_id, now());
    
    -- Increment counter and get new count
    UPDATE profiles
    SET profile_views_count = COALESCE(profile_views_count, 0) + 1
    WHERE id = p_profile_id
    RETURNING profile_views_count INTO v_new_count;
    
    v_result := jsonb_build_object(
      'success', true,
      'counted', true,
      'new_count', v_new_count
    );
  ELSE
    -- Self-view, don't count
    v_result := jsonb_build_object(
      'success', true,
      'counted', false,
      'message', 'Self-views are not counted'
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Function to get profile view count
CREATE OR REPLACE FUNCTION get_profile_view_count(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COALESCE(profile_views_count, 0)
  INTO v_count
  FROM profiles
  WHERE id = p_profile_id;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Update existing profile_views_count based on existing logs (one-time sync)
UPDATE profiles
SET profile_views_count = (
  SELECT COUNT(*)
  FROM profile_views
  WHERE profile_views.profile_id = profiles.id
  AND (profile_views.viewer_id IS NULL OR profile_views.viewer_id != profiles.id)
);
